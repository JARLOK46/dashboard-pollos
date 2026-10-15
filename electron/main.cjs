const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const database = require('./database.cjs');
const credentials = require('./credentials.cjs');
const XLSX = require('xlsx');
const { buildWorkbook } = require('../scripts/export-report.cjs');

const AI_LIMITS = {
  question: 2000,
  prompt: 16000,
  sales: 30,
  products: 100,
  expenses: 30,
  contextMessages: 8,
  contextChars: 6000,
};
const OLLAMA_URL = 'https://ollama.com/api/chat';
function sanitizeSnapshot(value) {
  if (Array.isArray(value)) return value.map(sanitizeSnapshot);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      ![
        'image_path',
        'notes',
        'customer_name',
        'void_reason',
        'amount_received_cents',
        'change_cents',
      ].includes(key)
    )
      result[key] = sanitizeSnapshot(item);
  }
  return result;
}
function presentMoney(value, currency) {
  return { amount: Number(value || 0), currency };
}
function presentFinancialData(value, currency) {
  if (Array.isArray(value)) return value.map((item) => presentFinancialData(item, currency));
  if (!value || typeof value !== 'object') return value;
  if (typeof value.amount === 'number' && typeof value.currency === 'string') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (/(?:_cents|Cents)$/i.test(key) && typeof item === 'number') {
      const unitKey = key.replace(/(?:_cents|Cents)$/i, '');
      if (
        !Object.prototype.hasOwnProperty.call(value, unitKey) ||
        !value[unitKey] ||
        typeof value[unitKey] !== 'object'
      )
        result[unitKey] = presentMoney(item, currency);
    } else if (!Object.prototype.hasOwnProperty.call(result, key))
      result[key] = presentFinancialData(item, currency);
  }
  return result;
}
function buildAiSnapshot() {
  const today = database.getBusinessDate();
  const analytics = database.getSalesAnalytics({ from: today, to: today });
  const currency = database.getSettings().currency;
  return presentFinancialData(
    sanitizeSnapshot({
      moneda: currency,
      coberturaDatos: {
        fechaNegocio: today,
        fechaCalculada: "SQLite date('now','localtime')",
        ventasDelDia: 'Incluye el resumen exacto del día hábil local indicado.',
        historico:
          'No incluido: no hay datos suficientes para afirmar totales semanales o históricos completos.',
        limites: {
          ventasRecientes: AI_LIMITS.sales,
          productos: AI_LIMITS.products,
          gastosRecientes: AI_LIMITS.expenses,
        },
        advertencia:
          'Las listas recientes están truncadas; no representan el total histórico ni semanal.',
      },
      ventasHoy: {
        resumen: {
          totalCents: analytics.totalCents,
          costCents: analytics.costCents,
          grossProfitCents: analytics.grossProfitCents,
          marginPercent: analytics.marginPercent,
          orders: analytics.orders,
        },
        porDia: analytics.byDay,
        porPago: analytics.byPayment,
        porProducto: analytics.byProduct,
      },
      ventasRecientes: database.listSales(AI_LIMITS.sales).slice(0, AI_LIMITS.sales),
      productos: database
        .listProducts()
        .slice(0, AI_LIMITS.products)
        .map(({ id, name, price_cents, cost_cents, stock }) => ({
          id,
          name,
          price_cents,
          cost_cents,
          stock,
          margin_percent: price_cents ? ((price_cents - cost_cents) / price_cents) * 100 : 0,
        })),
      gastosRecientes: database.listExpenses(AI_LIMITS.expenses).slice(0, AI_LIMITS.expenses),
      reporteCajaHoy: database.getDailyReport(today),
      alertas: database.getDashboardAlerts(),
    }),
    currency,
  );
}
const AI_TOOL_NAMES = new Set([
  'create_expense',
  'cash_withdrawal',
  'stock_adjustment',
  'create_product',
  'void_sale',
]);
const EXPENSE_CATEGORIES = new Set(['insumos', 'servicios', 'personal', 'other']);
const textArg = (args, key, max = 200) =>
  typeof args[key] === 'string' && args[key].trim().length > 0 && args[key].trim().length <= max
    ? args[key].trim()
    : null;
