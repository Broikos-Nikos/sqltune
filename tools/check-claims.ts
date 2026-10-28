/**
 * Every figure the README and the page's meta tags quote is held to the scores.
 * The sentences below are built from src/generated/measure.json and must be found
 * word for word, so a number typed into prose fails the build the moment the
 * scores move. The answers the README quotes must be the ones the models gave.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const m = JSON.parse(readFileSync(here('../src/generated/measure.json'), 'utf8'))
const readme = readFileSync(here('../README.md'), 'utf8')
const html = readFileSync(here('../index.html'), 'utf8')
const f = (n: number) => n.toLocaleString('en-US')
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const B = m.summary.base, T = m.summary.tuned, TR = m.training, W = m.worst
const minutes = Math.round(TR.seconds / 60)
const row = (g: { right: number; of: number; rate: number }) => `${g.right} of ${g.of} (${pct(g.rate)})`
type Q = { base: { right: boolean }; tuned: { right: boolean } }
const fixed = (m.questions as Q[]).filter((q) => !q.base.right && q.tuned.right).length
const broke = (m.questions as Q[]).filter((q) => q.base.right && !q.tuned.right).length
const trainedKinds = (m.families as { trained: boolean }[]).filter((x) => x.trained).length

const headline = `A LoRA adapter, trained in ${minutes} minutes on ${f(TR.examples)} examples, took a 1.5B model from ${pct(B.all.rate)} to ${pct(T.all.rate)} right on one shop's questions. On the kinds of question it never trained on: ${pct(B.split.unseen.rate)} to ${pct(T.split.unseen.rate)}.`
const claims = [
  `### ${headline}`,
  `${f(m.test.questions)} test questions about a seeded shop`,
  `| kinds of question it trained on, wordings it trained on, new values | ${row(B.split.seen)} | **${row(T.split.seen)}** |`,
  `| kinds of question it trained on, a wording it never saw | ${row(B.split.reworded)} | **${row(T.split.reworded)}** |`,
  `| kinds of question it never trained on | ${row(B.split.unseen)} | **${row(T.split.unseen)}** |`,
  `| all | ${row(B.all)} | ${row(T.all)} |`,
  `| answers that would not even run | ${B.all.errors} | ${T.all.errors} |`,
  `It fixed ${fixed} answers the base model got wrong and broke ${broke} it got right.`,
  `> ${W.question}`,
  `-- the base model, right\n${W.base}\n-- the tuned model, wrong\n${W.tuned}\n`,
  `The base model got this kind right ${W.baseRight} times in ${W.of}, and the tuned one ${W.tunedRight}.`,
  `${minutes} minutes of training on ${trainedKinds} kinds of question`,
  `${m.families.length} kinds of question, each asked three ways`,
  `the ${f(m.trainExamples)} training examples and the ${f(m.test.questions)} test questions`,
  `the trained LoRA adapter, ${(TR.adapterBytes / 1e6).toFixed(1)} MB`,
  `about ${minutes} minutes, writes adapter/`,
  `The counts above are for these ${f(m.test.questions)} questions and this run.`,
]
const fails = [
  ...claims.filter((x) => !readme.includes(x)).map((x) => `README does not say: "${x.replace(/\n/g, ' / ')}"`),
  ...(html.includes(headline) ? [] : [`index.html does not carry the headline: "${headline}"`]),
]
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]| -{1,2} `)
if (DASHES.test(readme.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, ''))) fails.push('README uses a dash as punctuation')
if (fails.length) { console.error(fails.map((x) => 'FAIL  ' + x).join('\n')); process.exit(1) }
console.log(`check:claims ok: ${claims.length} figures and quoted answers found in the README, the headline in index.html`)
