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
});
