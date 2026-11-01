const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { after, before, test } = require('node:test');

const root = path.resolve(__dirname, '..');
const testDataDirectory = fs.mkdtempSync(path.join(root, '.currency-contract-'));
const originalLoad = Module._load;
let database;
let saleId;

Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { app: { getPath: () => testDataDirectory } };
  return originalLoad.call(this, request, parent, isMain);
};

before(() => {
  database = require('../electron/database.cjs');
  const product = database.createProduct({
    name: 'Test chicken',
    description: '',
    priceCents: 12500,
    costCents: 8000,
    stock: 2,
    imagePath: null,
  });
  saleId = database.createSale({
    totalCents: 12500,
    paymentMethod: 'card',
    amountReceivedCents: 12500,
    changeCents: 0,
    items: [
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPriceCents: 12500,
        subtotalCents: 12500,
      },
    ],
  }).id;
});

after(() => {
  database?.closeDatabase();
  Module._load = originalLoad;
  fs.rmSync(testDataDirectory, { recursive: true, force: true });
});

test('settings keep COP fixed and no longer require an editable currency', () => {
  const saved = database.updateSettings({
    businessName: 'Counter Test',
    lowStockThreshold: 17,
    tableCount: 10,
  });
  assert.deepEqual(
    {
      businessName: saved.businessName,
      currency: saved.currency,
      lowStockThreshold: saved.lowStockThreshold,
      tableCount: saved.tableCount,
    },
    { businessName: 'Counter Test', currency: 'COP', lowStockThreshold: 17, tableCount: 10 },
  );
});

test('unsupported currency changes are rejected without modifying other settings', () => {
  assert.throws(
    () =>
      database.updateSettings({
        businessName: 'Must Not Save',
        currency: 'USD',
        lowStockThreshold: 99,
        tableCount: 10,
      }),
    /COP/,
  );
  assert.deepEqual(
    {
      businessName: database.getSettings().businessName,
      currency: database.getSettings().currency,
      lowStockThreshold: database.getSettings().lowStockThreshold,
      tableCount: database.getSettings().tableCount,
    },
    { businessName: 'Counter Test', currency: 'COP', lowStockThreshold: 17, tableCount: 10 },
  );
});

test('locking currency preserves existing sale totals and line items', () => {
  const saleBefore = database.getSale(saleId);
  database.updateSettings({ businessName: 'Pollo & Caja', lowStockThreshold: 12, tableCount: 12 });
  const saleAfter = database.getSale(saleId);

  assert.equal(saleAfter.total_cents, saleBefore.total_cents);
  assert.equal(saleAfter.items[0].subtotal_cents, saleBefore.items[0].subtotal_cents);
  assert.equal(saleAfter.total_cents, 12500);
});

test('legacy non-COP preference is normalized on database reopen', () => {
  database.getDatabase().prepare("UPDATE settings SET value = 'USD' WHERE key = 'currency'").run();
  database.closeDatabase();

  assert.equal(database.getSettings().currency, 'COP');
});
