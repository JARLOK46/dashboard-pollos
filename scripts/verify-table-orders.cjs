const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pollo-tables-'));
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') return { app: { getPath: () => root } };
  return originalLoad.call(this, request, parent, isMain);
};
const database = require('../electron/database.cjs');
try {
  const tables = database.listDiningTables();
  assert.equal(tables.length, 12, 'se crean doce mesas por defecto');
  const baseSettings = database.getSettings();
  assert.equal(baseSettings.tableCount, 12, 'la configuración inicial conserva doce mesas');
  const expandedSettings = database.updateSettings({ ...baseSettings, tableCount: 15 });
  assert.equal(expandedSettings.tableCount, 15, 'se puede ampliar la cantidad de mesas');
  assert.equal(database.listDiningTables().length, 15, 'la ampliación crea mesas activas');
  const product = database.createProduct({ name: 'Pollo asado', description: '', priceCents: 18000, costCents: 8000, stock: 5, imagePath: null });
  const reopenedProduct = database.createProduct({ name: 'Bebida', description: '', priceCents: 4000, costCents: 1000, stock: 4, imagePath: null });
  assert.equal(database.getTableOrder(1), null, 'mesa libre sin pedido');
  let order = database.saveTableOrder({ tableId: 1, customerName: 'Ana', notes: 'Sin picante', items: [{ productId: product.id, quantity: 2 }] });
  assert.equal(order.items[0].unit_price_cents, 18000);
  assert.equal(database.listDiningTables()[0].total_cents, 36000);
  assert.equal(database.listProducts().find((row) => row.id === product.id).stock, 5, 'pedido abierto no consume stock');
  assert.throws(() => database.saveTableOrder({ tableId: 2, customerName: '', notes: '', items: [{ productId: product.id, quantity: 4 }] }), /Stock insuficiente/, 'reservas limitan pedidos de otras mesas');
  assert.throws(() => database.adjustProductStock({ productId: product.id, quantityDelta: -4, reason: 'Ajuste de prueba' }), /reservadas/, 'un ajuste no puede consumir unidades reservadas');
  assert.throws(() => database.updateProduct({ id: product.id, name: product.name, description: '', priceCents: product.price_cents, costCents: product.cost_cents, stock: 1, imagePath: null }), /reservadas/, 'una edición no puede fijar stock debajo de reservas');
  assert.throws(() => database.archiveProduct({ id: product.id }), /reservadas/, 'un producto reservado no se puede archivar');
  database.updateProduct({ id: product.id, name: product.name, description: '', priceCents: 24000, costCents: 8000, stock: 5, imagePath: null });
  order = database.saveTableOrder({ tableId: 1, customerName: 'Ana', notes: 'Sin picante', items: [{ productId: product.id, quantity: 2 }, { productId: reopenedProduct.id, quantity: 1 }] });
  assert.deepEqual(order.items.map((item) => item.unit_price_cents), [18000, 4000], 'precio registrado se conserva y nuevo producto toma precio actual');
  assert.throws(() => database.payTableOrder({ tableId: 1, paymentMethod: 'cash', amountReceivedCents: 40000, changeCents: 0 }), /caja no está abierta/i, 'pago en efectivo exige apertura de caja');
  assert.ok(database.getTableOrder(1), 'fallo de caja conserva el pedido');
  database.openCashRegister(10000);
  const cashSale = database.payTableOrder({ tableId: 1, paymentMethod: 'cash', amountReceivedCents: 40000, changeCents: 0 });
  assert.equal(cashSale.total_cents, 40000);
  assert.equal(cashSale.table_id, 1);
  assert.equal(cashSale.customer_name, 'Ana');
  assert.equal(cashSale.notes, 'Sin picante');
  assert.equal(database.getTableOrder(1), null, 'cobro libera la mesa');
  assert.equal(database.listProducts().find((row) => row.id === product.id).stock, 3, 'cobro descuenta inventario');
  const cash = database.getCashRegister();
  assert.equal(cash.balanceCents, 50000, 'caja incluye apertura y total cobrado');
  const history = database.listInventoryMovements(product.id, 20);
  assert.equal(history.at(0).type, 'sale');
  assert.equal(history.at(0).quantity_delta, -2);
  const cardOrder = database.saveTableOrder({ tableId: 2, customerName: '', notes: '', items: [{ productId: reopenedProduct.id, quantity: 2 }] });
  assert.ok(cardOrder);
  assert.throws(
    () => database.updateSettings({ ...database.getSettings(), tableCount: 1 }),
    /Mesa 2 tiene un pedido abierto/,
    'no se puede reducir mientras una mesa excedente tiene pedido abierto',
  );
  assert.throws(() => database.payTableOrder({ tableId: 2, paymentMethod: 'bogus', amountReceivedCents: 0, changeCents: 0 }), /método de pago/i);
  assert.ok(database.getTableOrder(2), 'fallo de pago conserva pedido y transacción');
  database.closeCashRegister(50000);
  assert.throws(() => database.createSale({ totalCents: 12000, paymentMethod: 'card', amountReceivedCents: 12000, changeCents: 0, items: [{ productId: reopenedProduct.id, productName: 'Bebida', quantity: 3, unitPriceCents: 4000, subtotalCents: 12000 }] }), /Stock insuficiente/i, 'una venta directa no puede consumir unidades reservadas para mesas');
  assert.ok(database.getTableOrder(2), 'la cuenta permanece abierta tras venta directa rechazada');
  const cardSale = database.payTableOrder({ tableId: 2, paymentMethod: 'card', amountReceivedCents: 8000, changeCents: 0 });
  assert.equal(cardSale.total_cents, 8000, 'el pago con tarjeta no requiere caja abierta');
  assert.equal(database.getTableOrder(2), null, 'pago con tarjeta libera la mesa');
  database.saveTableOrder({ tableId: 3, customerName: '', notes: '', items: [{ productId: reopenedProduct.id, quantity: 1 }] });
  const clearing = database.clearTableOrder(3);
  assert.equal(clearing.cleared, true);
  assert.equal(database.getTableOrder(3), null);
  assert.equal(database.clearTableOrder(3).cleared, false);
  const reducedSettings = database.updateSettings({ ...database.getSettings(), tableCount: 10 });
  assert.equal(reducedSettings.tableCount, 10, 'se puede reducir cuando las mesas excedentes están libres');
  assert.equal(database.listDiningTables().length, 10, 'la reducción oculta mesas excedentes');
  console.log('table-orders checks passed');
} finally {
  database.closeDatabase?.();
  Module._load = originalLoad;
  fs.rmSync(root, { recursive: true, force: true });
}
