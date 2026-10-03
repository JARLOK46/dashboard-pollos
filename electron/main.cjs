const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const database = require('./database.cjs');

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f7f8fa',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
  });

  if (isDev) {
    window.loadURL('http://localhost:5173');
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function registerIpc() {
  const { ipcMain } = require('electron');
  ipcMain.handle('products:list', () => database.listProducts());
  ipcMain.handle('products:create', (_event, input) => database.createProduct(input));
  ipcMain.handle('products:update', (_event, input) => database.updateProduct(input));
  ipcMain.handle('sales:create', (_event, input) => database.createSale(input));
  ipcMain.handle('sales:list', (_event, limit) => database.listSales(limit));
  ipcMain.handle('sales:get', (_event, id) => database.getSale(id));
  ipcMain.handle('expenses:create', (_event, input) => database.createExpense(input));
  ipcMain.handle('expenses:list', (_event, limit) => database.listExpenses(limit));
  ipcMain.handle('dashboard:summary', () => database.getDashboardSummary());
  ipcMain.handle('export:data', async (_event, format) => {
    const { dialog } = require('electron');
    const fs = require('node:fs/promises');
    const result = await dialog.showSaveDialog({
      title: 'Exportar historial de ventas',
      defaultPath: `historial-ventas.${format === 'csv' ? 'csv' : 'xlsx'}`,
      filters: [{ name: format === 'csv' ? 'CSV' : 'Excel', extensions: [format === 'csv' ? 'csv' : 'xlsx'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const sales = database.listSales(10000);
    const rows = [['Venta', 'Fecha', 'Productos', 'Total', 'Método de pago', 'Efectivo recibido', 'Vuelto']];
    for (const sale of sales) rows.push([`#${sale.id}`, sale.created_at, sale.items.map((item) => `${item.quantity} x ${item.product_name}`).join(' | '), (sale.total_cents / 100).toFixed(2), sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta', (sale.amount_received_cents / 100).toFixed(2), (sale.change_cents / 100).toFixed(2)]);
    const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
    await fs.writeFile(result.filePath, rows.map((row) => row.map(escape).join(',')).join('\\n'), 'utf8');
    return { canceled: false, filePath: result.filePath };
  });
}

app.whenReady().then(() => {
  registerIpc();
  database.getDatabase();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
