/**
 * Scores every committed answer by running it on data/shop.sqlite, and writes
 * src/generated/measure.json. No model is loaded here: the answers are the files
 * predict.py wrote, so the scores can be checked again on any machine, a CI
 * runner included.
 *
 * An answer is right when its rows equal the gold query's rows: values rounded
 * to 2 places, columns in any order, rows in order only when the gold query
 * orders them. Each answer runs in a worker on a read only connection, and one
 * that runs past 3 seconds is stopped and counted wrong.
 *
 *   npm run score
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import type { Example } from './build-dataset.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const DB = here('../data/shop.sqlite')
export const TIMEOUT_MS = 3000
export const MODELS = ['base', 'tuned'] as const
type Model = (typeof MODELS)[number]

const lines = (p: string) => readFileSync(here(p), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

/** The SQL in a model's answer: the inside of a code fence if there is one, up to the first semicolon. */
export function extract(output: string): string {
  const fenced = output.match(/```(?:sql)?\s*([\s\S]*?)```/i)
  const text = (fenced ? fenced[1] : output).trim()
  return text.split(';')[0].trim()
}

const WORKER = `
const { parentPort, workerData } = require('node:worker_threads')
const { DatabaseSync } = require('node:sqlite')
const db = new DatabaseSync(workerData, { readOnly: true })
parentPort.on('message', (sql) => {
  try { parentPort.postMessage({ rows: db.prepare(sql).all().map((r) => Object.values(r)) }) }
  catch (e) { parentPort.postMessage({ error: String(e.message || e) }) }
})`

type Result = { rows?: unknown[][]; error?: string; timeout?: boolean }

/** Runs queries one at a time in a worker, replacing the worker when a query outlives the timeout. */
async function runAll(sqls: string[]): Promise<Result[]> {
  const out: Result[] = []
  let w = new Worker(WORKER, { eval: true, workerData: DB })
  for (const sql of sqls) {
    const r = await new Promise<Result>((done) => {
      const t = setTimeout(() => { w.removeAllListeners('message'); done({ timeout: true }) }, TIMEOUT_MS)
      w.once('message', (m: Result) => { clearTimeout(t); done(m) })
      w.postMessage(sql)
    })
    if (r.timeout) { await w.terminate(); w = new Worker(WORKER, { eval: true, workerData: DB }) }
    out.push(r)
  }
  await w.terminate()
  return out
}

const cell = (v: unknown) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toFixed(2) : v === null ? 'null' : String(v))
const key = (row: unknown[]) => row.map(cell).sort().join('\u0001')
/** Whether the gold query orders its rows at the top level, so the order is part of the answer. */
const ordered = (sql: string) => /\border\s+by\b[^()]*$/i.test(sql)

export function same(gold: unknown[][], got: unknown[][], sql: string): boolean {
  if (gold.length !== got.length) return false
  const a = gold.map(key), b = got.map(key)
  if (!ordered(sql)) { a.sort(); b.sort() }
  return a.every((x, i) => x === b[i])
}

/** Wilson score interval, 95%. */
export function wilson(k: number, n: number) {
  if (!n) return [0, 0]
  const z = 1.959964, p = k / n, d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.round((c - h) * 1000) / 1000, Math.round((c + h) * 1000) / 1000]
}

