const XLSX = require('xlsx');
const fs = require('node:fs');

function buildWorkbook(sales, expenses) {
  const workbook = XLSX.utils.book_new();
  const totalSales = sales.reduce((sum, sale) => sum + sale.total_cents, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);
  const summary = [
    ['POLLO & CAJA'],
    ['Reporte de operación'],
    ['Generado', new Date().toLocaleString('es-AR')],
    [],
    ['RESUMEN'],
    ['Ventas registradas', sales.length],
    ['Ingresos por ventas', totalSales / 100],
    ['Gastos registrados', expenses.length],
    ['Total de gastos', totalExpenses / 100],
    ['Resultado neto', (totalSales - totalExpenses) / 100],
  ];
  const salesRows = [['ID', 'Fecha', 'Productos', 'Total', 'Método de pago', 'Recibido', 'Vuelto']];
  for (const sale of sales) salesRows.push([`#${sale.id}`, sale.created_at, sale.items.map((item) => `${item.quantity} x ${item.product_name}`).join(' | '), sale.total_cents / 100, sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta', sale.amount_received_cents / 100, sale.change_cents / 100]);
  const expenseRows = [['ID', 'Fecha', 'Descripción', 'Categoría', 'Monto', 'Notas']];
  for (const expense of expenses) expenseRows.push([`#${expense.id}`, expense.created_at, expense.description, expense.category, expense.amount_cents / 100, expense.notes || '']);
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  const salesSheet = XLSX.utils.aoa_to_sheet(salesRows);
  const expensesSheet = XLSX.utils.aoa_to_sheet(expenseRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 20 }];
  salesSheet['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  expensesSheet['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Ventas');
  XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Gastos');
  return workbook;
}
module.exports = { buildWorkbook };
