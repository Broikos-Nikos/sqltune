/**
 * The prompt every model sees, the base one and the tuned one alike: the schema,
 * the values the columns hold, and one question. A model that is not told the
 * countries are stored as two letter codes cannot be blamed for writing 'Greece',
 * so the values are in the prompt and the comparison is about what a model makes
 * of them, not about what it could not know.
 */

export const SYSTEM = 'You write one SQLite query that answers the question about the shop database. Reply with the SQL only, no explanation.'

export const SCHEMA = `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT, country TEXT, created_at TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, total REAL, status TEXT, created_at TEXT);
CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, qty INTEGER, price REAL);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER, category TEXT);
CREATE TABLE shipments (id INTEGER PRIMARY KEY, order_id INTEGER, carrier TEXT, status TEXT, shipped_at TEXT);

Values: customers.country is one of 'GR', 'DE', 'FR', 'IT', 'ES', 'NL'. orders.status is one of 'new', 'paid', 'shipped', 'cancelled'. products.category is one of 'toys', 'books', 'garden', 'kitchen', 'sport', 'music', 'office', 'pets'. shipments.carrier is one of 'elta', 'acs', 'dhl', 'ups'. shipments.status is one of 'packed', 'moving', 'delivered'. Dates are text, 'YYYY-MM-DD', all in 2026. Amounts are in euros.`

export const user = (question: string) => `${SCHEMA}\n\nQuestion: ${question}`
