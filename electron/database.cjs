const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DEFAULT_ADMIN_EMAIL = 'admin@gmail.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123*';
const PASSWORD_KEY_LENGTH = 64;

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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('businessName', 'Pollo & Caja'),
      ('currency', 'ARS'),
      ('lowStockThreshold', '10');
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
  `);
  const admin = database.prepare('SELECT id FROM users WHERE email = ?').get(DEFAULT_ADMIN_EMAIL);
  if (!admin) {
    const password = hashPassword(DEFAULT_ADMIN_PASSWORD);
    database.prepare('INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)').run(DEFAULT_ADMIN_EMAIL, password.hash, password.salt);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
}

function validateEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error('El correo electrónico no es válido.');
  return email.trim().toLowerCase();
}

function verifyPassword(password, record) {
  const derived = crypto.scryptSync(password, Buffer.from(record.password_salt, 'hex'), PASSWORD_KEY_LENGTH);
  const stored = Buffer.from(record.password_hash, 'hex');
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived);
}

function authenticateAdmin(email, password) {
  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  const record = getDatabase().prepare('SELECT password_hash, password_salt FROM users WHERE email = ?').get(normalizedEmail);
  return Boolean(record && verifyPassword(password, record));
}

function changeAdminPassword(currentPassword, newPassword) {
  validatePassword(currentPassword);
  validatePassword(newPassword);
  if (!authenticateAdmin(DEFAULT_ADMIN_EMAIL, currentPassword)) throw new Error('La contraseña actual es incorrecta.');
  const password = hashPassword(newPassword);
  getDatabase().prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?').run(password.hash, password.salt, DEFAULT_ADMIN_EMAIL);
  return { changed: true };
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

function listSales(limit = 100, filters = {}) {
  const database = getDatabase();
  const conditions = []; const params = [];
  if (filters.from) { conditions.push("date(s.created_at) >= date(?)"); params.push(filters.from); }
  if (filters.to) { conditions.push("date(s.created_at) <= date(?)"); params.push(filters.to); }
  if (filters.paymentMethod && filters.paymentMethod !== 'all') { conditions.push('s.payment_method = ?'); params.push(filters.paymentMethod); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return database.prepare(`SELECT s.* FROM sales s ${where} ORDER BY datetime(s.created_at) DESC LIMIT ?`).all(...params, limit).map((sale) => ({ ...sale, items: database.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id) }));
}
function getSalesAnalytics(filters = {}) {
  const database = getDatabase();
  const sales = listSales(10000, filters);
  const byDay = database.prepare(`SELECT date(created_at) AS day, COALESCE(SUM(total_cents),0) AS total_cents, COUNT(*) AS orders FROM sales WHERE date(created_at) BETWEEN date(?) AND date(?) GROUP BY date(created_at) ORDER BY day`).all(filters.from, filters.to);
  const byPayment = database.prepare(`SELECT payment_method, COALESCE(SUM(total_cents),0) AS total_cents, COUNT(*) AS orders FROM sales WHERE date(created_at) BETWEEN date(?) AND date(?) GROUP BY payment_method`).all(filters.from, filters.to);
  const byProduct = database.prepare(`SELECT product_name, SUM(quantity) AS quantity, SUM(subtotal_cents) AS total_cents FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE date(s.created_at) BETWEEN date(?) AND date(?) GROUP BY product_name ORDER BY total_cents DESC LIMIT 5`).all(filters.from, filters.to);
  return { sales, byDay, byPayment, byProduct, totalCents: sales.reduce((sum, sale) => sum + sale.total_cents, 0), orders: sales.length };
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
function openCashRegister(amountCents) {
  const database = getDatabase();
  const active = database.prepare("SELECT * FROM cash_movements WHERE type = 'opening' AND date(created_at) = date('now', 'localtime') ORDER BY id DESC LIMIT 1").get();
  if (active) throw new Error('La caja ya fue abierta hoy.');
  const result = database.prepare("INSERT INTO cash_movements (type, amount_cents, description) VALUES ('opening', ?, 'Apertura de caja')").run(amountCents);
  return database.prepare('SELECT * FROM cash_movements WHERE id = ?').get(result.lastInsertRowid);
}
function getCashRegister() {
  const database = getDatabase();
  const opening = database.prepare("SELECT * FROM cash_movements WHERE type = 'opening' AND date(created_at) = date('now', 'localtime') ORDER BY id DESC LIMIT 1").get();
  const movements = database.prepare("SELECT * FROM cash_movements WHERE date(created_at) = date('now', 'localtime') ORDER BY datetime(created_at) DESC, id DESC").all();
  const balanceCents = movements.reduce((sum, movement) => sum + movement.amount_cents, 0);
  return { opening, movements, balanceCents, isOpen: Boolean(opening) };
}
function closeCashRegister(countedCents) {
  const register = getCashRegister();
  if (!register.isOpen) throw new Error('La caja no está abierta.');
  const differenceCents = countedCents - register.balanceCents;
  const result = getDatabase().prepare("INSERT INTO cash_movements (type, amount_cents, description) VALUES ('adjustment', ?, ?)").run(differenceCents, `Cierre de caja · Diferencia ${differenceCents / 100}`);
  return { id: Number(result.lastInsertRowid), expectedCents: register.balanceCents, countedCents, differenceCents };
}

function getSettings() {
  const rows = getDatabase().prepare('SELECT key, value FROM settings').all();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { businessName: values.businessName || 'Pollo & Caja', currency: values.currency || 'ARS', lowStockThreshold: Number(values.lowStockThreshold) || 10 };
}

function updateSettings(input) {
  const businessName = String(input.businessName || '').trim();
  const currency = String(input.currency || '').trim().toUpperCase();
  const lowStockThreshold = Number(input.lowStockThreshold);
  if (!businessName || businessName.length > 100) throw new Error('El nombre del negocio debe tener entre 1 y 100 caracteres.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('La moneda debe ser un código de 3 letras.');
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 100000) throw new Error('El umbral de stock no es válido.');
  const database = getDatabase();
  const save = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  database.transaction(() => { save.run('businessName', businessName); save.run('currency', currency); save.run('lowStockThreshold', String(lowStockThreshold)); })();
  return getSettings();
}

function getDashboardSummary() {
  const database = getDatabase();
  return {
    salesTodayCents: database.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS value FROM sales WHERE date(created_at) = date('now', 'localtime')`).get().value,
    ordersToday: database.prepare(`SELECT COUNT(*) AS value FROM sales WHERE date(created_at) = date('now', 'localtime')`).get().value,
    expensesTodayCents: database.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS value FROM expenses WHERE date(created_at) = date('now', 'localtime')`).get().value,
    lowStock: database.prepare('SELECT * FROM products WHERE active = 1 AND stock <= ? ORDER BY stock, name').all(getSettings().lowStockThreshold),
  };
}

module.exports = { getDatabase, listProducts, createProduct, updateProduct, createSale, getSale, listSales, createExpense, listExpenses, getDashboardSummary, getSettings, updateSettings, authenticateAdmin, changeAdminPassword, openCashRegister, getCashRegister, closeCashRegister };
