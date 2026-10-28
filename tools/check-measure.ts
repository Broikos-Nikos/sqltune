/**
 * Holds every committed file the scores rest on to the code and to each other,
 * then re-scores the committed answers and holds the result to what is committed.
 * Nothing here needs a GPU, so CI runs all of it.
 *
 * - the shop database and the dataset are the committed ones, by hash, and the
 *   dataset is what tools/build-dataset.ts builds;
 * - the base and the tuned answers came from the pinned base model revision,
 *   and the tuned answers from the adapter that is committed (by its hash, as
 *   both the training run and the prediction run recorded it);
 * - scoring the committed answers again gives src/generated/measure.json.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { build } from './build-dataset.ts'
import { score } from './score.ts'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const sha = (p: string) => createHash('sha256').update(readFileSync(here(p))).digest('hex')
const json = (p: string) => JSON.parse(readFileSync(here(p), 'utf8'))
const fail: string[] = []

if (sha('../data/shop.sqlite') !== readFileSync(here('../data/shop.sqlite.sha256'), 'utf8').trim()) fail.push('data/shop.sqlite does not match its hash: run `npm run build:shop`')
for (const line of readFileSync(here('../data/dataset.sha256'), 'utf8').trim().split('\n')) {
  const [want, file] = line.split(/\s+/)
  if (sha(`../data/${file}`) !== want) fail.push(`data/${file} does not match data/dataset.sha256`)
}
const { train, test } = build()
const asLines = (rows: unknown[]) => rows.map((e) => JSON.stringify(e)).join('\n') + '\n'
if (asLines(train) !== readFileSync(here('../data/train.jsonl'), 'utf8')) fail.push('data/train.jsonl is not what tools/build-dataset.ts builds: run `npm run build:dataset`')
if (asLines(test) !== readFileSync(here('../data/test.jsonl'), 'utf8')) fail.push('data/test.jsonl is not what tools/build-dataset.ts builds: run `npm run build:dataset`')

const revision = readFileSync(here('../train/common.py'), 'utf8').match(/REVISION = "([0-9a-f]{40})"/)?.[1]
const trainRun = json('../runs/train.json'), base = json('../eval/run-base.json'), tuned = json('../eval/run-tuned.json')
for (const [name, run] of [['training', trainRun], ['base answers', base], ['tuned answers', tuned]] as const) if (run.revision !== revision) fail.push(`the ${name} used revision ${run.revision}, train/common.py pins ${revision}`)
const adapter = sha('../adapter/adapter_model.safetensors')
if (trainRun.adapter_sha256 !== adapter) fail.push('adapter/adapter_model.safetensors is not the adapter the training run wrote')
if (tuned.adapter_sha256 !== adapter) fail.push('the tuned answers were not made with the committed adapter')
if (base.adapter_sha256 !== null) fail.push('the base answers were made with an adapter')
if (base.questions !== test.length || tuned.questions !== test.length) fail.push('an answer file does not cover every test question')

const now = await score()
if (JSON.stringify(now) !== JSON.stringify(json('../src/generated/measure.json'))) fail.push('src/generated/measure.json is not what scoring the committed answers gives: run `npm run score`')

if (fail.length) { console.error(fail.map((x) => 'FAIL ' + x).join('\n')); process.exit(1) }
const p = (x: number) => (x * 100).toFixed(1) + '%'
console.log(`check:measure ok: ${test.length} questions re-scored on the committed database; base ${p(now.summary.base.all.rate)}, tuned ${p(now.summary.tuned.all.rate)}; adapter ${adapter.slice(0, 12)} is the one trained and the one predicted with`)
