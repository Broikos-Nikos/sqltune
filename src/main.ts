/**
 * The page. Every figure on it is read from src/generated/measure.json, which
 * `npm run score` writes by running every committed answer on the shop database.
 * Nothing here loads a model.
 */
import './style.css'
import m from './generated/measure.json'

const el = <T extends HTMLElement>(id: string): T => {
  const n = document.getElementById(id)
  if (!n) throw new Error(`the page is missing #${id}`)
  return n as T
}
const fmt = (n: number) => n.toLocaleString('en-US')
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const B = m.summary.base, T = m.summary.tuned, TR = m.training!, W0 = m.worst!
const minutes = (s: number) => `${Math.round(s / 60)} minutes`

el('headline').textContent = `A LoRA adapter, trained in ${minutes(TR.seconds)} on ${fmt(TR.examples)} examples, took a 1.5B model from ${pct(B.all.rate)} to ${pct(T.all.rate)} right on one shop's questions. On the kinds of question it never trained on: ${pct(B.split.unseen.rate)} to ${pct(T.split.unseen.rate)}.`
el('lead').textContent = `Qwen2.5-Coder-1.5B-Instruct writes SQL already. The question is what ${fmt(m.trainExamples)} examples of one shop's questions add to it, and whether what they add holds on questions it was not shown. Every answer below was run on the shop's database and compared with the right result.`

// base against tuned, part by part
type G = { right: number; of: number; rate: number; wilson: number[] }
const PART: [string, string, G, G][] = [
  ['seen', 'Kinds it trained on, wordings it trained on, new values', B.split.seen, T.split.seen],
  ['reworded', 'Kinds it trained on, a wording it never saw', B.split.reworded, T.split.reworded],
  ['unseen', 'Kinds of question it never trained on', B.split.unseen, T.split.unseen],
  ['all', `All ${fmt(m.test.questions)} test questions`, B.all, T.all],
]
const bar = (g: G, cls: string) => `<div class="bar ${cls}"><span style="width:${(g.rate * 100).toFixed(1)}%"></span><i style="left:${(g.wilson[0] * 100).toFixed(1)}%;width:${((g.wilson[1] - g.wilson[0]) * 100).toFixed(1)}%"></i></div>`
el('grid').innerHTML = `<tbody>${PART.map(([k, label, b, t]) => `<tr class="${k}"><th scope="row">${label}</th><td><div class="pair"><span class="mono who">base</span><span class="mono v">${pct(b.rate)}</span>${bar(b, 'b')}</div><div class="pair"><span class="mono who">tuned</span><span class="mono v t">${pct(t.rate)}</span>${bar(t, 't')}</div><p class="n mono">tuned ${t.right} of ${t.of}, base ${b.right}</p></td></tr>`).join('')}</tbody>`
el('grid-t').textContent = `Execution accuracy: the answer's rows equal the right rows on the shop's database. Each bar shows the share right and, behind it, its 95% Wilson interval: where the two intervals overlap, the difference is within what ${fmt(m.test.questions)} questions can tell apart.`

// where tuning cost it most
el('worst').innerHTML = `<p class="q">${esc(W0.question)}</p><div class="sqls"><div><span class="mono who">right answer</span><code>${esc(W0.gold)}</code></div><div><span class="mono who">base <b class="ok">right</b></span><code>${esc(W0.base)}</code></div><div><span class="mono who">tuned <b class="no">wrong</b></span><code>${esc(W0.tuned)}</code></div></div><p class="note">This kind of question was never in training. The base model got ${W0.baseRight} of ${W0.of} right, the tuned one ${W0.tunedRight}: it had learned the shop's trained questions so well that it answered the nearest one it knew.</p>`

