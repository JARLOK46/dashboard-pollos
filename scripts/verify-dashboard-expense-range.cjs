const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const testDataDirectory = fs.mkdtempSync(path.join(root, '.dashboard-expense-range-'));
const originalLoad = Module._load;
let database;

Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { app: { getPath: () => testDataDirectory } };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  database = require('../electron/database.cjs');
  database.openCashRegister(10000);
  const today = database.getBusinessDate();
  const [year, month, day] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);

  database.createExpense({ description: 'Test expense one', amountCents: 125, category: 'insumos' });
  database.createExpense({ description: 'Test expense two', amountCents: 225, category: 'servicios' });
  const premium = database.createProduct({
    name: 'Premium item', description: '', priceCents: 10000, costCents: 5000, stock: 2, imagePath: null,
  });
  const popular = database.createProduct({
    name: 'Popular item', description: '', priceCents: 1000, costCents: 500, stock: 4, imagePath: null,
  });
  const createCardSale = (product, quantity) => {
    const totalCents = product.price_cents * quantity;
    return database.createSale({
      totalCents,
      paymentMethod: 'card',
      amountReceivedCents: totalCents,
      changeCents: 0,
      items: [{
        productId: product.id,
        productName: product.name,
        quantity,
        unitPriceCents: product.price_cents,
        subtotalCents: totalCents,
      }],
    });
  };
  createCardSale(premium, 1);
  createCardSale(popular, 3);

  assert.equal(database.getExpensesTotal({ from: today, to: today }), 350);
  assert.equal(database.getExpensesTotal({ from: tomorrow, to: tomorrow }), 0);
  assert.deepEqual(
    database.getSalesAnalytics({ from: today, to: today }).byQuantity.map((item) => [item.product_name, item.quantity]),
    [['Popular item', 3], ['Premium item', 1]],
  );
  assert.deepEqual(database.getSalesAnalytics({ from: tomorrow, to: tomorrow }).byQuantity, []);
  console.log('Dashboard period data verification passed.');
} finally {
  database?.closeDatabase();
  Module._load = originalLoad;
  fs.rmSync(testDataDirectory, { recursive: true, force: true });
}
