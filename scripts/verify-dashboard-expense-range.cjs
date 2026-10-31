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

  assert.equal(database.getExpensesTotal({ from: today, to: today }), 350);
  assert.equal(database.getExpensesTotal({ from: tomorrow, to: tomorrow }), 0);
  console.log('Dashboard expense date-range verification passed.');
} finally {
  database?.closeDatabase();
  Module._load = originalLoad;
  fs.rmSync(testDataDirectory, { recursive: true, force: true });
}
