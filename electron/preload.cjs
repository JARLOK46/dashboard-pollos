const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('salesApi', {
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    create: (input) => ipcRenderer.invoke('products:create', input),
    update: (input) => ipcRenderer.invoke('products:update', input),
    adjustStock: (input) => ipcRenderer.invoke('products:adjust-stock', input),
    movements: (productId, limit, filters) => ipcRenderer.invoke('products:movements', productId, limit, filters),
  },
  sales: {
    create: (input) => ipcRenderer.invoke('sales:create', input),
    list: (limit, filters) => ipcRenderer.invoke('sales:list', limit, filters),
    analytics: (filters) => ipcRenderer.invoke('sales:analytics', filters),
    get: (id) => ipcRenderer.invoke('sales:get', id),
  },
  expenses: {
    create: (input) => ipcRenderer.invoke('expenses:create', input),
    list: (limit) => ipcRenderer.invoke('expenses:list', limit),
  },
  dashboard: { summary: () => ipcRenderer.invoke('dashboard:summary'), alerts: () => ipcRenderer.invoke('dashboard:alerts') },
  report: { daily: (businessDate) => ipcRenderer.invoke('report:daily', businessDate), export: (businessDate, format) => ipcRenderer.invoke('report:export', businessDate, format) },
  export: (format) => ipcRenderer.invoke('export:data', format),
  database: { backup: () => ipcRenderer.invoke('database:backup'), restore: () => ipcRenderer.invoke('database:restore') },
  window: { minimize: () => ipcRenderer.send('window:minimize'), maximize: () => ipcRenderer.send('window:maximize'), close: () => ipcRenderer.send('window:close'), isMaximized: () => ipcRenderer.invoke('window:is-maximized') },
  settings: { get: () => ipcRenderer.invoke('settings:get'), update: (input) => ipcRenderer.invoke('settings:update', input), changePassword: (input) => ipcRenderer.invoke('auth:change-password', input) },
  auth: { login: (input) => ipcRenderer.invoke('auth:login', input) },
  cash: { open: (amountCents) => ipcRenderer.invoke('cash:open', amountCents), get: () => ipcRenderer.invoke('cash:get'), close: (countedCents) => ipcRenderer.invoke('cash:close', countedCents) },
});
