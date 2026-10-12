const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DEFAULT_ADMIN_EMAIL = 'admin@gmail.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123*';
const PASSWORD_KEY_LENGTH = 64;
const SCHEMA_VERSION = 6;
const AUTOMATIC_BACKUP_RETENTION = 7;
const AUTOMATIC_BACKUP_PREFIX = 'pollo-caja-auto-';
const OLLAMA_MODELS = [
  'gpt-oss:20b',
  'gpt-oss:120b',
  'gemma4:31b',
  'nemotron-3-nano:30b',
  'nemotron-3-super',
  'nemotron-3-ultra',
];
const REQUIRED_TABLES = [
  'products',
  'sales',
  'sale_items',
  'sale_voids',
  'expenses',
  'cash_registers',
  'cash_movements',
  'settings',
  'users',
  'inventory_movements',
  'ai_sessions',
  'ai_messages',
  'audit_logs',
];

let db;

function getDatabasePath() {
  return path.join(app.getPath('userData'), 'pollo-caja.sqlite');
}

function getDatabase() {
  if (db) return db;
  const directory = app.getPath('userData');
  fs.mkdirSync(directory, { recursive: true });
  db = new Database(getDatabasePath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function getBusinessDate() {
  return getDatabase().prepare("SELECT date('now', 'localtime') AS business_date").get()
    .business_date;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
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
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
      voided_at TEXT,
      void_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sale_voids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
      unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
      cost_total_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_total_cents >= 0)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      category TEXT NOT NULL DEFAULT 'other',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_date TEXT NOT NULL UNIQUE,
      opening_cents INTEGER NOT NULL CHECK (opening_cents >= 0),
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      closed_at TEXT,
      expected_cents INTEGER,
      counted_cents INTEGER,
      difference_cents INTEGER
    );
    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('opening', 'sale', 'expense', 'withdrawal', 'adjustment')),
      amount_cents INTEGER NOT NULL,
      reference_id INTEGER,
      register_id INTEGER REFERENCES cash_registers(id),
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
      stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
      stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
      type TEXT NOT NULL CHECK (type IN ('sale', 'return', 'adjustment', 'entry')),
      reason TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      text TEXT NOT NULL,
      period TEXT,
      source TEXT,
      metrics_json TEXT NOT NULL DEFAULT '[]',
      tool_call_json TEXT,
      tool_status TEXT NOT NULL DEFAULT 'pending' CHECK (tool_status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')),
      tool_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('businessName', 'Pollo & Caja'),
      ('currency', 'COP'),
      ('lowStockThreshold', '10');
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_created ON inventory_movements(product_id, datetime(created_at) DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_session_created ON ai_messages(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(datetime(created_at), id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
  `);
  const productColumns = database
    .prepare('PRAGMA table_info(products)')
    .all()
    .map((column) => column.name);
  if (!productColumns.includes('cost_cents'))
    database.exec(
      'ALTER TABLE products ADD COLUMN cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0)',
    );
  if (!productColumns.includes('active'))
    database.exec('ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  const aiMessageColumns = database
    .prepare('PRAGMA table_info(ai_messages)')
    .all()
    .map((column) => column.name);
  if (!aiMessageColumns.includes('tool_status'))
    database.exec("ALTER TABLE ai_messages ADD COLUMN tool_status TEXT NOT NULL DEFAULT 'pending'");
  if (!aiMessageColumns.includes('tool_error'))
    database.exec('ALTER TABLE ai_messages ADD COLUMN tool_error TEXT');
  const saleColumns = database
    .prepare('PRAGMA table_info(sales)')
    .all()
    .map((column) => column.name);
  if (!saleColumns.includes('status'))
    database.exec("ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  if (!saleColumns.includes('voided_at'))
    database.exec('ALTER TABLE sales ADD COLUMN voided_at TEXT');
  if (!saleColumns.includes('void_reason'))
    database.exec('ALTER TABLE sales ADD COLUMN void_reason TEXT');
  database.exec(
    'CREATE TABLE IF NOT EXISTS sale_voids (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const saleItemColumns = database
    .prepare('PRAGMA table_info(sale_items)')
    .all()
    .map((column) => column.name);
  if (!saleItemColumns.includes('unit_cost_cents'))
    database.exec(
      'ALTER TABLE sale_items ADD COLUMN unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0)',
    );
  if (!saleItemColumns.includes('cost_total_cents'))
    database.exec(
      'ALTER TABLE sale_items ADD COLUMN cost_total_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_total_cents >= 0)',
    );
  const movementColumns = database
    .prepare('PRAGMA table_info(cash_movements)')
    .all()
    .map((column) => column.name);
  if (!movementColumns.includes('register_id'))
    database.exec(
      'ALTER TABLE cash_movements ADD COLUMN register_id INTEGER REFERENCES cash_registers(id)',
    );
  const legacyOpenings = database
    .prepare(
      "SELECT id, amount_cents, date(created_at, 'localtime') AS business_date, created_at FROM cash_movements WHERE type = 'opening' AND register_id IS NULL",
    )
    .all();
  const insertRegister = database.prepare(
    'INSERT OR IGNORE INTO cash_registers (business_date, opening_cents, opened_at) VALUES (?, ?, ?)',
  );
  const linkOpening = database.prepare('UPDATE cash_movements SET register_id = ? WHERE id = ?');
  for (const opening of legacyOpenings) {
    insertRegister.run(opening.business_date, opening.amount_cents, opening.created_at);
    const register = database
      .prepare('SELECT id FROM cash_registers WHERE business_date = ?')
      .get(opening.business_date);
    if (register) linkOpening.run(register.id, opening.id);
  }
  const linkHistoricalMovements = database.prepare(
    "UPDATE cash_movements SET register_id = (SELECT r.id FROM cash_registers r WHERE r.business_date = date(cash_movements.created_at, 'localtime')) WHERE register_id IS NULL AND date(created_at, 'localtime') IN (SELECT business_date FROM cash_registers)",
  );
  linkHistoricalMovements.run();
  database.exec(
    'CREATE INDEX IF NOT EXISTS idx_cash_movements_register_id ON cash_movements(register_id)',
  );
  const admin = database.prepare('SELECT id FROM users WHERE email = ?').get(DEFAULT_ADMIN_EMAIL);
  if (!admin) {
    const password = hashPassword(DEFAULT_ADMIN_PASSWORD);
    database
      .prepare('INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)')
      .run(DEFAULT_ADMIN_EMAIL, password.hash, password.salt);
  }
  database.pragma(`user_version = ${SCHEMA_VERSION}`);
}

function validateDatabaseFile(filePath) {
  let candidate;
  try {
    candidate = new Database(filePath, { readonly: true, fileMustExist: true });
    if (candidate.pragma('integrity_check', { simple: true }) !== 'ok')
      throw new Error('La integridad de la base de datos no es válida.');
    if (candidate.pragma('user_version', { simple: true }) !== SCHEMA_VERSION)
      throw new Error('La versión de la base de datos no es compatible.');
    const tables = candidate
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    const missing = REQUIRED_TABLES.filter((table) => !tables.includes(table));
    if (missing.length) throw new Error(`Faltan tablas requeridas: ${missing.join(', ')}.`);
    return true;
  } finally {
    candidate?.close();
  }
}

function databaseSidecars(filePath) {
  return [`${filePath}-wal`, `${filePath}-shm`];
}

function removeDatabaseSidecars(filePath) {
  for (const sidecar of databaseSidecars(filePath)) fs.rmSync(sidecar, { force: true });
}

async function backupDatabase(destination) {
  const currentPath = getDatabasePath();
  if (path.resolve(destination) === path.resolve(currentPath))
    throw new Error('Elegí una ubicación diferente a la base activa.');
  const database = getDatabase();
  database.pragma('wal_checkpoint(TRUNCATE)');
  const temporaryPath = `${destination}.tmp-${crypto.randomBytes(8).toString('hex')}`;
  const previousPath = `${destination}.previous-${crypto.randomBytes(8).toString('hex')}`;
  try {
    await database.backup(temporaryPath);
    removeDatabaseSidecars(temporaryPath);
    if (fs.existsSync(destination)) fs.renameSync(destination, previousPath);
    try {
      fs.renameSync(temporaryPath, destination);
    } catch (error) {
      if (fs.existsSync(previousPath)) fs.renameSync(previousPath, destination);
      throw error;
    }
    removeDatabaseSidecars(destination);
    try {
      validateDatabaseFile(destination);
    } catch (error) {
      if (fs.existsSync(destination)) fs.rmSync(destination, { force: true });
      removeDatabaseSidecars(destination);
      if (fs.existsSync(previousPath)) fs.renameSync(previousPath, destination);
      throw error;
    }
    if (fs.existsSync(previousPath)) fs.rmSync(previousPath, { force: true });
    return { filePath: destination };
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    removeDatabaseSidecars(temporaryPath);
    if (fs.existsSync(previousPath)) fs.rmSync(previousPath, { force: true });
  }
}

function getAutomaticBackupDirectory() {
  // Automatic backups intentionally stay under Electron's private userData directory;
  // no user-configurable path exists in the current settings architecture.
  return path.join(app.getPath('userData'), 'backups');
}

function getAutomaticBackupStatus() {
  const values = Object.fromEntries(
    getDatabase()
      .prepare("SELECT key, value FROM settings WHERE key LIKE 'backup.%'")
      .all()
      .map((row) => [row.key, row.value]),
  );
  return {
    directory: getAutomaticBackupDirectory(),
    retention: AUTOMATIC_BACKUP_RETENTION,
    lastAttemptAt: values['backup.lastAttemptAt'] || null,
    lastSuccessAt: values['backup.lastSuccessAt'] || null,
    lastError: values['backup.lastError'] || null,
    lastPath: values['backup.lastPath'] || null,
    lastTrigger: values['backup.lastTrigger'] || null,
  };
}

function saveAutomaticBackupStatus(status) {
  const save = getDatabase().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const entries = [
    ['backup.lastAttemptAt', status.lastAttemptAt || ''],
    ['backup.lastSuccessAt', status.lastSuccessAt || ''],
    ['backup.lastError', status.lastError || ''],
    ['backup.lastPath', status.lastPath || ''],
    ['backup.lastTrigger', status.lastTrigger || ''],
  ];
  getDatabase().transaction(() => entries.forEach(([key, value]) => save.run(key, value)))();
}

async function createAutomaticBackup(trigger = 'startup') {
  if (trigger !== 'startup' && trigger !== 'cash-close')
    throw new Error('El disparador de copia automática no es válido.');
  const attemptedAt = new Date().toISOString();
  const directory = getAutomaticBackupDirectory();
  const businessDate = getBusinessDate();
  const destination = path.join(directory, `${AUTOMATIC_BACKUP_PREFIX}${businessDate}.sqlite`);
  const existing = getAutomaticBackupStatus();
  saveAutomaticBackupStatus({
    ...existing,
    lastAttemptAt: attemptedAt,
    lastError: '',
    lastTrigger: trigger,
  });
  try {
    fs.mkdirSync(directory, { recursive: true });
    // One startup copy per local business day; a cash close may refresh today's copy.
    if (!(trigger === 'startup' && fs.existsSync(destination)))
      await backupDatabase(destination);
    else validateDatabaseFile(destination);
    const files = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.startsWith(AUTOMATIC_BACKUP_PREFIX) && entry.name.endsWith('.sqlite'))
      .map((entry) => ({ name: entry.name, path: path.join(directory, entry.name) }))
      .sort((a, b) => b.name.localeCompare(a.name));
    files.slice(AUTOMATIC_BACKUP_RETENTION).forEach((file) => fs.rmSync(file.path, { force: true }));
    const completedAt = new Date().toISOString();
    const result = {
      ...getAutomaticBackupStatus(),
      lastAttemptAt: attemptedAt,
      lastSuccessAt: completedAt,
      lastError: '',
      lastPath: destination,
      lastTrigger: trigger,
    };
    saveAutomaticBackupStatus(result);
    recordAudit('database.automatic-backup', 'database', null, { trigger, fileName: path.basename(destination) });
    return result;
  } catch (error) {
    const failure = {
      ...getAutomaticBackupStatus(),
      lastAttemptAt: attemptedAt,
      lastError: error instanceof Error ? error.message : String(error),
      lastTrigger: trigger,
    };
    saveAutomaticBackupStatus(failure);
    recordAudit('database.automatic-backup-failed', 'database', null, { trigger, error: failure.lastError });
    throw error;
  }
}

function closeDatabase() {
  if (db) {
    db.close();
    db = undefined;
  }
}

function restoreDatabase(sourcePath) {
  const currentPath = getDatabasePath();
  if (path.resolve(sourcePath) === path.resolve(currentPath))
    throw new Error('Seleccioná un archivo de respaldo diferente a la base activa.');
  validateDatabaseFile(sourcePath);
  const temporaryPath = `${currentPath}.restore-${crypto.randomBytes(8).toString('hex')}`;
  const previousPath = `${currentPath}.previous-${crypto.randomBytes(8).toString('hex')}`;
  fs.copyFileSync(sourcePath, temporaryPath);
  for (const suffix of ['-wal', '-shm']) {
    const sourceSidecar = `${sourcePath}${suffix}`;
    if (fs.existsSync(sourceSidecar)) fs.copyFileSync(sourceSidecar, `${temporaryPath}${suffix}`);
  }
  closeDatabase();
  let currentMoved = false;
  let replacementInstalled = false;
  try {
    removeDatabaseSidecars(currentPath);
    fs.renameSync(currentPath, previousPath);
    currentMoved = true;
    fs.renameSync(temporaryPath, currentPath);
    replacementInstalled = true;
    getDatabase();
    removeDatabaseSidecars(previousPath);
    fs.rmSync(previousPath, { force: true });
    return { restored: true };
  } catch (error) {
    try {
      closeDatabase();
      if (replacementInstalled && fs.existsSync(currentPath))
        fs.rmSync(currentPath, { force: true });
      removeDatabaseSidecars(currentPath);
      if (currentMoved && fs.existsSync(previousPath)) fs.renameSync(previousPath, currentPath);
      getDatabase();
    } catch {
      /* preserve original error */
    }
    throw error;
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    removeDatabaseSidecars(temporaryPath);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
}

function validateEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('El correo electrónico no es válido.');
  return email.trim().toLowerCase();
}

function verifyPassword(password, record) {
  const derived = crypto.scryptSync(
    password,
    Buffer.from(record.password_salt, 'hex'),
    PASSWORD_KEY_LENGTH,
  );
  const stored = Buffer.from(record.password_hash, 'hex');
  return stored.length === derived.length && crypto.timingSafeEqual(stored, derived);
}

function authenticateAdmin(email, password) {
  const normalizedEmail = validateEmail(email);
  validatePassword(password);
  const record = getDatabase()
    .prepare('SELECT password_hash, password_salt FROM users WHERE email = ?')
    .get(normalizedEmail);
  return Boolean(record && verifyPassword(password, record));
}

function changeAdminPassword(currentPassword, newPassword) {
  validatePassword(currentPassword);
  validatePassword(newPassword);
  if (!authenticateAdmin(DEFAULT_ADMIN_EMAIL, currentPassword))
    throw new Error('La contraseña actual es incorrecta.');
  const password = hashPassword(newPassword);
  getDatabase()
    .prepare(
      'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
    )
    .run(password.hash, password.salt, DEFAULT_ADMIN_EMAIL);
  return { changed: true };
}

function listProducts() {
  return getDatabase().prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all();
}

function validateMoney(value, field) {
  if (!Number.isInteger(value) || value < 0 || value > 2147483647)
    throw new Error(`${field} no es válido.`);
}
function validateProductInput(input, updating = false) {
  if (!input || typeof input !== 'object')
    throw new Error('Los datos del producto no son válidos.');
  if (updating && (!Number.isInteger(input.id) || input.id <= 0))
    throw new Error('El producto no es válido.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120)
    throw new Error('El nombre del producto debe tener entre 1 y 120 caracteres.');
  if (
    input.description != null &&
    (typeof input.description !== 'string' || input.description.length > 500)
  )
    throw new Error('La descripción puede tener hasta 500 caracteres.');
  if (
    input.imagePath != null &&
    (typeof input.imagePath !== 'string' ||
      input.imagePath.length > 7 * 1024 * 1024 ||
      !input.imagePath.startsWith('data:image/'))
  )
    throw new Error('La imagen del producto no es válida.');
  validateMoney(input.priceCents, 'El precio');
  validateMoney(input.costCents ?? 0, 'El costo');
  if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 2147483647)
    throw new Error('El stock no es válido.');
}
function createProduct(input) {
  validateProductInput(input);
  const database = getDatabase();
  const result = database.transaction(() => {
    const created = database
      .prepare(
        `INSERT INTO products (name, description, price_cents, cost_cents, stock, image_path) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name.trim(),
        input.description || '',
        input.priceCents,
        input.costCents ?? 0,
        input.stock,
        input.imagePath || null,
      );
    if (input.stock > 0)
      database
        .prepare(
          `INSERT INTO inventory_movements (product_id, quantity_delta, stock_before, stock_after, type, reason, reference_type, reference_id) VALUES (?, ?, 0, ?, 'entry', 'Stock inicial', 'product', ?)`,
        )
        .run(created.lastInsertRowid, input.stock, input.stock, created.lastInsertRowid);
    return created.lastInsertRowid;
  })();
  return database.prepare('SELECT * FROM products WHERE id = ?').get(result);
}