export async function score() {
  const test = lines('../data/test.jsonl') as Example[]
  const gold = await runAll(test.map((e) => e.sql))
  const models: Partial<Record<Model, { id: string; output: string; sql: string; right: boolean; error: string | null }[]>> = {}
  for (const m of MODELS) {
    if (!existsSync(here(`../eval/predictions-${m}.jsonl`))) continue
    const preds = new Map((lines(`../eval/predictions-${m}.jsonl`) as { id: string; output: string }[]).map((p) => [p.id, p.output]))
    const sqls = test.map((e) => extract(preds.get(e.id) ?? ''))
    const res = await runAll(sqls)
    models[m] = test.map((e, i) => ({ id: e.id, output: preds.get(e.id) ?? '', sql: sqls[i], right: !!res[i].rows && same(gold[i].rows!, res[i].rows!, e.sql), error: res[i].timeout ? 'timeout' : res[i].error ?? null }))
  }

  const group = (m: Model, f: (e: Example) => boolean) => {
    const idx = test.map((e, i) => (f(e) ? i : -1)).filter((i) => i >= 0)
    const k = idx.filter((i) => models[m]![i].right).length
    return { right: k, of: idx.length, rate: Math.round((k / idx.length) * 1000) / 1000, wilson: wilson(k, idx.length), errors: idx.filter((i) => models[m]![i].error).length }
  }
  const SPLITS = ['seen', 'reworded', 'unseen'] as const
  const summary = Object.fromEntries(Object.keys(models).map((m) => [m, {
    all: group(m as Model, () => true),
    split: Object.fromEntries(SPLITS.map((s) => [s, group(m as Model, (e) => e.split === s)])),
  }]))
  const count = (m: Model, f: string) => (models[m] ? group(m, (e) => e.family === f).right : null)
  const families = [...new Set(test.map((e) => e.family))].map((f) => ({ family: f, trained: test.find((e) => e.family === f)!.split !== 'unseen', of: test.filter((e) => e.family === f).length, base: count('base', f), tuned: count('tuned', f) }))
  // the kind of question tuning cost the most on, among those it never trained on, with one question that shows it
  const worst = models.base && models.tuned ? [...families].filter((f) => !f.trained).sort((x, y) => (y.base! - y.tuned!) - (x.base! - x.tuned!))[0] : null
  const worstExample = worst && test.map((e, i) => ({ e, i })).find(({ e, i }) => e.family === worst.family && models.base![i].right && !models.tuned![i].right)
  const questions = test.map((e, i) => ({ id: e.id, family: e.family, split: e.split, question: e.question, gold: e.sql, ...Object.fromEntries(Object.keys(models).map((m) => [m, { sql: models[m as Model]![i].sql, right: models[m as Model]![i].right, error: models[m as Model]![i].error }])) }))
  const train = existsSync(here('../runs/train.json')) ? JSON.parse(readFileSync(here('../runs/train.json'), 'utf8')) : null
  const runs = Object.fromEntries(Object.keys(models).map((m) => [m, JSON.parse(readFileSync(here(`../eval/run-${m}.json`), 'utf8'))]))
  return {
    test: { questions: test.length, split: Object.fromEntries(SPLITS.map((s) => [s, test.filter((e) => e.split === s).length])) },
    trainExamples: lines('../data/train.jsonl').length,
    summary, families, questions,
    worst: worst && worstExample ? { ...worst, question: worstExample.e.question, gold: worstExample.e.sql, base: models.base![worstExample.i].sql, tuned: models.tuned![worstExample.i].sql, baseRight: worst.base, tunedRight: worst.tuned } : null,
    training: train && { base: train.base, revision: train.revision, examples: train.examples, steps: train.steps, seconds: train.seconds, trainable: train.trainable_parameters, total: train.total_parameters, peakMemoryMb: train.peak_memory_mb, gpu: train.gpu, settings: train.settings, adapterSha256: train.adapter_sha256, adapterBytes: train.adapter_bytes, loss: train.loss.map((l: { step: number; loss: number }) => [l.step, l.loss]) },
    runs,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = await score()
  mkdirSync(here('../src/generated'), { recursive: true })
  writeFileSync(here('../src/generated/measure.json'), JSON.stringify(m, null, 1) + '\n')
  for (const [k, s] of Object.entries(m.summary)) console.log(k, 'all', s.all.right, '/', s.all.of, '| seen', s.split.seen.right, '/', s.split.seen.of, 'reworded', s.split.reworded.right, '/', s.split.reworded.of, 'unseen', s.split.unseen.right, '/', s.split.unseen.of, '| errors', s.all.errors)
}