const centsArg = (args, key, positive = true, allowZero = false) =>
  Number.isSafeInteger(args[key]) &&
  (positive ? (allowZero ? args[key] >= 0 : args[key] > 0) : args[key] !== 0) &&
  Math.abs(args[key]) <= 2147483647
    ? args[key]
    : null;
function validateAiToolCall(toolCall) {
  if (!toolCall || typeof toolCall !== 'object' || !AI_TOOL_NAMES.has(toolCall.name)) return null;
  const args = toolCall.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
  if (toolCall.name === 'create_expense') {
    const description = textArg(args, 'description');
    const category = typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
    const amountCents = centsArg(args, 'amountCents');
    return description && amountCents && EXPENSE_CATEGORIES.has(category)
      ? { name: toolCall.name, arguments: { description, amountCents, category } }
      : null;
  }
  if (toolCall.name === 'cash_withdrawal') {
    const reason = textArg(args, 'reason');
    const amountCents = centsArg(args, 'amountCents');
    return reason && amountCents
      ? { name: toolCall.name, arguments: { reason, amountCents } }
      : null;
  }
  if (toolCall.name === 'stock_adjustment') {
    const productId = args.productId;
    const quantityDelta = centsArg(args, 'quantityDelta', false);
    const reason = textArg(args, 'reason');
    return Number.isSafeInteger(productId) && productId > 0 && quantityDelta && reason
      ? { name: toolCall.name, arguments: { productId, quantityDelta, reason } }
      : null;
  }
  if (toolCall.name === 'void_sale') {
    const saleId = args.saleId;
    const reason = textArg(args, 'reason');
    const sale =
      args.sale && typeof args.sale === 'object' && !Array.isArray(args.sale)
        ? {
            total_cents:
              Number.isSafeInteger(args.sale.total_cents) && args.sale.total_cents >= 0
                ? args.sale.total_cents
                : undefined,
            items: Array.isArray(args.sale.items)
              ? args.sale.items
                  .slice(0, 20)
                  .filter((item) => item && typeof item === 'object')
                  .map((item) => ({
                    product_name:
                      typeof item.product_name === 'string'
                        ? item.product_name.slice(0, 120)
                        : 'Artículo',
                    quantity:
                      Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1,
                  }))
              : undefined,
          }
        : undefined;
    return Number.isSafeInteger(saleId) && saleId > 0 && reason
      ? { name: toolCall.name, arguments: { saleId, reason, ...(sale ? { sale } : {}) } }
      : null;
  }
  const name = textArg(args, 'name', 120);
  const description =
    typeof args.description === 'string' && args.description.trim().length <= 500
      ? args.description.trim()
      : null;
  const priceCents = centsArg(args, 'priceCents', true, true);
  const costCents = centsArg(args, 'costCents', true, true);
  const stock = args.stock;
  return name &&
    description !== null &&
    priceCents !== null &&
    costCents !== null &&
    Number.isSafeInteger(stock) &&
    stock >= 0 &&
    stock <= 2147483647
    ? { name: toolCall.name, arguments: { name, description, priceCents, costCents, stock } }
    : null;
}
function parseAiResponse(text, currency) {
  const fallback = {
    text: text.trim(),
    period: null,
    source: 'Datos operativos locales',
    metrics: [],
    toolCall: null,
    currency,
  };
  let candidate = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const metrics = Array.isArray(parsed.metrics)
      ? parsed.metrics
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            label: String(item.label || item.name || 'Métrica'),
            value: String(item.value ?? ''),
            detail: item.detail ? String(item.detail) : undefined,
          }))
      : [];
    return {
      text:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : typeof parsed.text === 'string'
            ? parsed.text
            : fallback.text,
      period: parsed.period ? String(parsed.period) : null,
      source: parsed.source ? String(parsed.source) : fallback.source,
      metrics,
      toolCall: validateAiToolCall(parsed.toolCall),
      currency,
    };
  } catch {
    return fallback;
  }
}
async function analyzeWithOllama(question, history = [], mode = 'question') {
  if (typeof question !== 'string' || !question.trim())
    throw new Error('La pregunta es obligatoria.');
  if (question.trim().length > AI_LIMITS.question)
    throw new Error('La pregunta es demasiado larga.');
  const settings = database.getOllamaSettings();
  if (!settings.model) throw new Error('El modelo seleccionado no es válido.');
  const key = credentials.getApiKey();
  const snapshot = buildAiSnapshot();
  const outputContract = `Devolvé JSON válido (sin markdown) con esta forma: {"summary":"respuesta breve en español","period":"período analizado","source":"fuente de datos","metrics":[{"label":"nombre","value":"importe completo o valor","detail":"opcional"}],"toolCall":null}. Solo podés proponer, nunca ejecutar, toolCall para una acción explícitamente solicitada: gasto {"name":"create_expense","arguments":{"description":"texto","amountCents":5000,"category":"insumos|servicios|personal|other"}}, retiro {"name":"cash_withdrawal","arguments":{"reason":"texto","amountCents":15000}}, ajuste de stock {"name":"stock_adjustment","arguments":{"productId":1,"quantityDelta":-2,"reason":"texto"}} o producto {"name":"create_product","arguments":{"name":"texto","description":"texto","priceCents":15000,"costCents":5000,"stock":10}} o anulación de venta {"name":"void_sale","arguments":{"saleId":123,"reason":"motivo claro"}}. Para pedidos de reporte diario, usá los datos de reporte ya presentes en ventas, gastos, retiros, caja, ganancia bruta y alertas, y expresá una respuesta estructurada con métricas claras; el reporte es solo de lectura y nunca requiere confirmación. Todos los campos son estrictos (importes enteros en unidades completas de COP, IDs positivos, texto acotado). Nunca ejecutes herramientas ni afirmes que registraste nada: toolCall es únicamente una propuesta explícita pendiente de confirmación humana. Para cualquier otra consulta, toolCall debe ser null. Si no podés cumplirlo, respondé texto plano. Los importes del snapshot, de las respuestas y de los argumentos monetarios de toolCall son unidades completas de ${snapshot.moneda}; no conviertas ni dividas por 100 (por ejemplo, ${snapshot.moneda} 5000 -> amountCents 5000 y ${snapshot.moneda} 15000 -> priceCents 15000).`;
  const boundedHistory = Array.isArray(history)
    ? history
        .slice(-AI_LIMITS.contextMessages)
        .map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: String(item.content || '').slice(0, 1500),
        }))
        .slice(-AI_LIMITS.contextMessages)
    : [];
  const prompt = `Sos un asesor operativo para una pollería. Respondé exclusivamente en español, con recomendaciones concretas, prudentes y basadas únicamente en los datos provistos. No inventes datos, no ejecutes acciones, no pidas secretos y aclarà las limitaciones. Las listas del snapshot pueden estar truncadas: revisá coberturaDatos antes de concluir. No presentes ventas recientes, productos o gastos recientes como totales completos. No afirmes totales semanales, mensuales o históricos completos salvo que estén explícitamente calculados y respaldados por los datos provistos; si faltan datos, decilo claramente.\n\nREGLA MONETARIA OBLIGATORIA: la moneda del negocio es COP. Todos los importes financieros del snapshot y de las herramientas son unidades enteras de COP (por ejemplo, {"amount":5000,"currency":"COP"}); no los dividas ni multipliques por 100. En texto y métricas conservá esas unidades enteras. Si proponés una herramienta, enviá los importes directamente como enteros en amountCents, priceCents o costCents (COP 5000 se envía como 5000). Conservá la moneda COP.\n\n${outputContract}\n\nModo: ${mode === 'daily-summary' ? 'generá un resumen diario accionable del negocio usando explícitamente ventas, gastos, retiros, estado/diferencia de caja, ganancia bruta y alertas; representá cada dato importante en metrics para facilitar su renderizado' : 'respondé la pregunta'}\nPregunta del dueño: ${question.trim()}\nDatos sanitizados: ${JSON.stringify(snapshot)}`;
  const contextText = JSON.stringify(boundedHistory);
  const fullPrompt = `${prompt}\nContexto reciente (solo lectura): ${contextText}`;
  if (fullPrompt.length > AI_LIMITS.prompt)
    throw new Error('El resumen de datos excede el límite permitido.');
  const controller = new AbortController();
  // Cloud models, especially larger variants, may need more than 30 seconds to start and generate a response.
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        messages: [...boundedHistory, { role: 'user', content: fullPrompt }],
        stream: false,
      }),
    });
    if (!response.ok)
      throw new Error(`Ollama Cloud rechazó la solicitud (HTTP ${response.status}).`);
    const payload = await response.json();
    const text = payload?.message?.content;
    if (typeof text !== 'string' || !text.trim())
      throw new Error('Ollama Cloud devolvió una respuesta inválida.');
    return {
      ...parseAiResponse(text, snapshot.moneda),
      rawText: text.trim(),
      timestamp: new Date().toISOString(),
      model: settings.model,
    };
  } catch (error) {
    if (error?.name === 'AbortError')
      throw new Error(
        'Ollama Cloud tardó más de 2 minutos en responder. Probá con un modelo más liviano como gpt-oss:20b o revisá tu conexión.',
      );
    if (
      error?.message?.startsWith('Ollama Cloud') ||
      error?.message?.startsWith('La consulta') ||
      error?.message?.startsWith('Ollama Cloud devolvió')
    )
      throw error;
    throw new Error('No se pudo conectar con Ollama Cloud.');
  } finally {
    clearTimeout(timer);
  }
}

