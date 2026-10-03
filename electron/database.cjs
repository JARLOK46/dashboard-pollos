const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let db;

function getDatabase() {
  if (db) return db;
  const directory = app.getPath('userData');
  fs.mkdirSync(directory, { recursive: true });
  db = new Database(path.join(directory, 'pollo-caja.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      image_path TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card')),
      amount_received_cents INTEGER NOT NULL CHECK (amount_received_cents >= 0),
      change_cents INTEGER NOT NULL DEFAULT 0 CHECK (change_cents >= 0),
      customer_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      category TEXT NOT NULL DEFAULT 'other',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('opening', 'sale', 'expense', 'withdrawal', 'adjustment')),
      amount_cents INTEGER NOT NULL,
      reference_id INTEGER,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
  `);
}

function listProducts() {
  return getDatabase().prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
}

function createProduct(input) {
  const result = getDatabase().prepare(`INSERT INTO products (name, description, price_cents, stock, image_path) VALUES (?, ?, ?, ?, ?)`).run(input.name, input.description || '', input.priceCents, input.stock || 0, input.imagePath || null);
  return getDatabase().prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
}

function updateProduct(input) {
  getDatabase().prepare(`UPDATE products SET name = ?, description = ?, price_cents = ?, stock = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(input.name, input.description || '', input.priceCents, input.stock, input.imagePath || null, input.id);
  return getDatabase().prepare('SELECT * FROM products WHERE id = ?').get(input.id);
}

function createSale(input) {
  const database = getDatabase();
  const create = database.transaction(() => {
    const sale = database.prepare(`INSERT INTO sales (total_cents, payment_method, amount_received_cents, change_cents, customer_name, notes) VALUES (?, ?, ?, ?, ?, ?)`).run(input.totalCents, input.paymentMethod, input.amountReceivedCents, input.changeCents, input.customerName || '', input.notes || '');
    const insertItem = database.prepare(`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?, ?)`);
    const updateStock = database.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?');
    const movement = database.prepare(`INSERT INTO cash_movements (type, amount_cents, reference_id, description) VALUES ('sale', ?, ?, ?)`);
    for (const item of input.items) {
      const changed = updateStock.run(item.quantity, item.productId, item.quantity);
      if (changed.changes !== 1) throw new Error(`Insufficient stock for product ${item.productId}`);
      insertItem.run(sale.lastInsertRowid, item.productId, item.productName, item.quantity, item.unitPriceCents, item.subtotalCents);
    }
    movement.run(input.paymentMethod === 'cash' ? input.totalCents : 0, sale.lastInsertRowid, `Sale #${sale.lastInsertRowid}`);
    return sale.lastInsertRowid;
  })();
  return getSale(Number(create));
}

function getSale(id) {
  const database = getDatabase();
  const sale = database.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) return null;
  return { ...sale, items: database.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) };
}

function listSales(limit = 100) {
  return getDatabase().prepare('SELECT * FROM sales ORDER BY datetime(created_at) DESC LIMIT ?').all(limit).map((sale) => ({ ...sale, items: getDatabase().prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id) }));
}

function createExpense(input) {
  const database = getDatabase();
  const result = database.transaction(() => {
    const expense = database.prepare(`INSERT INTO expenses (description, amount_cents, category, notes) VALUES (?, ?, ?, ?)`).run(input.description, input.amountCents, input.category || 'other', input.notes || '');
    database.prepare(`INSERT INTO cash_movements (type, amount_cents, reference_id, description) VALUES ('expense', ?, ?, ?)`).run(-input.amountCents, expense.lastInsertRowid, input.description);
    return expense.lastInsertRowid;
  })();
  return database.prepare('SELECT * FROM expenses WHERE id = ?').get(result);
}

function listExpenses(limit = 100) { return getDatabase().prepare('SELECT * FROM expenses ORDER BY datetime(created_at) DESC LIMIT ?').all(limit); }
function getDashboardSummary() {
  const database = getDatabase();
  return {
    salesTodayCents: database.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS value FROM sales WHERE date(created_at) = date('now', 'localtime')`).get().value,
    ordersToday: database.prepare(`SELECT COUNT(*) AS value FROM sales WHERE date(created_at) = date('now', 'localtime')`).get().value,
    expensesTodayCents: database.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS value FROM expenses WHERE date(created_at) = date('now', 'localtime')`).get().value,
    lowStock: database.prepare('SELECT * FROM products WHERE active = 1 AND stock <= 10 ORDER BY stock, name').all(),
  };
}

module.exports = { getDatabase, listProducts, createProduct, updateProduct, createSale, getSale, listSales, createExpense, listExpenses, getDashboardSummary };
