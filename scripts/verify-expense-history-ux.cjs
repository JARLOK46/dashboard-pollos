const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/main.tsx'), 'utf8');
const expenses = source.slice(source.indexOf('function Expenses('));
const history = source.slice(source.indexOf('function History('), source.indexOf('function SaleDetailModal('));
const required = [
  ['expense search input', /aria-label="Buscar gastos"/.test(expenses)],
  ['expense category filter', /aria-label="Filtrar gastos por categoría"/.test(expenses)],
  ['expense loading state', /Cargando gastos/.test(expenses)],
  ['expense load error state', /No se pudieron cargar los gastos/.test(expenses)],
  ['filtered empty state', /No hay gastos que coincidan con los filtros/.test(expenses)],
  ['visible expense result count', /gastos encontrados/.test(expenses)],
  ['100-record cap remains explicit', /últimos 100 egresos de la operación/.test(expenses)],
  ['history loading feedback', /Cargando ventas/.test(history)],
  ['history error feedback', /No se pudo cargar el historial/.test(history)],
  ['history retry control', /Reintentar/.test(history)],
  ['history stale response guard', /cancelled/.test(history)],
  ['history existing filters retained', /paymentMethod: payment, status/.test(history)],
];
const failures = required.filter(([, passed]) => !passed);
if (failures.length) {
  console.error(`Expense/history UX contract failed: ${failures.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Expense/history UX contract passed (${required.length} checks).`);
