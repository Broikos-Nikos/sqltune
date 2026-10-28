/**
 * What may not ship in a source file, whatever the code around it does.
 *
 *   npm run check:source
 *
 * 1. **An invisible character.** In a sibling repository a regex meant to hold
 *    `\b` arrived through a shell heredoc as a real backspace byte, so the gate
 *    it belonged to could never match anything and passed for days. A character
 *    nobody can see is a character nobody can review: one that is wanted is
 *    written as an escape. Counted: the C0 controls but tab, newline and
 *    carriage return, the spaces nobody can tell from a space (U+00A0, U+2000 to U+200A,
 *    U+202F, U+205F, U+3000), U+200B to U+200F, and the byte order mark.
 * 2. **A path on the machine that wrote it.** `C:\` or a home directory in a
 *    shipped file is a leak and a build that only works there.
 * 3. **A dash used as punctuation** in prose a reader sees: the README, the HTML
 *    and the page script's strings. A spaced hyphen, or an en or em dash anywhere.
 */
import { readFileSync, globSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00a0\u2000-\u200f\u202f\u205f\u3000\ufeff]/
const LOCAL_PATH = /[A-Za-z]:[\\/](?:Users|xampp|Windows)|\/(?:home|Users)\/[a-z]/i
const EN_EM = /[\u2013\u2014]/
const SPACED_HYPHEN = / -{1,2} /

const files = [
  ...globSync('src/**/*.{ts,css}', { cwd: root }),
  ...globSync('tools/**/*.{ts,mjs}', { cwd: root }),
  'index.html', 'README.md', 'package.json', 'vite.config.ts', '.github/workflows/pages.yml',
  ...globSync('docs/**/*.{md,json}', { cwd: root }),
  ...globSync('train/*.{py,toml}', { cwd: root }),
]
const prose = new Set(['README.md', 'index.html', ...globSync('docs/**/*.md', { cwd: root })])

const fails: string[] = []
for (const rel of files) {
  let text: string
  try { text = readFileSync(resolve(root, rel), 'utf8') } catch { continue }
  let inCode = false
  text.split('\n').forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    if (INVISIBLE.test(line)) fails.push(`${at} carries an invisible character: write it as an escape`)
    // this file names the patterns it looks for, so it is the one place they may appear
    if (rel.endsWith('check-source.ts')) return
    if (LOCAL_PATH.test(line)) fails.push(`${at} names a path on this machine: ${line.trim().slice(0, 80)}`)
    if (EN_EM.test(line)) fails.push(`${at} has an en or em dash`)
    if (/^\s*```/.test(line)) inCode = !inCode
    if (prose.has(rel) && !inCode && SPACED_HYPHEN.test(line.replace(/`[^`]*`/g, ''))) fails.push(`${at} uses a hyphen as a dash: ${line.trim().slice(0, 80)}`)
  })
}
if (fails.length) { console.error(fails.map((f) => 'FAIL  ' + f).join('\n')); process.exit(1) }
console.log(`check:source ok: ${files.length} files, no invisible character, no local path, no dash as punctuation`)
