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
