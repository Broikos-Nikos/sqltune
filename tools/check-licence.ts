/**
 * The repository carries the licence its README claims.
 *
 *   npm run check:licence
 *
 * Three repositories in this author's workspace once said MIT in prose with no
 * LICENSE file behind it, and one shipped a licence with its template
 * placeholders still in. The sentence at the bottom of a README is a claim like
 * any other, so this reads the claim out of the README and holds the file to it:
 * the file exists, says MIT, names a holder and a year, and has no placeholder.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
const fails: string[] = []

if (!/\bMIT\b/.test(readme)) fails.push('the README names no licence')
const path = resolve(root, 'LICENSE')
if (!existsSync(path)) fails.push('the README claims MIT and there is no LICENSE file')
else {
  const text = readFileSync(path, 'utf8')
  if (!/^MIT License/.test(text)) fails.push('LICENSE does not start with "MIT License"')
  if (!/Copyright \(c\) 20\d\d \S+/.test(text)) fails.push('LICENSE names no year and holder')
  if (/\[(year|yyyy|fullname|name of copyright owner)\]/i.test(text)) fails.push('LICENSE still has a template placeholder')
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  if (pkg.license !== 'MIT') fails.push(`package.json says ${pkg.license}, the README says MIT`)
}
if (fails.length) { console.error(fails.map((f) => 'FAIL  ' + f).join('\n')); process.exit(1) }
console.log('check:licence ok: README, LICENSE and package.json all say MIT, with a holder and no placeholder')