const isDev = !app.isPackaged;
const applicationWindows = new Set();
const authenticatedSenders = new Map();

function getApplicationWindow(event) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !applicationWindows.has(window)) throw new Error('Acceso IPC no autorizado.');
  return window;
}

function requireAuthenticatedSender(event) {
  const window = getApplicationWindow(event);
  const session = authenticatedSenders.get(event.sender);
  if (!session || session.window !== window) throw new Error('La sesión requiere autenticación.');
  return window;
}

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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  applicationWindows.add(window);
  const webContents = window.webContents;
  let cleanedUp = false;
  const cleanupWindow = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    authenticatedSenders.delete(webContents);
    applicationWindows.delete(window);
  };
  webContents.once('destroyed', cleanupWindow);
  window.on('closed', cleanupWindow);
  if (isDev) window.loadURL('http://localhost:5173');
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

function registerIpc() {
  const { ipcMain, dialog } = require('electron');
  const currentActor = (event) => authenticatedSenders.get(event.sender)?.email || 'local-operator';
  const audit = (event, action, entityType, entityId, metadata = {}) =>
    database.recordAudit(action, entityType, entityId, metadata, currentActor(event));
  const protectedHandle = (channel, listener) =>
    ipcMain.handle(channel, (event, ...args) => {
      requireAuthenticatedSender(event);
      return listener(event, ...args);
    });
  ipcMain.on('window:minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.on('window:close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle(
    'window:is-maximized',
    (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  );
  protectedHandle('products:list', () => database.listProducts());
  protectedHandle('products:create', (event, input) => { const result = database.createProduct(input); audit(event, 'product.create', 'product', result.id, { name: result.name }); return result; });
  protectedHandle('products:update', (event, input) => { const result = database.updateProduct(input); audit(event, 'product.update', 'product', result.id, { name: result.name }); return result; });
  protectedHandle('products:archive', (event, input) => { const result = database.archiveProduct(input); audit(event, 'product.archive', 'product', result.id); return result; });
  protectedHandle('products:adjust-stock', (event, input) => { const result = database.adjustProductStock(input); audit(event, 'inventory.adjust', 'product', result.id, { quantityDelta: input.quantityDelta, reason: input.reason }); return result; });
  protectedHandle('products:movements', (_event, productId, limit, filters) =>
    database.listInventoryMovements(productId, limit, filters),
  );
  protectedHandle('tables:list', () => database.listDiningTables());
  protectedHandle('tables:get-order', (_event, tableId) => database.getTableOrder(tableId));
  protectedHandle('tables:save-order', (event, input) => { const result = database.saveTableOrder(input); audit(event, 'table.order.save', 'table_order', result.id, { tableId: result.table_id, itemCount: result.items.length }); return result; });
  protectedHandle('tables:clear-order', (event, tableId) => { const result = database.clearTableOrder(tableId); audit(event, 'table.order.clear', 'dining_table', tableId); return result; });
  protectedHandle('tables:pay-order', (event, input) => { const result = database.payTableOrder(input); audit(event, 'table.order.pay', 'sale', result.id, { tableId: input.tableId, paymentMethod: result.payment_method, totalCents: result.total_cents }); return result; });
  protectedHandle('sales:create', (event, input) => { const result = database.createSale(input); audit(event, 'sale.create', 'sale', result.id, { paymentMethod: result.payment_method, totalCents: result.total_cents }); return result; });
  protectedHandle('sales:void', (event, id, reason) => { const result = database.voidSale(id, reason); audit(event, 'sale.void', 'sale', id, { reason }); return result; });
  protectedHandle('sales:list', (_event, limit, filters) => database.listSales(limit, filters));
  protectedHandle('sales:analytics', (_event, filters) => database.getSalesAnalytics(filters));
  protectedHandle('sales:get', (_event, id) => database.getSale(id));
  protectedHandle('expenses:create', (event, input) => { const result = database.createExpense(input); audit(event, 'expense.create', 'expense', result.id, { amountCents: result.amount_cents, category: result.category }); return result; });
  protectedHandle('expenses:list', (_event, limit) => database.listExpenses(limit));
  protectedHandle('cash:withdraw', (event, input) => { const result = database.createWithdrawal(input); audit(event, 'cash.withdrawal', 'cash_movement', result.id, { amountCents: input.amountCents }); return result; });
  protectedHandle('dashboard:summary', () => database.getDashboardSummary());
  protectedHandle('dashboard:alerts', () => database.getDashboardAlerts());
  protectedHandle('diagnostics:list', () => database.getDiagnostics());
  protectedHandle('database:automatic-status', () => database.getAutomaticBackupStatus());
  protectedHandle('report:daily', (_event, businessDate) => database.getDailyReport(businessDate));
  protectedHandle('database:backup', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      title: 'Crear copia de seguridad',
      defaultPath: 'pollo-caja-backup.sqlite',
      filters: [{ name: 'Base de datos SQLite', extensions: ['sqlite', 'db'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (fs.existsSync(result.filePath)) {
      const confirmation = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancelar', 'Reemplazar'],
        defaultId: 0,
        cancelId: 0,
        title: 'Reemplazar copia existente',
        message: 'Ya existe una copia en esa ubicación.',
        detail: '¿Querés reemplazarla de forma segura?',
        noLink: true,
      });
      if (confirmation.response !== 1) return { canceled: true };
    }
    const backup = await database.backupDatabase(result.filePath);
    audit(event, 'database.backup', 'database', null, { filePath: result.filePath });
    return { canceled: false, ...backup };
  });
  protectedHandle('database:restore', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: 'Restaurar copia de seguridad',
      properties: ['openFile'],
      filters: [{ name: 'Base de datos SQLite', extensions: ['sqlite', 'db'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const confirmation = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancelar', 'Restaurar'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirmar restauración',
      message: 'La restauración reemplazará todos los datos actuales.',
      detail: 'Esta acción no se puede deshacer. Creá una copia antes de continuar.',
    });
    if (confirmation.response !== 1) return { canceled: true };
    const restored = database.restoreDatabase(result.filePaths[0]);
    database.recordAudit('database.restore', 'database', null, { sourcePath: result.filePaths[0] }, currentActor(event));
    return { canceled: false, ...restored };
  });
  protectedHandle('report:export', async (_event, businessDate, format) => {
    const fs = require('node:fs/promises');
    const report = database.getDailyReport(businessDate);
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const result = await dialog.showSaveDialog({
      title: 'Exportar reporte diario',
      defaultPath: `reporte-${businessDate}.${extension}`,
      filters: [{ name: extension === 'csv' ? 'CSV' : 'Excel', extensions: [extension] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (extension === 'xlsx')
      XLSX.writeFile(buildWorkbook(report.sales, report.expenses, report, { products: database.listProducts(), cash: database.getCashRegister(), period: businessDate }), result.filePath);
    else {
      const rows = [
        ['Reporte diario', businessDate],
        ['Moneda', 'COP'],
        ['Ventas', report.totalCents ],
        ['Pedidos', report.orders],
        ['Efectivo', report.paymentSplit.cashCents ],
        ['Tarjeta', report.paymentSplit.cardCents ],
        ['Costo', report.costCents ],
        ['Ganancia bruta', report.grossProfitCents ],
        ['Margen %', report.marginPercent],
        ['Gastos', report.expensesTotalCents ],
        ['Retiros de efectivo', report.withdrawalsTotalCents ],
        ['Apertura caja', report.cash.openingCents == null ? '' : report.cash.openingCents ],
        ['Esperado caja', report.cash.expectedCents == null ? '' : report.cash.expectedCents ],
        ['Contado caja', report.cash.countedCents == null ? '' : report.cash.countedCents ],
        [
          'Diferencia caja',
          report.cash.differenceCents == null ? '' : report.cash.differenceCents ,
        ],
        ['Estado caja', report.cash.status],
        [],
        ['Categoría', 'Total'],
        ...report.expenses.map((expense) => [expense.category, expense.total_cents ]),
      ];
      const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
      await fs.writeFile(
        result.filePath,
        rows.map((row) => row.map(escape).join(',')).join('\\n'),
        'utf8',
      );
    }
    audit(_event, 'report.export', 'report', null, { businessDate, format: extension });
    return { canceled: false, filePath: result.filePath };
  });
  protectedHandle('cash:open', (event, amountCents) => { const result = database.openCashRegister(amountCents); audit(event, 'cash.open', 'cash_register', result.id, { amountCents }); return result; });
  protectedHandle('cash:get', () => database.getCashRegister());
  protectedHandle('cash:close', async (event, countedCents) => {
    const result = database.closeCashRegister(countedCents);
    audit(event, 'cash.close', 'cash_register', result.id, { countedCents, differenceCents: result.differenceCents });
    try {
      await database.createAutomaticBackup('cash-close');
    } catch {
      // Cash close is already committed; backup status/error is persisted for visibility.
    }
    return result;
  });
  protectedHandle('settings:get', () => database.getSettings());
  protectedHandle('settings:update', (event, input) => { const result = database.updateSettings(input); audit(event, 'settings.update', 'settings', null, { keys: ['businessName', 'currency', 'lowStockThreshold'] }); return result; });
  protectedHandle('ai:sessions:list', (_event, limit) => database.listAiSessions(limit));
  protectedHandle('ai:sessions:get', (_event, id) => database.getAiSession(id));
  protectedHandle('ai:sessions:delete', (_event, id) => database.deleteAiSession(id));
  protectedHandle('ai:sessions:create', (_event, input) => database.createAiSession(input));
  protectedHandle('ai:sessions:get-or-create', (_event, input) =>
    database.getOrCreateAiSession(input),
  );
  protectedHandle('ai:sessions:append', (_event, input) => database.appendAiMessage(input));
  protectedHandle('ai:messages:claim', (_event, input) => database.claimAiMessage(input));
  protectedHandle('ai:messages:complete', (_event, input) => database.completeAiMessage(input));
  protectedHandle('ai:messages:cancel', (_event, input) => database.cancelAiMessage(input));
  protectedHandle('ai:get-config', () => ({
    ...database.getOllamaSettings(),
    ...credentials.getStatus(),
  }));
  protectedHandle('ai:set-key', (_event, key) => {
    const result = credentials.saveApiKey(key);
    database.updateOllamaConfigured(true);
    return { ...database.getOllamaSettings(), ...result };
  });
  protectedHandle('ai:clear-key', () => {
    const result = credentials.clearApiKey();
    database.updateOllamaConfigured(false);
    return { ...database.getOllamaSettings(), ...result };
  });
  protectedHandle('ai:save-model', (_event, model) => database.saveOllamaModel(model));
  protectedHandle('ai:analyze', (_event, question, history, mode) =>
    analyzeWithOllama(question, history, mode),
  );
  ipcMain.handle('auth:login', (event, input) => {
    const window = getApplicationWindow(event);
    const authenticated = database.authenticateAdmin(input?.email, input?.password);
    if (authenticated)
      authenticatedSenders.set(event.sender, {
        window,
        email: input?.email,
        authenticatedAt: Date.now(),
      });
    return authenticated;
  });
  protectedHandle('auth:logout', (event) => {
    authenticatedSenders.delete(event.sender);
    return { loggedOut: true };
  });
  protectedHandle('auth:change-password', (_event, input) =>
    database.changeAdminPassword(input?.currentPassword, input?.newPassword),
  );
  protectedHandle('export:data', async (_event, format, filters = {}) => {
    const fs = require('node:fs/promises');
    const extension = format === 'csv' ? 'csv' : 'xlsx';
    const result = await dialog.showSaveDialog({
      title: 'Exportar historial de ventas',
      defaultPath: `historial-ventas.${extension}`,
      filters: [{ name: extension === 'csv' ? 'CSV' : 'Excel', extensions: [extension] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const safeFilters = {
      from: typeof filters?.from === 'string' ? filters.from : undefined,
      to: typeof filters?.to === 'string' ? filters.to : undefined,
      paymentMethod: ['all', 'cash', 'card'].includes(filters?.paymentMethod) ? filters.paymentMethod : 'all',
      status: ['all', 'active', 'voided'].includes(filters?.status) ? filters.status : 'active',
    };
    const sales = database.listSales(10000, safeFilters);
    const expenses = database.listExpenses(10000, safeFilters);
    const rows = [
      ['Venta', 'Fecha', 'Productos', 'Total (COP)', 'Método de pago', 'Efectivo recibido (COP)', 'Vuelto (COP)'],
    ];
    for (const sale of sales)
      rows.push([
        `#${sale.id}`,
        sale.created_at,
        sale.items.map((item) => `${item.quantity} x ${item.product_name}`).join(' | '),
        (sale.total_cents ),
        sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta',
        (sale.amount_received_cents ),
        (sale.change_cents ),
      ]);
    if (format === 'xlsx') {
      XLSX.writeFile(buildWorkbook(sales, expenses, null, { products: database.listProducts(), cash: database.getCashRegister(), period: `${safeFilters.from || 'Inicio'} – ${safeFilters.to || 'Hoy'}` }), result.filePath);
    } else {
      const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
      await fs.writeFile(
        result.filePath,
        rows.map((row) => row.map(escape).join(',')).join('\n'),
        'utf8',
      );
    }
    audit(_event, 'sales.export', 'export', null, { format: extension, filters: safeFilters });
    return { canceled: false, filePath: result.filePath };
  });
}

app.whenReady().then(() => {
  registerIpc();
  database.getDatabase();
  void database.createAutomaticBackup('startup').catch(() => {});
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