function updateProduct(input) {
  validateProductInput(input, true);
  const database = getDatabase();
  const result = database.transaction(() => {
    const current = database.prepare('SELECT stock FROM products WHERE id = ?').get(input.id);
    if (!current) throw new Error('El producto no existe.');
    const updated = database
      .prepare(
        `UPDATE products SET name = ?, description = ?, price_cents = ?, cost_cents = ?, stock = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .run(
        input.name.trim(),
        input.description || '',
        input.priceCents,
        input.costCents ?? 0,
        input.stock,
        input.imagePath || null,
        input.id,
      );
    const delta = input.stock - current.stock;
    if (delta)
      database
        .prepare(
          `INSERT INTO inventory_movements (product_id, quantity_delta, stock_before, stock_after, type, reason, reference_type, reference_id) VALUES (?, ?, ?, ?, 'adjustment', 'Edición manual del producto', 'product', ?)`,
        )
        .run(input.id, delta, current.stock, input.stock, input.id);
    return updated;
  })();
  if (!result.changes) throw new Error('El producto no existe.');
  return database.prepare('SELECT * FROM products WHERE id = ?').get(input.id);
}

function archiveProduct(input) {
  if (!Number.isInteger(input?.id) || input.id <= 0) throw new Error('El producto no es válido.');
  const database = getDatabase();
  const result = database
    .prepare(
      'UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND active = 1',
    )
    .run(input.id);
  if (!result.changes) throw new Error('El producto no existe o ya está eliminado.');
  return database.prepare('SELECT * FROM products WHERE id = ?').get(input.id);
}

function adjustProductStock(input) {
  if (!Number.isInteger(input?.productId) || input.productId <= 0)
    throw new Error('El producto no es válido.');
  if (
    !Number.isInteger(input.quantityDelta) ||
    input.quantityDelta === 0 ||
    Math.abs(input.quantityDelta) > 2147483647
  )
    throw new Error('La cantidad de ajuste no es válida.');
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 200)
    throw new Error('El motivo es obligatorio y debe tener hasta 200 caracteres.');
  const database = getDatabase();
  const result = database.transaction(() => {
    const product = database
      .prepare('SELECT stock FROM products WHERE id = ? AND active = 1')
      .get(input.productId);
    if (!product) throw new Error('El producto no existe.');
    const next = product.stock + input.quantityDelta;
    if (next < 0) throw new Error('El ajuste no puede dejar el stock en negativo.');
    database
      .prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(next, input.productId);
    database
      .prepare(
        `INSERT INTO inventory_movements (product_id, quantity_delta, stock_before, stock_after, type, reason, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, 'manual', NULL)`,
      )
      .run(
        input.productId,
        input.quantityDelta,
        product.stock,
        next,
        input.quantityDelta > 0 ? 'entry' : 'adjustment',
        input.reason.trim(),
      );
  })();
  return database.prepare('SELECT * FROM products WHERE id = ?').get(input.productId);
}

function listInventoryMovements(productId, limit = 200, filters = {}) {
  const database = getDatabase();
  const conditions = [];
  const params = [];
  if (Number.isInteger(productId) && productId > 0) {
    conditions.push('m.product_id = ?');
    params.push(productId);
  }
  if (filters.type && filters.type !== 'all') {
    conditions.push('m.type = ?');
    params.push(filters.type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return database
    .prepare(
      `SELECT m.*, p.name AS product_name FROM inventory_movements m JOIN products p ON p.id = m.product_id ${where} ORDER BY datetime(m.created_at) DESC, m.id DESC LIMIT ?`,
    )
    .all(...params, limit);
}

function createSale(input) {
  const database = getDatabase();
  if (!input || !Array.isArray(input.items) || !input.items.length)
    throw new Error('La venta debe incluir al menos un producto.');
  if (!['cash', 'card'].includes(input.paymentMethod))
    throw new Error('El método de pago no es válido.');
  validateMoney(input.totalCents, 'El total');
  validateMoney(input.amountReceivedCents, 'El efectivo recibido');
  validateMoney(input.changeCents, 'El vuelto');
  const create = database.transaction(() => {
    const register = input.paymentMethod === 'cash' ? getOpenCashRegister(database) : null;
    const sale = database
      .prepare(
        `INSERT INTO sales (total_cents, payment_method, amount_received_cents, change_cents, customer_name, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.totalCents,
        input.paymentMethod,
        input.amountReceivedCents,
        input.changeCents,
        input.customerName || '',
        input.notes || '',
      );
    const insertItem = database.prepare(
      `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price_cents, subtotal_cents, unit_cost_cents, cost_total_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateStock = database.prepare(
      'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?',
    );
    const insertInventoryMovement = database.prepare(
      `INSERT INTO inventory_movements (product_id, quantity_delta, stock_before, stock_after, type, reason, reference_type, reference_id) SELECT ?, ?, stock + ?, stock, 'sale', ?, 'sale', ? FROM products WHERE id = ?`,
    );
    const findProduct = database.prepare(
      'SELECT id, name, price_cents, cost_cents FROM products WHERE id = ? AND active = 1',
    );
    const movement = database.prepare(
      `INSERT INTO cash_movements (type, amount_cents, reference_id, register_id, description) VALUES ('sale', ?, ?, ?, ?)`,
    );
    let calculatedTotal = 0;
    for (const item of input.items) {
      if (
        !Number.isInteger(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      )
        throw new Error('Los productos de la venta no son válidos.');
      const product = findProduct.get(item.productId);
      if (!product) throw new Error(`El producto ${item.productId} no existe.`);
      validateMoney(item.unitPriceCents, 'El precio de venta');
      const subtotal = item.unitPriceCents * item.quantity;
      if (!Number.isSafeInteger(subtotal) || subtotal !== item.subtotalCents)
        throw new Error('El subtotal de la venta no es válido.');
      calculatedTotal += subtotal;
      const changed = updateStock.run(item.quantity, item.productId, item.quantity);
      if (changed.changes !== 1)
        throw new Error(`Insufficient stock for product ${item.productId}`);
      insertInventoryMovement.run(
        item.productId,
        -item.quantity,
        item.quantity,
        `Venta #${sale.lastInsertRowid}`,
        sale.lastInsertRowid,
        item.productId,
      );
      insertItem.run(
        sale.lastInsertRowid,
        product.id,
        product.name,
        item.quantity,
        item.unitPriceCents,
        subtotal,
        product.cost_cents,
        product.cost_cents * item.quantity,
      );
    }
    if (calculatedTotal !== input.totalCents) throw new Error('El total de la venta no es válido.');
    if (input.paymentMethod === 'cash' && input.amountReceivedCents < input.totalCents)
      throw new Error('El efectivo recibido no alcanza para cubrir el total.');
    if (
      input.changeCents !==
      (input.paymentMethod === 'cash' ? input.amountReceivedCents - input.totalCents : 0)
    )
      throw new Error('El vuelto no es válido.');
    if (input.paymentMethod === 'cash')
      movement.run(
        input.totalCents,
        sale.lastInsertRowid,
        register.id,
        `Sale #${sale.lastInsertRowid}`,
      );
    return sale.lastInsertRowid;
  })();
  return getSale(Number(create));
}

