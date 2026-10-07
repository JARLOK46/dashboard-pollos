const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('salesApi', {
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    create: (input) => ipcRenderer.invoke('products:create', input),
    update: (input) => ipcRenderer.invoke('products:update', input),
    archive: (input) => ipcRenderer.invoke('products:archive', input),
    adjustStock: (input) => ipcRenderer.invoke('products:adjust-stock', input),
    movements: (productId, limit, filters) =>
      ipcRenderer.invoke('products:movements', productId, limit, filters),
  },
  sales: {
    create: (input) => ipcRenderer.invoke('sales:create', input),
    void: (id, reason) => ipcRenderer.invoke('sales:void', id, reason),
    list: (limit, filters) => ipcRenderer.invoke('sales:list', limit, filters),
    analytics: (filters) => ipcRenderer.invoke('sales:analytics', filters),
    get: (id) => ipcRenderer.invoke('sales:get', id),
  },
  expenses: {
    create: (input) => ipcRenderer.invoke('expenses:create', input),
    list: (limit) => ipcRenderer.invoke('expenses:list', limit),
  },
  dashboard: {
    summary: () => ipcRenderer.invoke('dashboard:summary'),
    alerts: () => ipcRenderer.invoke('dashboard:alerts'),
  },
  report: {
    daily: (businessDate) => ipcRenderer.invoke('report:daily', businessDate),
    export: (businessDate, format) => ipcRenderer.invoke('report:export', businessDate, format),
  },
  export: (format) => ipcRenderer.invoke('export:data', format),
  database: {
    backup: () => ipcRenderer.invoke('database:backup'),
    restore: () => ipcRenderer.invoke('database:restore'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input) => ipcRenderer.invoke('settings:update', input),
    changePassword: (input) => ipcRenderer.invoke('auth:change-password', input),
  },
  ai: {
    sessions: {
      list: (limit) => ipcRenderer.invoke('ai:sessions:list', limit),
      get: (id) => ipcRenderer.invoke('ai:sessions:get', id),
      create: (input) => ipcRenderer.invoke('ai:sessions:create', input),
      getOrCreate: (input) => ipcRenderer.invoke('ai:sessions:get-or-create', input),
      append: (input) => ipcRenderer.invoke('ai:sessions:append', input),
    },
    getConfig: () => ipcRenderer.invoke('ai:get-config'),
    setKey: (key) => ipcRenderer.invoke('ai:set-key', key),
    clearKey: () => ipcRenderer.invoke('ai:clear-key'),
    saveModel: (model) => ipcRenderer.invoke('ai:save-model', model),
    analyze: (question, history, mode) => ipcRenderer.invoke('ai:analyze', question, history, mode),
  },
  auth: { login: (input) => ipcRenderer.invoke('auth:login', input) },
  cash: {
    open: (amountCents) => ipcRenderer.invoke('cash:open', amountCents),
    get: () => ipcRenderer.invoke('cash:get'),
    close: (countedCents) => ipcRenderer.invoke('cash:close', countedCents),
    withdraw: (input) => ipcRenderer.invoke('cash:withdraw', input),
  },
});
