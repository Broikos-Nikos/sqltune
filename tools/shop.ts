/**
 * The shop the questions are asked about: the same seeded rows as sqlguard's
 * shop, without its admin table and its card numbers, which no question here
 * needs. Every run builds the same rows from a fixed PRNG, and
 * `npm run build:shop` writes them to data/shop.sqlite, the database every
 * predicted query is executed on.
 */
import { DatabaseSync } from 'node:sqlite'

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const CATEGORIES = ['toys', 'books', 'garden', 'kitchen', 'sport', 'music', 'office', 'pets']
export const COUNTRIES = ['GR', 'DE', 'FR', 'IT', 'ES', 'NL']
export const STATUSES = ['new', 'paid', 'shipped', 'cancelled']
export const CARRIERS = ['elta', 'acs', 'dhl', 'ups']

export function seedShop(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  const r = mulberry32(2026)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT, country TEXT, created_at TEXT);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, total REAL, status TEXT, created_at TEXT);
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, qty INTEGER, price REAL);
    CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER, category TEXT);
    CREATE TABLE shipments (id INTEGER PRIMARY KEY, order_id INTEGER, carrier TEXT, status TEXT, shipped_at TEXT);
  `)
  const date = (n: number) => `2026-${String(1 + (n % 9)).padStart(2, '0')}-${String(1 + ((n * 7) % 27)).padStart(2, '0')}`
  const ins = (sql: string) => db.prepare(sql)
  const c = ins('INSERT INTO customers VALUES (?,?,?,?,?)')
  for (let i = 1; i <= 60; i++) c.run(i, `Customer ${i}`, `c${i}@example.test`, pick(COUNTRIES), date(i))
  const p = ins('INSERT INTO products VALUES (?,?,?,?,?)')
  for (let i = 1; i <= 30; i++) p.run(i, `Product ${i}`, Math.round((5 + r() * 95) * 100) / 100, Math.floor(r() * 200), CATEGORIES[i % CATEGORIES.length])
  const o = ins('INSERT INTO orders VALUES (?,?,?,?,?)')
  for (let i = 1; i <= 200; i++) o.run(i, 1 + Math.floor(r() * 60), Math.round(r() * 90000) / 100, pick(STATUSES), date(i))
  const it = ins('INSERT INTO order_items VALUES (?,?,?,?,?)')
  for (let i = 1; i <= 500; i++) it.run(i, 1 + Math.floor(r() * 200), 1 + Math.floor(r() * 30), 1 + Math.floor(r() * 5), Math.round((5 + r() * 95) * 100) / 100)
  const s = ins('INSERT INTO shipments VALUES (?,?,?,?,?)')
  for (let i = 1; i <= 150; i++) s.run(i, i, pick(CARRIERS), pick(['packed', 'moving', 'delivered']), date(i + 3))
  return db
}
