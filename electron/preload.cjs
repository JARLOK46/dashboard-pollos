const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('salesApi', {
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    create: (input) => ipcRenderer.invoke('products:create', input),
    update: (input) => ipcRenderer.invoke('products:update', input),
  },
  sales: {
    create: (input) => ipcRenderer.invoke('sales:create', input),
    list: (limit) => ipcRenderer.invoke('sales:list', limit),
    get: (id) => ipcRenderer.invoke('sales:get', id),
  },
  expenses: {
    create: (input) => ipcRenderer.invoke('expenses:create', input),
    list: (limit) => ipcRenderer.invoke('expenses:list', limit),
  },
  dashboard: { summary: () => ipcRenderer.invoke('dashboard:summary') },
  export: (format) => ipcRenderer.invoke('export:data', format),
  window: { minimize: () => ipcRenderer.send('window:minimize'), maximize: () => ipcRenderer.send('window:maximize'), close: () => ipcRenderer.send('window:close'), isMaximized: () => ipcRenderer.invoke('window:is-maximized') },
  settings: { get: () => ipcRenderer.invoke('settings:get') },
  cash: { open: (amountCents) => ipcRenderer.invoke('cash:open', amountCents), get: () => ipcRenderer.invoke('cash:get'), close: (countedCents) => ipcRenderer.invoke('cash:close', countedCents) },
});
