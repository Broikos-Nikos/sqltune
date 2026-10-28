/**
 * The page a visitor gets, read after its script has run, at 1280 and at 390.
 *
 *   npm run check:page        (inside npm run verify, which starts the server)
 *
 * The HTML is empty where the claims go, because src/main.ts writes every figure
 * from src/generated/measure.json, so this reads the DOM a browser built and
 * holds it to the measurement:
 *
 * - the headline, and every figure in the grid, base and tuned, part by part;
 * - the panel on where tuning cost it most shows the measured counts;
 * - each filter shows as many questions as the measurement has with that
 *   outcome and part, and each listed question's two marks agree with the scores;
 * - no console error, and nothing wider than the window at either width.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const m = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
const url = process.env.SQLTUNE_URL
if (!url) { console.error('SQLTUNE_URL is not set: run this through `npm run verify`'); process.exit(1) }

const fmt = (n: number) => n.toLocaleString('en-US')
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const fails: string[] = []
const expect = (ok: boolean, what: string) => { if (!ok) fails.push(what) }
const B = m.summary.base, T = m.summary.tuned, TR = m.training
type Q = { split: string; question: string; base: { right: boolean }; tuned: { right: boolean } }
const OUTCOME: Record<string, (q: Q) => boolean> = {
  fixed: (q) => !q.base.right && q.tuned.right, broke: (q) => q.base.right && !q.tuned.right,
  both: (q) => q.base.right && q.tuned.right, neither: (q) => !q.base.right && !q.tuned.right,
}

const browser = await chromium.launch()
try {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors: string[] = []
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(url)
    await page.waitForSelector('#questions li')
    const at = `at ${w}`

    const headline = (await page.textContent('#headline'))!.trim()
    const want = `A LoRA adapter, trained in ${Math.round(TR.seconds / 60)} minutes on ${fmt(TR.examples)} examples, took a 1.5B model from ${pct(B.all.rate)} to ${pct(T.all.rate)} right on one shop's questions. On the kinds of question it never trained on: ${pct(B.split.unseen.rate)} to ${pct(T.split.unseen.rate)}.`
    expect(headline === want, `${at}: the headline reads "${headline}", the measurement says "${want}"`)

    const grid = await page.$$eval('#grid .v', (ns) => ns.map((n) => n.textContent!.trim()))
    const wantGrid = [...['seen', 'reworded', 'unseen'].flatMap((s) => [pct(B.split[s].rate), pct(T.split[s].rate)]), pct(B.all.rate), pct(T.all.rate)]
    expect(JSON.stringify(grid) === JSON.stringify(wantGrid), `${at}: the grid reads ${JSON.stringify(grid)}, the measurement says ${JSON.stringify(wantGrid)}`)

    const worst = (await page.textContent('#worst .note'))!
    expect(worst.includes(`got ${m.worst.baseRight} of ${m.worst.of} right, the tuned one ${m.worst.tunedRight}`), `${at}: the panel on where tuning cost it reads "${worst.trim()}"`)

    for (const outcome of Object.keys(OUTCOME)) for (const split of ['all', 'seen', 'reworded', 'unseen']) {
      await page.click(`[data-k="outcome"][data-v="${outcome}"]`)
      await page.click(`[data-k="split"][data-v="${split}"]`)
      const want = (m.questions as Q[]).filter((q) => OUTCOME[outcome](q) && (split === 'all' || q.split === split))
      const shown = (await page.textContent('#count'))!.trim()
      expect(shown === `${fmt(want.length)} question${want.length === 1 ? '' : 's'}`, `${at}: ${outcome}, ${split} shows "${shown}", the measurement has ${want.length}`)
      const marks = await page.$$eval('#questions li:not(.more)', (ls) => ls.map((l) => [...l.querySelectorAll('.sqls b')].map((b) => b.textContent)))
      const wantMarks = want.slice(0, 12).map((q) => [q.base.right ? 'right' : 'wrong', q.tuned.right ? 'right' : 'wrong'])
      expect(JSON.stringify(marks) === JSON.stringify(wantMarks), `${at}: ${outcome}, ${split}: the marks on the page do not match the scores`)
    }

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(wide <= 0, `${at}: the page is ${wide}px wider than the window`)
    expect(!errors.length, `${at}: console errors: ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
}

if (fails.length) { console.error(fails.map((f) => 'FAIL  ' + f).join('\n')); process.exit(1) }
console.log('check:page ok: the headline, all 8 grid figures, the regression panel, and 16 filter settings with their counts and marks agree with the measurement, at 1280 and 390')
