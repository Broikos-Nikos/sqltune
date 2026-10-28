/**
 * The questions, as 32 families. A family is one kind of question with its gold
 * SQL, written once, and three ways of asking it. Slots are filled from the
 * shop's own values.
 *
 * The first 24 families are trained on, the last 8 never are, so the test can
 * ask what a fine tuned model does with a kind of question it has not seen. Each
 * trained family also keeps its third wording out of training, to ask what it
 * does with a familiar question in new words.
 */

export type Slot = 'country' | 'status' | 'category' | 'carrier' | 'month' | 'top' | 'stock' | 'amount' | 'customer' | 'order'
export type Family = { id: string; slots: Slot[]; sql: string; en: [string, string, string] }

/** A slot value: what goes into the SQL, and how it is said. */
export type Value = { sql: string; en: string }

const countries: [string, string][] = [['GR', 'Greece'], ['DE', 'Germany'], ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['NL', 'the Netherlands']]
const statuses: [string, string][] = [['new', 'new'], ['paid', 'paid'], ['shipped', 'shipped'], ['cancelled', 'cancelled']]
const categories: [string, string][] = [['toys', 'toys'], ['books', 'books'], ['garden', 'garden'], ['kitchen', 'kitchen'], ['sport', 'sport'], ['music', 'music'], ['office', 'office'], ['pets', 'pets']]
const carriers: [string, string][] = [['elta', 'ELTA'], ['acs', 'ACS'], ['dhl', 'DHL'], ['ups', 'UPS']]
const months: [string, string][] = [['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'], ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'], ['09', 'September']]

const v = (rows: [string, string][]): Value[] => rows.map(([sql, en]) => ({ sql, en }))
const n = (xs: number[]): Value[] => xs.map((x) => ({ sql: String(x), en: String(x) }))

export const VALUES: Record<Slot, Value[]> = {
  country: v(countries), status: v(statuses), category: v(categories), carrier: v(carriers), month: v(months),
  top: n([3, 5, 10]), stock: n([10, 20, 50, 100]), amount: n([100, 250, 500, 800]),
  customer: n([3, 7, 12, 18, 25, 31, 44, 52]), order: n([5, 17, 42, 66, 93, 120, 151, 188]),
}

export const FAMILIES: Family[] = [
  // trained
  { id: 'orders_by_status', slots: ['status'], sql: "SELECT count(*) FROM orders WHERE status = '{status}'",
    en: ['How many orders are {status}?', 'Count the {status} orders.', 'What is the number of orders with status {status}?'] },
  { id: 'customers_in_country', slots: ['country'], sql: "SELECT count(*) FROM customers WHERE country = '{country}'",
    en: ['How many customers are from {country}?', 'Count our customers in {country}.', 'What is the number of customers based in {country}?'] },
  { id: 'revenue_by_status', slots: ['status'], sql: "SELECT sum(total) FROM orders WHERE status = '{status}'",
    en: ['What is the total value of the {status} orders?', 'Sum the totals of all {status} orders.', 'How much money do the {status} orders add up to?'] },
  { id: 'avg_order_country', slots: ['country'], sql: "SELECT avg(o.total) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = '{country}'",
    en: ['What is the average order total for customers in {country}?', 'Average order value from {country}.', 'On average, how much is an order placed by a customer from {country}?'] },
  { id: 'top_products_revenue', slots: ['top'], sql: 'SELECT p.name FROM order_items oi JOIN products p ON p.id = oi.product_id GROUP BY p.id ORDER BY sum(oi.qty * oi.price) DESC, p.id LIMIT {top}',
    en: ['Which {top} products brought in the most revenue?', 'Top {top} products by sales revenue.', 'Name the {top} best selling products by money earned.'] },
  { id: 'products_in_category', slots: ['category'], sql: "SELECT name FROM products WHERE category = '{category}'",
    en: ['List the products in the {category} category.', 'Which products do we sell under {category}?', 'Show every product filed under {category}.'] },
  { id: 'low_stock', slots: ['stock'], sql: 'SELECT name FROM products WHERE stock < {stock}',
    en: ['Which products have fewer than {stock} units in stock?', 'List products with stock below {stock}.', 'What is running low, under {stock} units left?'] },
  { id: 'orders_in_month', slots: ['month'], sql: "SELECT count(*) FROM orders WHERE strftime('%m', created_at) = '{month}'",
    en: ['How many orders were placed in {month}?', 'Count the orders created in {month}.', 'What was the order count for {month}?'] },
  { id: 'shipments_by_carrier', slots: ['carrier'], sql: "SELECT count(*) FROM shipments WHERE carrier = '{carrier}'",
    en: ['How many shipments went with {carrier}?', 'Count the shipments handled by {carrier}.', 'How many parcels did {carrier} carry for us?'] },
  { id: 'delivered_by_carrier', slots: ['carrier'], sql: "SELECT count(*) FROM shipments WHERE carrier = '{carrier}' AND status = 'delivered'",
    en: ['How many {carrier} shipments have been delivered?', 'Count delivered shipments sent with {carrier}.', 'Of the parcels {carrier} carried, how many arrived?'] },
  { id: 'customers_without_orders', slots: [], sql: 'SELECT name FROM customers WHERE id NOT IN (SELECT customer_id FROM orders)',
    en: ['Which customers have never placed an order?', 'List customers with no orders.', 'Who signed up but never bought anything?'] },
  { id: 'largest_order', slots: [], sql: 'SELECT max(total) FROM orders',
    en: ['What is the largest order total?', 'Show the biggest single order amount.', 'How much was our most expensive order?'] },
  { id: 'orders_of_customer', slots: ['customer'], sql: 'SELECT count(*) FROM orders WHERE customer_id = {customer}',
    en: ['How many orders has customer {customer} placed?', 'Count the orders of customer number {customer}.', 'How often has customer {customer} ordered from us?'] },
  { id: 'revenue_per_country', slots: [], sql: 'SELECT c.country, sum(o.total) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.country',
    en: ['What is the revenue per country?', 'Break down order totals by customer country.', 'How much did each country spend with us?'] },
  { id: 'category_revenue', slots: ['category'], sql: "SELECT sum(oi.qty * oi.price) FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.category = '{category}'",
    en: ['How much revenue came from {category} products?', 'Total sales of the {category} category.', 'What did we earn selling {category} items?'] },
  { id: 'orders_above', slots: ['amount'], sql: 'SELECT count(*) FROM orders WHERE total > {amount}',
    en: ['How many orders are worth more than {amount} euros?', 'Count orders with a total above {amount}.', 'How many orders cost over {amount}?'] },
  { id: 'avg_price_category', slots: ['category'], sql: "SELECT avg(price) FROM products WHERE category = '{category}'",
    en: ['What is the average price of {category} products?', 'Average list price in {category}.', 'How much does a {category} product cost on average?'] },
  { id: 'units_in_order', slots: ['order'], sql: 'SELECT sum(qty) FROM order_items WHERE order_id = {order}',
    en: ['How many items are in order {order}?', 'Count the units in order number {order}.', 'How many pieces did order {order} contain?'] },
  { id: 'top_customers', slots: ['top'], sql: 'SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY sum(o.total) DESC, c.id LIMIT {top}',
    en: ['Who are our top {top} customers by spending?', 'List the {top} customers who spent the most.', 'Which {top} customers bring in the most money?'] },
  { id: 'paid_not_shipped', slots: [], sql: "SELECT id FROM orders WHERE status = 'paid' AND id NOT IN (SELECT order_id FROM shipments)",
    en: ['Which paid orders have no shipment yet?', 'List paid orders that were never shipped.', 'What has been paid for but not sent?'] },
  { id: 'signups_in_month', slots: ['month'], sql: "SELECT count(*) FROM customers WHERE strftime('%m', created_at) = '{month}'",
    en: ['How many customers signed up in {month}?', 'Count new customer accounts from {month}.', 'How many people registered in {month}?'] },
  { id: 'priciest_in_category', slots: ['category'], sql: "SELECT name FROM products WHERE category = '{category}' ORDER BY price DESC, id LIMIT 1",
    en: ['What is the most expensive product in {category}?', 'Which {category} product has the highest price?', 'Name the priciest item under {category}.'] },
  { id: 'orders_per_status', slots: [], sql: 'SELECT status, count(*) FROM orders GROUP BY status',
    en: ['How many orders are there per status?', 'Give the order count for each status.', 'Break the orders down by status.'] },
  { id: 'shipments_to_country', slots: ['country'], sql: "SELECT count(*) FROM shipments s JOIN orders o ON o.id = s.order_id JOIN customers c ON c.id = o.customer_id WHERE c.country = '{country}'",
    en: ['How many shipments went to customers in {country}?', 'Count parcels sent to {country}.', 'How many deliveries were addressed to {country}?'] },

  // never trained on
  { id: 'avg_units_per_order', slots: [], sql: 'SELECT avg(n) FROM (SELECT sum(qty) AS n FROM order_items GROUP BY order_id)',
    en: ['How many units does an order contain on average?', 'Average number of items per order.', 'What is the mean basket size in units?'] },
  { id: 'least_sold', slots: [], sql: 'SELECT p.name FROM products p JOIN order_items oi ON oi.product_id = p.id GROUP BY p.id ORDER BY sum(oi.qty), p.id LIMIT 1',
    en: ['Which product has sold the fewest units?', 'Name the slowest selling product by units sold.', 'What sells least, counted in units?'] },
  { id: 'country_most_orders', slots: [], sql: 'SELECT c.country FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.country ORDER BY count(*) DESC, c.country LIMIT 1',
    en: ['Which country places the most orders?', 'Name the country with the highest order count.', 'Where do most of our orders come from?'] },
  { id: 'cancelled_value_month', slots: ['month'], sql: "SELECT sum(total) FROM orders WHERE status = 'cancelled' AND strftime('%m', created_at) = '{month}'",
    en: ['What was the value of the orders cancelled in {month}?', 'Sum the totals of cancelled orders from {month}.', 'How much money did cancellations cost us in {month}?'] },
  { id: 'carrier_most_delivered', slots: [], sql: "SELECT carrier FROM shipments WHERE status = 'delivered' GROUP BY carrier ORDER BY count(*) DESC, carrier LIMIT 1",
    en: ['Which carrier has delivered the most shipments?', 'Name the courier with the most completed deliveries.', 'Who delivers the most of our parcels successfully?'] },
  { id: 'country_of_order', slots: ['order'], sql: 'SELECT c.country FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = {order}',
    en: ['Which country did order {order} come from?', 'What is the customer country for order {order}?', 'Where is the buyer of order number {order} based?'] },
  { id: 'units_in_category', slots: ['category'], sql: "SELECT sum(oi.qty) FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE p.category = '{category}'",
    en: ['How many units of {category} products have been sold?', 'Count the units sold in {category}.', 'How many {category} items left the warehouse in orders?'] },
  { id: 'orders_per_customer_country', slots: ['country'], sql: "SELECT avg(n) FROM (SELECT count(o.id) AS n FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE c.country = '{country}' GROUP BY c.id)",
    en: ['On average, how many orders has each customer from {country} placed?', 'Average number of orders per customer in {country}.', 'How many orders does a typical customer from {country} make?'] },
]

export const TRAINED = 24

export function fill(text: string, values: Partial<Record<Slot, Value>>, as: 'en' | 'sql'): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const val = values[k as Slot]
    if (!val) throw new Error(`no value for {${k}}`)
    return as === 'sql' ? val.sql : val.en
  })
}