function voidSale(id, reason) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('La venta no es válida.');
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500)
    throw new Error('El motivo es obligatorio y debe tener hasta 500 caracteres.');
  const database = getDatabase();
  database.transaction(() => {
    const sale = database.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) throw new Error('La venta no existe.');
    if (sale.status === 'voided') return;
    // Claim the active sale before reversing anything. SQLite serializes this transaction,
    // and the conditional update makes retries/concurrent requests idempotent.
    const claimed = database
      .prepare(
        "UPDATE sales SET status = 'voided', voided_at = CURRENT_TIMESTAMP, void_reason = ? WHERE id = ? AND status = 'active'",
      )
      .run(reason.trim(), id);
    if (claimed.changes !== 1) return;
    const items = database
      .prepare('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?')
      .all(id);
    const restore = database.prepare(
      'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    );
    for (const item of items) restore.run(item.quantity, item.product_id);
    database
      .prepare('INSERT INTO sale_voids (sale_id, reason) VALUES (?, ?)')
      .run(id, reason.trim());
    if (sale.payment_method === 'cash') {
      const movement = database
        .prepare(
          "SELECT register_id FROM cash_movements WHERE type = 'sale' AND reference_id = ? ORDER BY id LIMIT 1",
        )
        .get(id);
      if (movement)
        database
          .prepare(
            "INSERT INTO cash_movements (type, amount_cents, reference_id, register_id, description) VALUES ('adjustment', ?, ?, ?, ?)",
          )
          .run(-sale.total_cents, id, movement.register_id, `Void sale #${id}`);
    }
  })();
  return getSale(id);
}

