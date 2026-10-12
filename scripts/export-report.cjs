const XLSX = require('xlsx');

const COP_FORMAT = '#,##0 [$COP]';
const DATE_FORMAT = 'dd/mm/yyyy hh:mm';
const headerStyle = { fill: { fgColor: { rgb: '17324D' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { vertical: 'center' } };
const titleStyle = { fill: { fgColor: { rgb: '0F766E' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 } };

function asDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}
function applySheetLayout(sheet, headerRow, widths, freezeRows = headerRow + 1) {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  sheet['!freeze'] = { xSplit: 0, ySplit: freezeRows };
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell) cell.s = headerStyle;
  }
}
function styleTitle(sheet, cell = 'A1') { if (sheet[cell]) sheet[cell].s = titleStyle; }
function formatColumns(sheet, columns, startRow = 0) {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  for (let r = Math.max(startRow, range.s.r); r <= range.e.r; r += 1)
    for (const [column, format] of Object.entries(columns)) {
      const cell = sheet[/\d/.test(column) ? column : `${column}${r + 1}`];
      if (cell) cell.z = format;
    }
}
function money(value) { return value == null ? '' : Number(value); }

function buildWorkbook(sales, expenses, report = null, data = {}) {
  const workbook = XLSX.utils.book_new();
  const totalSales = sales.reduce((sum, sale) => sum + (sale.total_cents || 0), 0);
  const totalExpenses = report?.expensesTotalCents ?? expenses.reduce((sum, expense) => sum + (expense.amount_cents || expense.total_cents || 0), 0);
  const period = report?.businessDate || data.period || (sales.length ? `${sales.at(-1).created_at} – ${sales[0].created_at}` : 'Sin registros');
  const summary = [
    ['POLLO & CAJA', ''],
    ['Reporte de operación', ''],
    ['Generado', asDate(new Date().toISOString())],
    ['Moneda', 'COP'],
    ['Período', period],
    [],
    ['RESUMEN', ''],
    ['Ventas registradas', report?.orders ?? sales.length],
    ['Ingresos por ventas', money(report?.totalCents ?? totalSales)],
    ['Efectivo', money(report?.paymentSplit?.cashCents)],
    ['Tarjeta', money(report?.paymentSplit?.cardCents)],
    ['Costo de ventas', money(report?.costCents)],
    ['Ganancia bruta', money(report?.grossProfitCents)],
    ['Margen %', report?.marginPercent ?? ''],
    ['Gastos registrados', expenses.length],
    ['Total de gastos', money(totalExpenses)],
    ['Resultado neto', money((report?.totalCents ?? totalSales) - totalExpenses)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 24 }];
  summarySheet['!freeze'] = { xSplit: 0, ySplit: 7 };
  styleTitle(summarySheet, 'A1'); styleTitle(summarySheet, 'A7');
  formatColumns(summarySheet, { B3: DATE_FORMAT, B9: COP_FORMAT, B10: COP_FORMAT, B11: COP_FORMAT, B12: COP_FORMAT, B13: COP_FORMAT, B16: COP_FORMAT, B17: COP_FORMAT });
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  const salesRows = [['ID', 'Fecha', 'Productos', 'Total (COP)', 'Método de pago', 'Recibido (COP)', 'Vuelto (COP)', 'Estado']];
  for (const sale of sales) salesRows.push([`#${sale.id}`, asDate(sale.created_at), (sale.items || []).map((item) => `${item.quantity} x ${item.product_name}`).join(' | '), money(sale.total_cents), sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta', money(sale.amount_received_cents), money(sale.change_cents), sale.status === 'voided' ? 'Anulada' : 'Activa']);
  const salesSheet = XLSX.utils.aoa_to_sheet(salesRows);
  applySheetLayout(salesSheet, 0, [10, 22, 48, 16, 18, 18, 16, 12]);
  formatColumns(salesSheet, { B: DATE_FORMAT, D: COP_FORMAT, F: COP_FORMAT, G: COP_FORMAT }, 1);
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Ventas');

  if (Array.isArray(data.products) && data.products.length) {
    const productRows = [['ID', 'Producto', 'Descripción', 'Precio (COP)', 'Costo (COP)', 'Stock', 'Activo']];
    data.products.forEach((product) => productRows.push([product.id, product.name, product.description || '', money(product.price_cents), money(product.cost_cents), product.stock, product.active === 0 ? 'No' : 'Sí']));
    const sheet = XLSX.utils.aoa_to_sheet(productRows);
    applySheetLayout(sheet, 0, [10, 28, 42, 16, 16, 12, 12]);
    formatColumns(sheet, { D: COP_FORMAT, E: COP_FORMAT }, 1);
    // Excel sheet names cannot contain '/', so this combined inventory sheet uses a safe label.
    XLSX.utils.book_append_sheet(workbook, sheet, 'Productos-Inventario');
  }

  const expenseRows = [['ID', 'Fecha', 'Descripción', 'Categoría', 'Monto (COP)', 'Notas']];
  for (const expense of expenses) expenseRows.push([expense.id || '', asDate(expense.created_at), expense.description || '', expense.category || '', money(expense.amount_cents ?? expense.total_cents), expense.notes || '']);
  const expensesSheet = XLSX.utils.aoa_to_sheet(expenseRows);
  applySheetLayout(expensesSheet, 0, [10, 22, 34, 18, 16, 36]);
  formatColumns(expensesSheet, { B: DATE_FORMAT, E: COP_FORMAT }, 1);
  XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Gastos');

  if (data.cash?.register || data.cash?.movements?.length) {
    const cashRows = [['Caja', data.cash.register?.business_date || period], ['Estado', data.cash.register?.status || ''], [], ['Fecha', 'Tipo', 'Descripción', 'Movimiento (COP)', 'Saldo acumulado (COP)']];
    let balance = 0;
    for (const movement of data.cash.movements || []) { balance += movement.amount_cents || 0; cashRows.push([asDate(movement.created_at), movement.type, movement.description || '', money(movement.amount_cents), money(balance)]); }
    const sheet = XLSX.utils.aoa_to_sheet(cashRows);
    applySheetLayout(sheet, 3, [22, 18, 36, 20, 24], 4);
    formatColumns(sheet, { A: DATE_FORMAT, D: COP_FORMAT, E: COP_FORMAT }, 4);
    styleTitle(sheet, 'A1');
    XLSX.utils.book_append_sheet(workbook, sheet, 'Caja');
  }
  return workbook;
}
module.exports = { buildWorkbook };