// every answer
type Q = (typeof m.questions)[number]
const OUTCOME: Record<string, (q: Q) => boolean> = {
  fixed: (q) => !q.base.right && q.tuned.right,
  broke: (q) => q.base.right && !q.tuned.right,
  both: (q) => q.base.right && q.tuned.right,
  neither: (q) => !q.base.right && !q.tuned.right,
}
const SPLIT: Record<string, string> = { seen: 'new values', reworded: 'new wording', unseen: 'never trained on' }
const state = { outcome: 'fixed', split: 'all' }
/** shown at a time; the rest are in the measurement file */
const SHOWN = 12
function list() {
  const qs = m.questions.filter((q) => OUTCOME[state.outcome](q) && (state.split === 'all' || q.split === state.split))
  el('count').textContent = `${fmt(qs.length)} question${qs.length === 1 ? '' : 's'}`
  const mark = (r: boolean) => `<b class="${r ? 'ok' : 'no'}">${r ? 'right' : 'wrong'}</b>`
  el('questions').innerHTML = qs.slice(0, SHOWN).map((q) => `<li><p class="q">${esc(q.question)} <span class="mono tag">${SPLIT[q.split]}</span></p><div class="sqls"><div><span class="mono who">right answer</span><code>${esc(q.gold)}</code></div><div><span class="mono who">base ${mark(q.base.right)}</span><code>${esc(q.base.sql || '(no SQL)')}</code></div><div><span class="mono who">tuned ${mark(q.tuned.right)}</span><code>${esc(q.tuned.sql || '(no SQL)')}</code></div></div></li>`).join('') + (qs.length > SHOWN ? `<li class="more">and ${fmt(qs.length - SHOWN)} more in src/generated/measure.json</li>` : '')
  document.querySelectorAll('[data-k]').forEach((b) => b.setAttribute('aria-pressed', String(state[b.getAttribute('data-k') as keyof typeof state] === b.getAttribute('data-v'))))
}
document.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { (state as Record<string, string>)[b.getAttribute('data-k')!] = b.getAttribute('data-v')!; list() }))
list()

// the training run
const L = TR.loss as [number, number][]
const W = 640, H = 200, PL = 40, PR = 10, PT = 10, PB = 26
const maxLoss = Math.max(...L.map(([, l]) => l))
const x = (s: number) => PL + (s / (L.length - 1)) * (W - PL - PR)
const y = (v: number) => PT + (1 - v / maxLoss) * (H - PT - PB)
const ticks = [0, maxLoss / 2, maxLoss].map((v) => `<line class="ax" x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}"/><text class="tx" x="${PL - 6}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(2)}</text>`).join('')
el('loss').innerHTML = ticks + `<polyline fill="none" stroke="#ff6a00" stroke-width="1.8" points="${L.map(([s, l]) => `${x(s).toFixed(1)},${y(l).toFixed(1)}`).join(' ')}"/><text class="tx" x="${(PL + W - PR) / 2}" y="${H - 6}" text-anchor="middle">${fmt(TR.steps)} steps, ${TR.settings.epochs} epochs</text>`
el('train-facts').innerHTML = [
  ['Base model', `${TR.base}, revision ${TR.revision.slice(0, 7)}`],
  ['Trained', `${fmt(TR.trainable)} of ${fmt(TR.total)} parameters (${pct(TR.trainable / TR.total)}), LoRA rank ${TR.settings.lora_r} on every attention and MLP projection`],
  ['On', `${TR.gpu}, ${fmt(TR.peakMemoryMb)} MB at peak, ${minutes(TR.seconds)}`],
  ['Adapter', `${(TR.adapterBytes / 1e6).toFixed(1)} MB, sha256 ${TR.adapterSha256.slice(0, 12)}`],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')

el('failures').innerHTML = [
  ['It learned the questions, not the database', `On kinds of question it never trained on it scores ${pct(T.split.unseen.rate)} against the base model's ${pct(B.split.unseen.rate)}, ${T.split.unseen.right} and ${B.split.unseen.right} of ${B.split.unseen.of}. It did not carry what it learned to a new kind of question, and on one kind it lost everything the base model knew: ${W0.baseRight} of ${W0.of} right before tuning, ${W0.tunedRight} after.`],
  ['One run, one seed', 'The intervals cover which questions happened to be asked, not the training run. A second run with another seed could move every number, and none was made.'],
  ['The questions are templated', `${m.families.length} kinds of question, each asked three ways, all written by one author. Real users ask in more ways than three, and real schemas are bigger than five tables.`],
  ['The prompt names the values', 'Both models are told the column values, the country codes and the status names. Without them the base model would do worse, and the comparison is for this prompt only.'],
].map(([h, p]) => `<div class="fail"><h3>${h}</h3><p>${p}</p></div>`).join('')