function getSale(id) {
  const database = getDatabase();
  const sale = database
    .prepare(
      'SELECT s.*, v.reason AS void_record_reason, v.created_at AS void_recorded_at FROM sales s LEFT JOIN sale_voids v ON v.sale_id = s.id WHERE s.id = ?',
    )
    .get(id);
  if (!sale) return null;
  return { ...sale, items: database.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) };
}

function listSales(limit = 100, filters = {}) {
  const database = getDatabase();
  const conditions = [];
  const params = [];
  if (filters.from) {
    conditions.push("date(s.created_at, 'localtime') >= date(?)");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("date(s.created_at, 'localtime') <= date(?)");
    params.push(filters.to);
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    conditions.push('s.payment_method = ?');
    params.push(filters.paymentMethod);
  }
  const status = filters.status === 'all' ? null : filters.status || 'active';
  if (status === 'active' || status === 'voided') {
    conditions.unshift('s.status = ?');
    params.unshift(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return database
    .prepare(`SELECT s.* FROM sales s ${where} ORDER BY datetime(s.created_at) DESC LIMIT ?`)
    .all(...params, limit)
    .map((sale) => ({
      ...sale,
      items: database.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id),
    }));
}
function getSalesAnalytics(filters = {}) {
  const database = getDatabase();
  const sales = listSales(10000, filters);
  const byDay = database
    .prepare(
      `SELECT date(s.created_at, 'localtime') AS day, COALESCE(SUM(s.total_cents),0) AS total_cents, COALESCE((SELECT SUM(i.cost_total_cents) FROM sale_items i WHERE i.sale_id IN (SELECT id FROM sales WHERE status = 'active' AND date(created_at, 'localtime') = date(s.created_at, 'localtime'))),0) AS cost_cents, COUNT(*) AS orders FROM sales s WHERE s.status = 'active' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?) GROUP BY date(s.created_at, 'localtime') ORDER BY day`,
    )
    .all(filters.from, filters.to);
  const byPayment = database
    .prepare(
      `SELECT payment_method, COALESCE(SUM(total_cents),0) AS total_cents, COUNT(*) AS orders FROM sales WHERE status = 'active' AND date(created_at, 'localtime') BETWEEN date(?) AND date(?) GROUP BY payment_method`,
    )
    .all(filters.from, filters.to);
  const byProduct = database
    .prepare(
      `SELECT product_name, SUM(quantity) AS quantity, SUM(subtotal_cents) AS total_cents, SUM(cost_total_cents) AS cost_cents, SUM(subtotal_cents - cost_total_cents) AS gross_profit_cents FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE s.status = 'active' AND date(s.created_at, 'localtime') BETWEEN date(?) AND date(?) GROUP BY product_name ORDER BY total_cents DESC LIMIT 5`,
    )
    .all(filters.from, filters.to);
  const totalCents = sales.reduce((sum, sale) => sum + sale.total_cents, 0);
  const costCents = sales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((itemSum, item) => itemSum + (item.cost_total_cents ?? 0), 0),
    0,
  );
  return {
    sales,
    byDay,
    byPayment,
    byProduct,
    totalCents,
    costCents,
    grossProfitCents: totalCents - costCents,
    marginPercent: totalCents ? ((totalCents - costCents) / totalCents) * 100 : 0,
    orders: sales.length,
  };
}

