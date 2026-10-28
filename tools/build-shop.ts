/**
 * Writes data/shop.sqlite from the seeded shop and its hash beside it. Every
 * score in this repository comes from running SQL on that file.
 *
 *   npm run build:shop
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { seedShop } from './shop.ts'

const out = fileURLToPath(new URL('../data/shop.sqlite', import.meta.url))
rmSync(out, { force: true })
const db = seedShop()
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`)
db.close()
const sha = createHash('sha256').update(readFileSync(out)).digest('hex')
writeFileSync(fileURLToPath(new URL('../data/shop.sqlite.sha256', import.meta.url)), sha + '\n')
console.log('wrote data/shop.sqlite', sha.slice(0, 12))
