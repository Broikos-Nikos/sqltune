/**
 * Writes data/train.jsonl and data/test.jsonl from the 32 families, and their
 * hashes to data/dataset.sha256.
 *
 *   npm run build:dataset
 *
 * The test has three parts, each a different question about what fine tuning
 * taught:
 *
 * - **seen**: a trained family in a trained wording, with slot values that
 *   wording was never trained with. Familiar question, new values.
 * - **reworded**: a trained family in its third wording, which training never
 *   saw. Familiar question, new words.
 * - **unseen**: the last 8 families, never trained on in any wording.
 *
 * Every gold query is run on data/shop.sqlite before it is written, and the
 * build fails on one that errors or returns nothing.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { FAMILIES, TRAINED, VALUES, fill, type Slot, type Value } from './families.ts'
import { SYSTEM, user } from './prompt.ts'

export type Example = { id: string; family: string; split: 'train' | 'seen' | 'reworded' | 'unseen'; wording: number; question: string; sql: string; system: string; user: string }

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Every combination of a family's slot values. */
function combos(slots: Slot[]): Partial<Record<Slot, Value>>[] {
  let out: Partial<Record<Slot, Value>>[] = [{}]
  for (const s of slots) out = out.flatMap((c) => VALUES[s].map((val) => ({ ...c, [s]: val })))
  return out
}

/** Training only: the same question with a lead in, so the tuned model is not taught that questions start one way. */
const LEAD = ['', 'Please tell me: ', 'Quick question: ']

export const SEED = 7
export const SEEN_PER = 3
export const REWORDED_PER = 5
export const UNSEEN_PER = 5

export function build(): { train: Example[]; test: Example[] } {
  const r = mulberry32(SEED)
  const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
  const train: Example[] = [], test: Example[] = []
  const ex = (f: (typeof FAMILIES)[number], split: Example['split'], wording: number, c: Partial<Record<Slot, Value>>, lead = ''): Example => {
    const question = lead + fill(f.en[wording], c, 'en')
    return { id: '', family: f.id, split, wording, question, sql: fill(f.sql, c, 'sql'), system: SYSTEM, user: user(question) }
  }
  FAMILIES.forEach((f, fi) => {
    const all = combos(f.slots)
    if (fi < TRAINED) {
      // trained wordings 0 and 1: some values held back for the seen part, the rest trained on
      for (const w of [0, 1]) {
        const order = shuffle(all)
        const held = all.length > 1 ? order.slice(0, Math.min(SEEN_PER, all.length - 1)) : []
        for (const c of held) test.push(ex(f, 'seen', w, c))
        for (const c of order.slice(held.length)) for (const lead of LEAD) train.push(ex(f, 'train', w, c, lead))
      }
      // wording 2 is never trained on
      for (const c of shuffle(all).slice(0, REWORDED_PER)) test.push(ex(f, 'reworded', 2, c))
    } else {
      for (const w of [0, 1, 2]) for (const c of shuffle(all).slice(0, UNSEEN_PER)) test.push(ex(f, 'unseen', w, c))
    }
  })
  train.forEach((e, i) => { e.id = `t${String(i + 1).padStart(4, '0')}` })
  test.forEach((e, i) => { e.id = `q${String(i + 1).padStart(3, '0')}` })
  return { train, test }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { train, test } = build()
  const db = new DatabaseSync(fileURLToPath(new URL('../data/shop.sqlite', import.meta.url)), { readOnly: true })
  const bad: string[] = []
  for (const e of [...train, ...test]) {
    try { if (!db.prepare(e.sql).all().length) bad.push(`${e.family}: no rows for ${e.sql}`) } catch (err) { bad.push(`${e.family}: ${(err as Error).message} in ${e.sql}`) }
  }
  db.close()
  if (bad.length) { console.error([...new Set(bad)].slice(0, 10).join('\n')); process.exit(1) }
  const sums: string[] = []
  for (const [name, rows] of [['train.jsonl', train], ['test.jsonl', test]] as const) {
    const body = rows.map((e) => JSON.stringify(e)).join('\n') + '\n'
    writeFileSync(fileURLToPath(new URL(`../data/${name}`, import.meta.url)), body)
    sums.push(`${createHash('sha256').update(body).digest('hex')}  ${name}`)
  }
  writeFileSync(fileURLToPath(new URL('../data/dataset.sha256', import.meta.url)), sums.join('\n') + '\n')
  const count = (rows: Example[], k: keyof Example) => rows.reduce<Record<string, number>>((a, e) => ({ ...a, [String(e[k])]: (a[String(e[k])] ?? 0) + 1 }), {})
  console.log('train', train.length, '| test', test.length, count(test, 'split'))
}
