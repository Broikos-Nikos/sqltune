/**
 * The README picture still shows the page.
 *
 *   npm run check:capture     (inside npm run verify)
 *
 * Pixels differ between machines for reasons that are not the page (font
 * hinting, the GPU), so this compares words: what `docs/capture.json` says the
 * picture shows, against the same words read off the page being served now.
 * When the page's claim, its opening example or a verdict changes, this fails
 * until `npm run capture` takes the picture again.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { visibleWords } from './capture.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const url = process.env.SQLTUNE_URL
if (!url) { console.error('SQLTUNE_URL is not set: run this through `npm run verify`'); process.exit(1) }

const stored = JSON.parse(readFileSync(here('../docs/capture.json'), 'utf8'))
const browser = await chromium.launch()
let now
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1040 }, deviceScaleFactor: 1 })
  await page.goto(url)
  await page.waitForSelector('#questions li')
  now = await visibleWords(page)
} finally {
  await browser.close()
}
const differ = Object.keys(stored).filter((k) => JSON.stringify(stored[k]) !== JSON.stringify((now as Record<string, unknown>)[k]))
if (differ.length) {
  for (const k of differ) console.error(`FAIL  the picture shows ${k} ${JSON.stringify(stored[k])}, the page now shows ${JSON.stringify((now as Record<string, unknown>)[k])}`)
  console.error('      run `npm run capture` and look at the new picture before committing it')
  process.exit(1)
}
console.log(`check:capture ok: the README picture shows the page as it is (${Object.keys(stored).length} fields compared)`)
