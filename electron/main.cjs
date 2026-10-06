const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const database = require('./database.cjs');
const credentials = require('./credentials.cjs');
const XLSX = require('xlsx');
const { buildWorkbook } = require('../scripts/export-report.cjs');

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7f8fa',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  if (isDev) window.loadURL('http://localhost:5173');
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

function registerIpc() {
  const { ipcMain, dialog } = require('electron');
  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on('window:maximize', (event) => { const win = BrowserWindow.fromWebContents(event.sender); if (win?.isMaximized()) win.unmaximize(); else win?.maximize(); });
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle('window:is-maximized', (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);
  ipcMain.handle('products:list', () => database.listProducts());
  ipcMain.handle('products:create', (_event, input) => database.createProduct(input));
  ipcMain.handle('products:update', (_event, input) => database.updateProduct(input));
  ipcMain.handle('products:adjust-stock', (_event, input) => database.adjustProductStock(input));
  ipcMain.handle('products:movements', (_event, productId, limit, filters) => database.listInventoryMovements(productId, limit, filters));
  ipcMain.handle('sales:create', (_event, input) => database.createSale(input));
  ipcMain.handle('sales:void', (_event, id, reason) => database.voidSale(id, reason));
  ipcMain.handle('sales:list', (_event, limit, filters) => database.listSales(limit, filters));
  ipcMain.handle('sales:analytics', (_event, filters) => database.getSalesAnalytics(filters));
  ipcMain.handle('sales:get', (_event, id) => database.getSale(id));
  ipcMain.handle('expenses:create', (_event, input) => database.createExpense(input));
  ipcMain.handle('expenses:list', (_event, limit) => database.listExpenses(limit));
  ipcMain.handle('cash:withdraw', (_event, input) => database.createWithdrawal(input));
  ipcMain.handle('dashboard:summary', () => database.getDashboardSummary());
  ipcMain.handle('dashboard:alerts', () => database.getDashboardAlerts());
  ipcMain.handle('report:daily', (_event, businessDate) => database.getDailyReport(businessDate));
  ipcMain.handle('database:backup', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, { title: 'Crear copia de seguridad', defaultPath: 'pollo-caja-backup.sqlite', filters: [{ name: 'Base de datos SQLite', extensions: ['sqlite', 'db'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (fs.existsSync(result.filePath)) {
      const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Reemplazar'], defaultId: 0, cancelId: 0, title: 'Reemplazar copia existente', message: 'Ya existe una copia en esa ubicación.', detail: '¿Querés reemplazarla de forma segura?', noLink: true });
      if (confirmation.response !== 1) return { canceled: true };
    }
    return { canceled: false, ...(await database.backupDatabase(result.filePath)) };
  });
  ipcMain.handle('database:restore', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, { title: 'Restaurar copia de seguridad', properties: ['openFile'], filters: [{ name: 'Base de datos SQLite', extensions: ['sqlite', 'db'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const confirmation = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancelar', 'Restaurar'], defaultId: 0, cancelId: 0, title: 'Confirmar restauración', message: 'La restauración reemplazará todos los datos actuales.', detail: 'Esta acción no se puede deshacer. Creá una copia antes de continuar.' });
    if (confirmation.response !== 1) return { canceled: true };
    return { canceled: false, ...database.restoreDatabase(result.filePaths[0]) };
  });
  ipcMain.handle('report:export', async (_event, businessDate, format) => {
    const fs = require('node:fs/promises');
    const report = database.getDailyReport(businessDate);
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const result = await dialog.showSaveDialog({ title: 'Exportar reporte diario', defaultPath: `reporte-${businessDate}.${extension}`, filters: [{ name: extension === 'csv' ? 'CSV' : 'Excel', extensions: [extension] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (extension === 'xlsx') XLSX.writeFile(buildWorkbook(report.sales, report.expenses, report), result.filePath);
    else {
      const rows = [['Reporte diario', businessDate], ['Ventas', report.totalCents / 100], ['Pedidos', report.orders], ['Efectivo', report.paymentSplit.cashCents / 100], ['Tarjeta', report.paymentSplit.cardCents / 100], ['Costo', report.costCents / 100], ['Ganancia bruta', report.grossProfitCents / 100], ['Margen %', report.marginPercent], ['Gastos', report.expensesTotalCents / 100], ['Retiros de efectivo', report.withdrawalsTotalCents / 100], ['Apertura caja', report.cash.openingCents == null ? '' : report.cash.openingCents / 100], ['Esperado caja', report.cash.expectedCents == null ? '' : report.cash.expectedCents / 100], ['Contado caja', report.cash.countedCents == null ? '' : report.cash.countedCents / 100], ['Diferencia caja', report.cash.differenceCents == null ? '' : report.cash.differenceCents / 100], ['Estado caja', report.cash.status], [], ['Categoría', 'Total'], ...report.expenses.map((expense) => [expense.category, expense.total_cents / 100])];
      const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
      await fs.writeFile(result.filePath, rows.map((row) => row.map(escape).join(',')).join('\\n'), 'utf8');
    }
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle('cash:open', (_event, amountCents) => database.openCashRegister(amountCents));
  ipcMain.handle('cash:get', () => database.getCashRegister());
  ipcMain.handle('cash:close', (_event, countedCents) => database.closeCashRegister(countedCents));
  ipcMain.handle('settings:get', () => database.getSettings());
  ipcMain.handle('settings:update', (_event, input) => database.updateSettings(input));
  ipcMain.handle('ai:get-config', () => ({ ...database.getOllamaSettings(), ...credentials.getStatus() }));
  ipcMain.handle('ai:set-key', (_event, key) => { const result = credentials.saveApiKey(key); database.updateOllamaConfigured(true); return { ...database.getOllamaSettings(), ...result }; });
  ipcMain.handle('ai:clear-key', () => { const result = credentials.clearApiKey(); database.updateOllamaConfigured(false); return { ...database.getOllamaSettings(), ...result }; });
  ipcMain.handle('ai:save-model', (_event, model) => database.saveOllamaModel(model));
  ipcMain.handle('auth:login', (_event, input) => database.authenticateAdmin(input?.email, input?.password));
  ipcMain.handle('auth:change-password', (_event, input) => database.changeAdminPassword(input?.currentPassword, input?.newPassword));
  ipcMain.handle('export:data', async (_event, format) => {
    const fs = require('node:fs/promises');
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const result = await dialog.showSaveDialog({ title: 'Exportar historial de ventas', defaultPath: `historial-ventas.${extension}`, filters: [{ name: extension === 'csv' ? 'CSV' : 'Excel', extensions: [extension] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    const sales = database.listSales(10000);
    const expenses = database.listExpenses(10000);
    const rows = [['Venta', 'Fecha', 'Productos', 'Total', 'Método de pago', 'Efectivo recibido', 'Vuelto']];
    for (const sale of sales) rows.push([`#${sale.id}`, sale.created_at, sale.items.map((item) => `${item.quantity} x ${item.product_name}`).join(' | '), (sale.total_cents / 100).toFixed(2), sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta', (sale.amount_received_cents / 100).toFixed(2), (sale.change_cents / 100).toFixed(2)]);
    if (format === 'xlsx') {
      XLSX.writeFile(buildWorkbook(sales, expenses), result.filePath);
    } else {
      const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
      await fs.writeFile(result.filePath, rows.map((row) => row.map(escape).join(',')).join('\n'), 'utf8');
    }
    return { canceled: false, filePath: result.filePath };
  });
}

app.whenReady().then(() => { registerIpc(); database.getDatabase(); createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