// Legacy *_cents names are retained for API/DB compatibility; values are whole COP pesos.
// Do not convert monetary values by dividing or multiplying by 100.
function createExpense(input) {
  const database = getDatabase();
  if (
    !input ||
    typeof input.description !== 'string' ||
    !input.description.trim() ||
    input.description.trim().length > 200
  )
    throw new Error('La descripción del gasto no es válida.');
  validateMoney(input.amountCents, 'El monto del gasto');
  if (input.amountCents <= 0) throw new Error('El monto del gasto debe ser mayor a cero.');
  const result = database.transaction(() => {
    const expense = database
      .prepare(
        `INSERT INTO expenses (description, amount_cents, category, notes) VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.description.trim(),
        input.amountCents,
        input.category || 'other',
        input.notes || '',
      );
    const register = getOpenCashRegister(database);
    database
      .prepare(
        `INSERT INTO cash_movements (type, amount_cents, reference_id, register_id, description) VALUES ('expense', ?, ?, ?, ?)`,
      )
      .run(-input.amountCents, expense.lastInsertRowid, register.id, input.description.trim());
    return expense.lastInsertRowid;
  })();
  return database.prepare('SELECT * FROM expenses WHERE id = ?').get(result);
}

function createWithdrawal(input) {
  const database = getDatabase();
  if (
    !input ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.trim().length > 200
  )
    throw new Error('El motivo del retiro no es válido.');
  validateMoney(input.amountCents, 'El monto del retiro');
  if (input.amountCents <= 0) throw new Error('El monto del retiro debe ser mayor a cero.');
  const result = database.transaction(() => {
    const register = getOpenCashRegister(database);
    return database
      .prepare(
        "INSERT INTO cash_movements (type, amount_cents, register_id, description) VALUES ('withdrawal', ?, ?, ?)",
      )
      .run(-input.amountCents, register.id, input.reason.trim());
  })();
  return database.prepare('SELECT * FROM cash_movements WHERE id = ?').get(result.lastInsertRowid);
}

function listExpenses(limit = 100, filters = {}) {
  const conditions = [];
  const params = [];
  if (filters.from) {
    conditions.push("date(created_at, 'localtime') >= date(?)");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("date(created_at, 'localtime') <= date(?)");
    params.push(filters.to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return getDatabase()
    .prepare(`SELECT * FROM expenses ${where} ORDER BY datetime(created_at) DESC LIMIT ?`)
    .all(...params, limit);
}
function getOpenCashRegister(database = getDatabase()) {
  const register = database
    .prepare(
      "SELECT * FROM cash_registers WHERE business_date = date('now', 'localtime') AND status = 'open'",
    )
    .get();
  if (!register)
    throw new Error(
      'La caja no está abierta. Abrí la caja antes de registrar movimientos de efectivo.',
    );
  return register;
}
function openCashRegister(amountCents) {
  const database = getDatabase();
  const existing = database
    .prepare("SELECT * FROM cash_registers WHERE business_date = date('now', 'localtime')")
    .get();
  if (existing)
    throw new Error(
      existing.status === 'closed'
        ? 'La caja de hoy ya fue cerrada.'
        : 'La caja ya fue abierta hoy.',
    );
  const result = database.transaction(() => {
    const register = database
      .prepare(
        "INSERT INTO cash_registers (business_date, opening_cents) VALUES (date('now', 'localtime'), ?)",
      )
      .run(amountCents);
    database
      .prepare(
        "INSERT INTO cash_movements (type, amount_cents, register_id, description) VALUES ('opening', ?, ?, 'Apertura de caja')",
      )
      .run(amountCents, register.lastInsertRowid);
    return register.lastInsertRowid;
  })();
  return database.prepare('SELECT * FROM cash_registers WHERE id = ?').get(result);
}
function getCashRegister() {
  const database = getDatabase();
  const register =
    database
      .prepare("SELECT * FROM cash_registers WHERE business_date = date('now', 'localtime')")
      .get() || null;
  const movements = register
    ? database
        .prepare(
          'SELECT * FROM cash_movements WHERE register_id = ? ORDER BY datetime(created_at) DESC, id DESC',
        )
        .all(register.id)
    : [];
  const balanceCents = movements.reduce((sum, movement) => sum + movement.amount_cents, 0);
  return {
    opening: movements.find((movement) => movement.type === 'opening') || null,
    register,
    movements,
    balanceCents,
    isOpen: register?.status === 'open',
    isClosed: register?.status === 'closed',
  };
}
function closeCashRegister(countedCents) {
  const database = getDatabase();
  const register = getOpenCashRegister(database);
  const movements = database
    .prepare('SELECT amount_cents FROM cash_movements WHERE register_id = ?')
    .all(register.id);
  const expectedCents = movements.reduce((sum, movement) => sum + movement.amount_cents, 0);
  const differenceCents = countedCents - expectedCents;
  database
    .prepare(
      "UPDATE cash_registers SET status = 'closed', closed_at = CURRENT_TIMESTAMP, expected_cents = ?, counted_cents = ?, difference_cents = ? WHERE id = ? AND status = 'open'",
    )
    .run(expectedCents, countedCents, differenceCents, register.id);
  return { id: register.id, expectedCents, countedCents, differenceCents };
}

function validateAiSessionId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new Error('La sesión de IA no es válida.');
  return id;
}
function validateAiText(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 16000)
    throw new Error('El mensaje de IA no es válido.');
  return text.trim();
}
function aiTitle(text) {
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}
function parseAiJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return fallback;
  }
}
function createAiSession(input = {}) {
  const id = validateAiSessionId(input.id);
  const title = validateAiText(input.title || 'Nuevo chat').slice(0, 120);
  const database = getDatabase();
  database.prepare('INSERT INTO ai_sessions (id, title) VALUES (?, ?)').run(id, title);
  return {
    id,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    messages: [],
  };
}
function getOrCreateAiSession(input = {}) {
  const id = validateAiSessionId(input.id);
  const title = validateAiText(input.title || 'Nuevo chat').slice(0, 120);
  const database = getDatabase();
  database.prepare('INSERT OR IGNORE INTO ai_sessions (id, title) VALUES (?, ?)').run(id, title);
  return getAiSession(id);
}
function listAiSessions(limit) {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
    throw new Error('El límite de sesiones no es válido.');
  const query =
    'SELECT s.*, COUNT(m.id) AS message_count FROM ai_sessions s LEFT JOIN ai_messages m ON m.session_id = s.id GROUP BY s.id ORDER BY datetime(s.updated_at) DESC';
  return limit === undefined
    ? getDatabase().prepare(query).all()
    : getDatabase().prepare(`${query} LIMIT ?`).all(limit);
}
function deleteAiSession(id) {
  const sessionId = validateAiSessionId(id);
  const database = getDatabase();
  database.transaction(() => {
    const result = database.prepare('DELETE FROM ai_sessions WHERE id = ?').run(sessionId);
    if (result.changes !== 1) throw new Error('La sesión no existe.');
  })();
  return { id: sessionId, deleted: true };
}
function getAiSession(id) {
  validateAiSessionId(id);
  const database = getDatabase();
  const session = database.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(id);
  if (!session) return null;
  const messages = database
    .prepare(
      'SELECT id, role, text, period, source, metrics_json, tool_call_json, tool_status, tool_error, created_at FROM ai_messages WHERE session_id = ? ORDER BY id',
    )
    .all(id)
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      period: message.period,
      source: message.source,
      metrics: parseAiJson(message.metrics_json, []),
      toolCall: message.tool_call_json ? parseAiJson(message.tool_call_json, null) : null,
      toolStatus: message.tool_status,
      toolError: message.tool_error,
      created_at: message.created_at,
    }));
  return { ...session, messages };
}
function appendAiMessage(input) {
  const sessionId = validateAiSessionId(input?.sessionId);
  const role = input?.role;
  if (role !== 'user' && role !== 'assistant') throw new Error('El rol del mensaje no es válido.');
  const text = validateAiText(input.text);
  const period = input.period == null ? null : validateAiText(input.period).slice(0, 200);
  const source = input.source == null ? null : validateAiText(input.source).slice(0, 200);
  const metrics = input.metrics == null ? [] : input.metrics;
  const toolCall = input.toolCall == null ? null : input.toolCall;
  if (!Array.isArray(metrics) || metrics.length > 20)
    throw new Error('Las métricas no son válidas.');
  const database = getDatabase();
  const result = database.transaction(() => {
    const session = database.prepare('SELECT title FROM ai_sessions WHERE id = ?').get(sessionId);
    if (!session) throw new Error('La sesión no existe.');
    const message = database
      .prepare(
        'INSERT INTO ai_messages (session_id, role, text, period, source, metrics_json, tool_call_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        sessionId,
        role,
        text,
        period,
        source,
        JSON.stringify(metrics),
        toolCall == null ? null : JSON.stringify(toolCall),
      );
    const title = session.title === 'Nuevo chat' && role === 'user' ? aiTitle(text) : session.title;
    database
      .prepare('UPDATE ai_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(title, sessionId);
    return { id: Number(message.lastInsertRowid), sessionId, title };
  })();
  return result;
}
function validateAiMessageInput(input) {
  const sessionId = validateAiSessionId(input?.sessionId);
  const messageId = input?.messageId;
  if (!Number.isSafeInteger(messageId) || messageId < 1)
    throw new Error('El mensaje no es válido.');
  return { sessionId, messageId };
}
function claimAiMessage(input) {
  const { sessionId, messageId } = validateAiMessageInput(input);
  const database = getDatabase();
  const result = database
    .prepare(
      "UPDATE ai_messages SET tool_status = 'claimed' WHERE id = ? AND session_id = ? AND role = 'assistant' AND tool_call_json IS NOT NULL AND tool_status = 'pending'",
    )
    .run(messageId, sessionId);
  const message = database
    .prepare('SELECT tool_status FROM ai_messages WHERE id = ? AND session_id = ?')
    .get(messageId, sessionId);
  if (!message) throw new Error('El mensaje no existe.');
  return { claimed: result.changes === 1, status: message.tool_status };
}
function completeAiMessage(input) {
  const { sessionId, messageId } = validateAiMessageInput(input);
  const status = input?.status;
  if (status !== 'completed' && status !== 'failed') throw new Error('El estado no es válido.');
  const error = input?.error == null ? null : validateAiText(input.error).slice(0, 500);
  const database = getDatabase();
  const result = database
    .prepare(
      "UPDATE ai_messages SET tool_status = ?, tool_error = ? WHERE id = ? AND session_id = ? AND tool_status = 'claimed'",
    )
    .run(status, error, messageId, sessionId);
  if (result.changes !== 1) throw new Error('La propuesta no está en ejecución.');
  return { messageId, status, error };
}
function cancelAiMessage(input) {
  const { sessionId, messageId } = validateAiMessageInput(input);
  const database = getDatabase();
  const result = database
    .prepare(
      "UPDATE ai_messages SET tool_status = 'cancelled' WHERE id = ? AND session_id = ? AND tool_status = 'pending'",
    )
    .run(messageId, sessionId);
  const message = database
    .prepare('SELECT tool_status FROM ai_messages WHERE id = ? AND session_id = ?')
    .get(messageId, sessionId);
  if (!message) throw new Error('El mensaje no existe.');
  return { cancelled: result.changes === 1, status: message.tool_status };
}

function getSettings() {
  const rows = getDatabase().prepare('SELECT key, value FROM settings').all();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    businessName: values.businessName || 'Pollo & Caja',
    currency: values.currency || 'COP',
    lowStockThreshold: Number(values.lowStockThreshold) || 10,
  };
}

function getOllamaSettings() {
  const rows = getDatabase()
    .prepare("SELECT key, value FROM settings WHERE key IN ('ollamaModel', 'ollamaConfigured')")
    .all();
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    model: OLLAMA_MODELS.includes(values.ollamaModel) ? values.ollamaModel : OLLAMA_MODELS[0],
    configured: values.ollamaConfigured === '1',
  };
}

function saveOllamaModel(model) {
  if (typeof model !== 'string' || !OLLAMA_MODELS.includes(model))
    throw new Error('El modelo seleccionado no es válido.');
  getDatabase()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run('ollamaModel', model);
  return getOllamaSettings();
}

function updateOllamaConfigured(configured) {
  getDatabase()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run('ollamaConfigured', configured ? '1' : '0');
}

function updateSettings(input) {
  const businessName = String(input.businessName || '').trim();
  const currency = String(input.currency || '')
    .trim()
    .toUpperCase();
  const lowStockThreshold = Number(input.lowStockThreshold);
  if (!businessName || businessName.length > 100)
    throw new Error('El nombre del negocio debe tener entre 1 y 100 caracteres.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('La moneda debe ser un código de 3 letras.');
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 100000)
    throw new Error('El umbral de stock no es válido.');
  const database = getDatabase();
  const save = database.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  database.transaction(() => {
    save.run('businessName', businessName);
    save.run('currency', currency);
    save.run('lowStockThreshold', String(lowStockThreshold));
  })();
  return getSettings();
}

function getDailyReport(businessDate) {
  if (typeof businessDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate))
    throw new Error('La fecha del reporte no es válida.');
  const database = getDatabase();
  const sales = database
    .prepare(
      "SELECT * FROM sales WHERE status = 'active' AND date(created_at, 'localtime') = date(?) ORDER BY datetime(created_at), id",
    )
    .all(businessDate);
  const saleIds = sales.map((sale) => sale.id);
  const items = saleIds.length
    ? database
        .prepare(
          `SELECT sale_id, COALESCE(SUM(cost_total_cents), 0) AS cost_cents FROM sale_items WHERE sale_id IN (${saleIds.map(() => '?').join(',')}) GROUP BY sale_id`,
        )
        .all(...saleIds)
    : [];
  const costs = new Map(items.map((item) => [item.sale_id, item.cost_cents]));
  const totalCents = sales.reduce((sum, sale) => sum + sale.total_cents, 0);
  const costCents = sales.reduce((sum, sale) => sum + (costs.get(sale.id) || 0), 0);
  const paymentRows = database
    .prepare(
      "SELECT payment_method, COALESCE(SUM(total_cents), 0) AS total_cents, COUNT(*) AS orders FROM sales WHERE status = 'active' AND date(created_at, 'localtime') = date(?) GROUP BY payment_method",
    )
    .all(businessDate);
  const paymentSplit = { cashCents: 0, cardCents: 0 };
  for (const row of paymentRows)
    paymentSplit[row.payment_method === 'cash' ? 'cashCents' : 'cardCents'] = row.total_cents;
  const expenses = database
    .prepare(
      "SELECT category, COALESCE(SUM(amount_cents), 0) AS total_cents, COUNT(*) AS count FROM expenses WHERE date(created_at, 'localtime') = date(?) GROUP BY category ORDER BY total_cents DESC",
    )
    .all(businessDate);
  const expensesTotalCents = expenses.reduce((sum, expense) => sum + expense.total_cents, 0);
  const register =
    database.prepare('SELECT * FROM cash_registers WHERE business_date = ?').get(businessDate) ||
    null;
  const movements = register
    ? database.prepare('SELECT * FROM cash_movements WHERE register_id = ?').all(register.id)
    : [];
  const expectedCents = register
    ? (register.expected_cents ??
      movements.reduce((sum, movement) => sum + movement.amount_cents, 0))
    : null;
  const withdrawals = movements.filter((movement) => movement.type === 'withdrawal');
  const withdrawalsTotalCents = withdrawals.reduce(
    (sum, movement) => sum + Math.abs(movement.amount_cents),
    0,
  );
  return {
    businessDate,
    sales,
    orders: sales.length,
    totalCents,
    paymentSplit,
    expenses,
    expensesTotalCents,
    withdrawals,
    withdrawalsTotalCents,
    costCents,
    grossProfitCents: totalCents - costCents,
    marginPercent: totalCents ? ((totalCents - costCents) / totalCents) * 100 : 0,
    cash: {
      openingCents: register?.opening_cents ?? null,
      expectedCents,
      countedCents: register?.counted_cents ?? null,
      differenceCents: register?.difference_cents ?? null,
      status: register?.status ?? 'not_open',
    },
  };
}

function getDashboardSummary() {
  const database = getDatabase();
  return {
    salesTodayCents: database
      .prepare(
        `SELECT COALESCE(SUM(total_cents), 0) AS value FROM sales WHERE status = 'active' AND date(created_at) = date('now', 'localtime')`,
      )
      .get().value,
    ordersToday: database
      .prepare(
        `SELECT COUNT(*) AS value FROM sales WHERE status = 'active' AND date(created_at) = date('now', 'localtime')`,
      )
      .get().value,
    expensesTodayCents: database
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS value FROM expenses WHERE date(created_at) = date('now', 'localtime')`,
      )
      .get().value,
    lowStock: database
      .prepare('SELECT * FROM products WHERE active = 1 AND stock <= ? ORDER BY stock, name')
      .all(getSettings().lowStockThreshold),
  };
}

function getDashboardAlerts() {
  const database = getDatabase();
  const settings = getSettings();
  const alerts = [];
  const outOfStock = database
    .prepare('SELECT id, name FROM products WHERE active = 1 AND stock = 0 ORDER BY name')
    .all();
  const lowStock = database
    .prepare(
      'SELECT id, name, stock FROM products WHERE active = 1 AND stock > 0 AND stock <= ? ORDER BY stock, name',
    )
    .all(settings.lowStockThreshold);
  if (outOfStock.length)
    alerts.push({
      id: 'stock-out',
      severity: 'critical',
      title: 'Productos sin stock',
      message: `${outOfStock.length} producto${outOfStock.length === 1 ? '' : 's'} no disponible${outOfStock.length === 1 ? '' : 's'}.`,
      page: 'products',
    });
  if (lowStock.length)
    alerts.push({
      id: 'stock-low',
      severity: 'warning',
      title: 'Stock bajo',
      message: `${lowStock.length} producto${lowStock.length === 1 ? '' : 's'} cerca del mínimo.`,
      page: 'products',
    });
  const register = database
    .prepare("SELECT * FROM cash_registers WHERE business_date = date('now', 'localtime')")
    .get();
  if (!register)
    alerts.push({
      id: 'cash-not-open',
      severity: 'critical',
      title: 'Caja sin abrir',
      message: 'Abrí la caja para registrar movimientos en efectivo.',
      page: 'cash',
    });
  else if (register.status === 'open')
    alerts.push({
      id: 'cash-open',
      severity: 'warning',
      title: 'Caja todavía abierta',
      message: 'Revisá y cerrá la caja al finalizar la jornada.',
      page: 'cash',
    });
  else if (register.difference_cents)
    alerts.push({
      id: 'cash-difference',
      severity: Math.abs(register.difference_cents) >= 1000 ? 'critical' : 'warning',
      title: 'Diferencia de caja detectada',
      message: `La diferencia registrada es de ${register.difference_cents > 0 ? '+' : ''}${Math.abs(register.difference_cents).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}.`,
      page: 'cash',
    });
  const marginProducts = database
    .prepare('SELECT id, name FROM products WHERE active = 1 AND price_cents <= cost_cents')
    .all();
  if (marginProducts.length)
    alerts.push({
      id: 'margin-low',
      severity: 'warning',
      title: 'Margen de producto bajo',
      message: `${marginProducts.length} producto${marginProducts.length === 1 ? '' : 's'} tiene margen nulo o negativo.`,
      page: 'products',
    });
  const expenseStats = database
    .prepare(
      "SELECT COALESCE(SUM(CASE WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN amount_cents ELSE 0 END), 0) AS today, COALESCE(SUM(CASE WHEN date(created_at, 'localtime') >= date('now', 'localtime', '-7 day') AND date(created_at, 'localtime') < date('now', 'localtime') THEN amount_cents ELSE 0 END), 0) AS previous, COUNT(DISTINCT CASE WHEN date(created_at, 'localtime') >= date('now', 'localtime', '-7 day') AND date(created_at, 'localtime') < date('now', 'localtime') THEN date(created_at, 'localtime') END) AS days FROM expenses",
    )
    .get();
  const averageExpense = expenseStats.days ? expenseStats.previous / expenseStats.days : 0;
  if (expenseStats.today > 0 && averageExpense > 0 && expenseStats.today >= averageExpense * 1.5)
    alerts.push({
      id: 'expenses-high',
      severity: 'info',
      title: 'Gastos inusualmente altos',
      message: 'Los gastos de hoy superan el promedio reciente.',
      page: 'expenses',
    });
  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

function normalizeAuditActor(actorEmail) {
  return typeof actorEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actorEmail.trim())
    ? actorEmail.trim().toLowerCase()
    : 'local-operator';
}

function recordAudit(action, entityType, entityId = null, metadata = {}, actorEmail) {
  if (typeof action !== 'string' || !action.trim()) throw new Error('La acción de auditoría no es válida.');
  if (typeof entityType !== 'string' || !entityType.trim()) throw new Error('La entidad de auditoría no es válida.');
  const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  getDatabase().prepare(
    'INSERT INTO audit_logs (actor_email, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, ?, ?)',
  ).run(normalizeAuditActor(actorEmail), action.trim(), entityType.trim(), Number.isInteger(entityId) ? entityId : null, JSON.stringify(safeMetadata));
  return { recorded: true };
}

function getDiagnostics() {
  const database = getDatabase();
  return database.prepare(`
    SELECT issue_code, severity, entity_type, entity_id, message FROM (
      SELECT 'sale-total-item-mismatch' issue_code, 'critical' severity, 'sale' entity_type, s.id entity_id, 'El total de la venta no coincide con sus artículos.' message
      FROM sales s LEFT JOIN sale_items i ON i.sale_id = s.id WHERE s.total_cents <> COALESCE((SELECT SUM(subtotal_cents) FROM sale_items WHERE sale_id = s.id), 0)
      UNION ALL SELECT 'sale-cash-movement-missing', 'warning', 'sale', s.id, 'Venta en efectivo sin movimiento de caja esperado.' FROM sales s WHERE s.status = 'active' AND s.payment_method = 'cash' AND NOT EXISTS (SELECT 1 FROM cash_movements m WHERE m.type = 'sale' AND m.reference_id = s.id)
      UNION ALL SELECT 'negative-stock', 'critical', 'product', p.id, 'El stock del producto es negativo.' FROM products p WHERE p.stock < 0
      UNION ALL SELECT 'orphan-cash-movement', 'warning', 'cash_movement', m.id, 'Movimiento de caja sin registro relacionado.' FROM cash_movements m LEFT JOIN cash_registers r ON r.id = m.register_id WHERE m.register_id IS NULL OR r.id IS NULL
      UNION ALL SELECT 'orphan-inventory-movement', 'warning', 'inventory_movement', m.id, 'Movimiento de inventario sin producto o referencia válida.' FROM inventory_movements m LEFT JOIN products p ON p.id = m.product_id WHERE p.id IS NULL OR (m.reference_type = 'sale' AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = m.reference_id))
      UNION ALL SELECT 'invalid-margin', 'warning', 'product', p.id, 'El costo del producto supera su precio.' FROM products p WHERE p.price_cents <= 0 OR p.cost_cents > p.price_cents
      UNION ALL SELECT 'product-without-cost', 'info', 'product', p.id, 'El producto no tiene costo registrado.' FROM products p WHERE p.active = 1 AND p.cost_cents = 0
      UNION ALL SELECT 'stale-open-register', 'warning', 'cash_register', r.id, 'La caja permanece abierta desde un día anterior.' FROM cash_registers r WHERE r.status = 'open' AND r.business_date < date('now', 'localtime')
      UNION ALL SELECT 'duplicate-expense', 'warning', 'expense', e.id, 'Existe otro gasto idéntico registrado en la misma fecha.' FROM expenses e WHERE EXISTS (SELECT 1 FROM expenses d WHERE d.id < e.id AND d.description = e.description AND d.amount_cents = e.amount_cents AND date(d.created_at, 'localtime') = date(e.created_at, 'localtime'))
      UNION ALL SELECT 'inventory-replay-incoherence', 'critical', 'inventory_movement', m.id, 'La secuencia de inventario no coincide con stock_before.' FROM inventory_movements m WHERE m.stock_after <> m.stock_before + m.quantity_delta OR ((SELECT COUNT(*) FROM inventory_movements x WHERE x.product_id = m.product_id AND (datetime(x.created_at) < datetime(m.created_at) OR (x.created_at = m.created_at AND x.id < m.id))) > 0 AND m.stock_before <> (SELECT x.stock_after FROM inventory_movements x WHERE x.product_id = m.product_id AND (datetime(x.created_at) < datetime(m.created_at) OR (x.created_at = m.created_at AND x.id < m.id)) ORDER BY datetime(x.created_at) DESC, x.id DESC LIMIT 1))
    ) ORDER BY issue_code, entity_type, entity_id
  `).all();
}

module.exports = {
  getDatabase,
  getBusinessDate,
  createAiSession,
  getOrCreateAiSession,
  listAiSessions,
  getAiSession,
  deleteAiSession,
  appendAiMessage,
  claimAiMessage,
  completeAiMessage,
  cancelAiMessage,
  listProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  adjustProductStock,
  listInventoryMovements,
  createSale,
  voidSale,
  getSale,
  listSales,
  getSalesAnalytics,
  createExpense,
  createWithdrawal,
  listExpenses,
  getDailyReport,
  getDashboardSummary,
  getDashboardAlerts,
  getSettings,
  updateSettings,
  getOllamaSettings,
  saveOllamaModel,
  updateOllamaConfigured,
  authenticateAdmin,
  changeAdminPassword,
  openCashRegister,
  getCashRegister,
  closeCashRegister,
  backupDatabase,
  restoreDatabase,
  getAutomaticBackupStatus,
  createAutomaticBackup,
  recordAudit,
  getDiagnostics,
};
