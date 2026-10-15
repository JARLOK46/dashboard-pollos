import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Product = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  cost_cents: number;
  stock: number;
  image_path: string | null;
};
type SaleItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  unit_cost_cents?: number;
  cost_total_cents?: number;
};
type SaleInput = {
  totalCents: number;
  paymentMethod: 'cash' | 'card';
  amountReceivedCents: number;
  changeCents: number;
  customerName?: string;
  notes?: string;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
};
type ProductInput = {
  id?: number;
  name: string;
  description: string;
  priceCents: number;
  costCents: number;
  stock: number;
  imagePath: string | null;
};
type AiToolStatus = 'pending' | 'claimed' | 'completed' | 'failed' | 'cancelled';
type AiToolCall =
  | {
      name: 'create_expense';
      arguments: { description: string; amountCents: number; category: string };
    }
  | { name: 'cash_withdrawal'; arguments: { reason: string; amountCents: number } }
  | {
      name: 'stock_adjustment';
      arguments: { productId: number; quantityDelta: number; reason: string };
    }
  | {
      name: 'create_product';
      arguments: {
        name: string;
        description: string;
        priceCents: number;
        costCents: number;
        stock: number;
      };
    }
  | {
      name: 'void_sale';
      arguments: {
        saleId: number;
        reason: string;
        sale?: { total_cents?: number; items?: Array<{ product_name: string; quantity: number }> };
      };
    };
type Sale = {
  id: number;
  table_id?: number | null;
  total_cents: number;
  payment_method: 'cash' | 'card';
  amount_received_cents: number;
  change_cents: number;
  customer_name?: string;
  notes?: string;
  status?: 'active' | 'voided';
  voided_at?: string | null;
  void_reason?: string | null;
  void_record_reason?: string | null;
  void_recorded_at?: string | null;
  created_at: string;
  items: SaleItem[];
};
type DiningTable = {
  id: number;
  name: string;
  active: number;
  order_id: number | null;
  customer_name: string | null;
  notes: string | null;
  order_created_at: string | null;
  order_updated_at: string | null;
  item_count: number;
  unit_count: number;
  total_cents: number;
};
type Page =
  | 'dashboard'
  | 'tables'
  | 'products'
  | 'checkout'
  | 'history'
  | 'expenses'
  | 'cash'
  | 'reports'
  | 'settings'
  | 'ai';
type SettingsData = { businessName: string; currency: string; lowStockThreshold: number; tableCount: number };
type AutomaticBackupStatus = {
  directory: string;
  retention: 1;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastPath: string | null;
  lastTrigger: string | null;
};
const OLLAMA_MODELS = [
  { id: 'gpt-oss:20b', label: 'GPT OSS 20B' },
  { id: 'gpt-oss:120b', label: 'GPT OSS 120B' },
  { id: 'gemma4:31b', label: 'Gemma 4 31B' },
  { id: 'nemotron-3-nano:30b', label: 'Nemotron 3 Nano 30B' },
  { id: 'nemotron-3-super', label: 'Nemotron 3 Super' },
  { id: 'nemotron-3-ultra', label: 'Nemotron 3 Ultra' },
];
type DashboardAlert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  page: Page;
};
const money = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    amount,
  );
function formatAIOutput(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+[.)]\s+/gm, (match) => `${match.trim().replace(/[.)]$/, '')}. `)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const today = () =>
  new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
const dateInput = (date: Date) => date.toISOString().slice(0, 10);
const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from: dateInput(from), to: dateInput(to) };
};

function App() {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('pollo-caja-theme') === 'dark',
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@gmail.com');
  const [page, setPage] = useState<Page>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<{
    salesTodayCents: number;
    ordersToday: number;
    expensesTodayCents: number;
    lowStock: Product[];
  } | null>(null);
  const [settings, setSettings] = useState<SettingsData>({
    businessName: 'Pollo & Caja',
    currency: 'COP',
    lowStockThreshold: 10,
    tableCount: 12,
  });
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [tableOrderDirty, setTableOrderDirty] = useState(false);
  const refresh = async () => {
    const [p, s, d, config, currentAlerts] = await Promise.all([
      window.salesApi.products.list(),
      window.salesApi.sales.list(100),
      window.salesApi.dashboard.summary(),
      window.salesApi.settings.get(),
      window.salesApi.dashboard.alerts(),
    ]);
    setProducts(p);
    setSales(s as Sale[]);
    setSummary(d as typeof summary);
    setSettings(config);
    setAlerts(currentAlerts as DashboardAlert[]);
  };
  useEffect(() => {
    if (authenticated) void refresh();
  }, [authenticated]);
  useEffect(() => {
    localStorage.setItem('pollo-caja-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  const navigate = (next: Page) => {
    if (tableOrderDirty && !window.confirm('Hay un pedido de mesa con cambios sin guardar. ¿Descartarlos y continuar?')) return;
    if (tableOrderDirty) setTableOrderDirty(false);
    setPage(next);
  };
  if (!authenticated)
    return (
      <>
        <TitleBar />
        <Login
          onLogin={(email) => {
            setAdminEmail(email);
            setAuthenticated(true);
          }}
        />
      </>
    );
  const logout = async () => {
    if (tableOrderDirty && !window.confirm('Hay un pedido de mesa con cambios sin guardar. ¿Descartarlos y cerrar sesión?')) return;
    if (tableOrderDirty) setTableOrderDirty(false);
    await window.salesApi.auth.logout();
    setAuthenticated(false);
    setPage('dashboard');
    setAlerts([]);
    setProducts([]);
    setSales([]);
    setSummary(null);
  };
  return (
    <div className={darkMode ? 'app-shell dark-theme' : 'app-shell'}>
      <TitleBar />
      <div className="theme-shell" />
      <Sidebar page={page} navigate={navigate} />
      <main className="main-content">
        <header className={`topbar ${page === 'dashboard' ? 'service-pulse' : ''}`}>
          <div>
            <p className="eyebrow">{today().toUpperCase()}</p>
            <h1>
              {page === 'dashboard'
                ? `Buen día, ${settings.businessName} 👋`
                : page === 'tables'
                  ? 'Mesas'
                  : page === 'products'
                    ? 'Productos'
                  : page === 'checkout'
                    ? 'Nueva venta'
                    : page === 'settings'
                      ? 'Configuración'
                      : page === 'reports'
                        ? 'Reportes'
                        : page === 'ai'
                          ? 'Asistente IA'
                          : 'Historial de ventas'}
            </h1>
            <p className="subtitle">
              {page === 'dashboard'
                ? 'Este es el resumen de tu negocio hoy.'
                : page === 'ai'
                  ? 'Entendé tu operación con ayuda de inteligencia artificial.'
                  : 'Gestioná tu operación de forma simple y rápida.'}
            </p>
          </div>
          <div className="top-actions">
            <NotificationCenter alerts={alerts} navigate={navigate} />
            <button
              className="theme-toggle"
              title={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? '☀' : '☾'}
            </button>
            <ProfileMenu email={adminEmail} navigate={navigate} onLogout={logout} />
          </div>
        </header>
        {page === 'dashboard' && <Dashboard summary={summary} sales={sales} navigate={navigate} />}
        {page === 'tables' && (
          <Tables
            products={products}
            settings={settings}
            onDirtyChange={setTableOrderDirty}
            onChanged={async () => {
              await refresh();
            }}
          />
        )}
        {page === 'products' && (
          <Products products={products} refresh={refresh} navigate={navigate} />
        )}
        {page === 'checkout' && (
          <Checkout
            products={products}
            onSaved={async () => {
              await refresh();
              navigate('history');
            }}
          />
        )}
        {page === 'history' && <History sales={sales} onVoided={refresh} />}
        {page === 'reports' && <Reports />}
        {page === 'expenses' && <Expenses onChanged={refresh} />}
        {page === 'cash' && <CashRegister onChanged={refresh} />}
        {page === 'settings' && (
          <Settings
            settings={settings}
            onSaved={async () => {
              await refresh();
            }}
          />
        )}
        {page === 'ai' && <AIWorkspace refresh={refresh} />}
      </main>
      <AIChat visible={page !== 'ai'} refresh={refresh} />
    </div>
  );
}
function ExpenseToolPreview({
  toolCall,
  currency,
  onCancel,
  onStatus,
  refresh,
  messageId,
  sessionId,
  toolStatus = 'pending',
  toolError,
}: {
  toolCall: AiToolCall;
  currency: string;
  onCancel: () => void;
  onStatus: (status: AiToolStatus, error?: string | null) => void;
  refresh: () => Promise<void>;
  messageId?: number;
  sessionId: string;
  toolStatus?: AiToolStatus;
  toolError?: string | null;
}) {
  const [draft, setDraft] = useState<any>(toolCall.arguments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    setError('');
    const validText = (value: unknown, max: number) =>
      typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
    const validCents = (value: unknown, allowZero = false) =>
      typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= (allowZero ? 0 : 1) &&
      value <= 2147483647;
    if (
      toolCall.name === 'create_expense' &&
      (!validText(draft.description, 200) ||
        !validCents(draft.amountCents) ||
        !['insumos', 'servicios', 'personal', 'other'].includes(draft.category))
    )
      return setError('Revisá la descripción, el monto y la categoría.');
    if (
      toolCall.name === 'cash_withdrawal' &&
      (!validText(draft.reason, 200) || !validCents(draft.amountCents))
    )
      return setError('Revisá el motivo y el monto.');
    if (
      toolCall.name === 'stock_adjustment' &&
      (!Number.isSafeInteger(draft.productId) ||
        draft.productId <= 0 ||
        !Number.isSafeInteger(draft.quantityDelta) ||
        draft.quantityDelta === 0 ||
        Math.abs(draft.quantityDelta) > 2147483647 ||
        !validText(draft.reason, 200))
    )
      return setError('Revisá el producto, la cantidad y el motivo.');
    if (
      toolCall.name === 'create_product' &&
      (!validText(draft.name, 120) ||
        typeof draft.description !== 'string' ||
        draft.description.trim().length > 500 ||
        !validCents(draft.priceCents, true) ||
        !validCents(draft.costCents, true) ||
        !Number.isSafeInteger(draft.stock) ||
        draft.stock < 0 ||
        draft.stock > 2147483647)
    )
      return setError('Revisá los datos del producto.');
    if (
      toolCall.name === 'void_sale' &&
      (!Number.isSafeInteger(draft.saleId) || draft.saleId <= 0 || !validText(draft.reason, 200))
    )
      return setError('Revisá la venta y el motivo.');
    setBusy(true);
    try {
      if (!messageId) throw new Error('La propuesta no tiene un identificador válido.');
      const claim = await window.salesApi.ai.sessions.claim({ sessionId, messageId });
      if (!claim.claimed) {
        onStatus(claim.status);
        return;
      }
      onStatus('claimed');
      if (toolCall.name === 'create_expense') await window.salesApi.expenses.create(draft);
      else if (toolCall.name === 'cash_withdrawal') await window.salesApi.cash.withdraw(draft);
      else if (toolCall.name === 'stock_adjustment')
        await window.salesApi.products.adjustStock(draft);
      else if (toolCall.name === 'void_sale')
        await window.salesApi.sales.void(draft.saleId, draft.reason.trim());
      else await window.salesApi.products.create({ ...draft, imagePath: image });
      await window.salesApi.ai.sessions.complete({ sessionId, messageId, status: 'completed' });
      onStatus('completed');
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo completar la acción.';
      setError(message);
      if (messageId) {
        try {
          await window.salesApi.ai.sessions.complete({ sessionId, messageId, status: 'failed', error: message });
          onStatus('failed', message);
        } catch {
          // Keep the original action error visible if lifecycle persistence also fails.
        }
      }
    } finally {
      setBusy(false);
    }
  };
  const title =
    toolCall.name === 'create_expense'
      ? 'gasto'
      : toolCall.name === 'cash_withdrawal'
        ? 'retiro de efectivo'
        : toolCall.name === 'stock_adjustment'
          ? 'ajuste de stock'
          : toolCall.name === 'void_sale'
            ? 'anulación de venta'
            : 'producto';
  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Elegí una imagen.');
    if (file.size > 5 * 1024 * 1024) return setError('La imagen no puede superar 5 MB.');
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.onerror = () => setError('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
  };
  const lifecycleMessage =
    toolStatus === 'completed'
      ? `${title[0].toUpperCase() + title.slice(1)} registrado.`
      : toolStatus === 'claimed'
        ? 'Acción en curso…'
        : toolStatus === 'cancelled'
          ? 'Propuesta cancelada.'
          : toolStatus === 'failed'
            ? `No se pudo completar la acción.${toolError ? ` ${toolError}` : ''}`
            : null;
  if (lifecycleMessage)
    return (
      <div className={`ai-tool-preview ${toolStatus === 'completed' ? 'success-message' : ''}`} role="status">
        {lifecycleMessage}{' '}
        <button type="button" className="link-button" onClick={onCancel}>Cerrar</button>
      </div>
    );
  const amount = 'amountCents' in draft;
  return (
    <div
      className="ai-tool-preview"
      role="region"
      aria-label={`Vista previa de ${title} propuesto`}
    >
      <strong>Propuesta de {title}</strong>
      <p>Revisá los datos: nada se guarda hasta que confirmes.</p>
      {toolCall.name === 'create_expense' && (
        <>
          <label>
            Descripción
            <input
              value={draft.description}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label>
            Monto ({currency})
            <input
              type="number"
              min="1"
              step="1"
              value={draft.amountCents}
              onChange={(e) =>
                setDraft({ ...draft, amountCents: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Categoría
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <option value="insumos">Insumos</option>
              <option value="servicios">Servicios</option>
              <option value="personal">Personal</option>
              <option value="other">Otros</option>
            </select>
          </label>
        </>
      )}
      {toolCall.name === 'cash_withdrawal' && (
        <>
          <label>
            Motivo
            <input
              value={draft.reason}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>
          <label>
            Monto ({currency})
            <input
              type="number"
              min="1"
              step="1"
              value={draft.amountCents}
              onChange={(e) =>
                setDraft({ ...draft, amountCents: Number(e.target.value) })
              }
            />
          </label>
        </>
      )}
      {toolCall.name === 'stock_adjustment' && (
        <>
          <label>
            Producto ID
            <input
              type="number"
              min="1"
              value={draft.productId}
              onChange={(e) => setDraft({ ...draft, productId: Number(e.target.value) })}
            />
          </label>
          <label>
            Cantidad
            <input
              type="number"
              value={draft.quantityDelta}
              onChange={(e) => setDraft({ ...draft, quantityDelta: Number(e.target.value) })}
            />
          </label>
          <label>
            Motivo
            <input
              value={draft.reason}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>
        </>
      )}
      {toolCall.name === 'void_sale' && (
        <>
          <p>
            <strong>Venta #{draft.saleId}</strong>
            {draft.sale?.total_cents != null &&
              ` · Total ${money(draft.sale.total_cents)}`}
          </p>
          {draft.sale?.items?.length ? (
            <small>
              Items:{' '}
              {draft.sale.items
                .map((item: SaleItem) => `${item.quantity} × ${item.product_name}`)
                .join(', ')}
            </small>
          ) : (
            <small>Se anulará la venta identificada por este ID.</small>
          )}
          <label>
            Motivo
            <input
              value={draft.reason}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>
        </>
      )}
      {toolCall.name === 'create_product' && (
        <>
          <label>
            Nombre
            <input
              value={draft.name}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Precio ({currency})
            <input
              type="number"
              min="0"
              step="1"
              value={draft.priceCents}
              onChange={(e) =>
                setDraft({ ...draft, priceCents: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Costo ({currency})
            <input
              type="number"
              min="0"
              step="1"
              value={draft.costCents}
              onChange={(e) =>
                setDraft({ ...draft, costCents: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Stock
            <input
              type="number"
              min="0"
              value={draft.stock}
              onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })}
            />
          </label>
          <label>
            Imagen opcional
            <input
              type="file"
              accept="image/*"
              onChange={(e) => chooseImage(e.target.files?.[0])}
            />
          </label>
          {image && (
            <div className="image-preview-wrap">
              <img className="image-preview" src={image} alt="Vista previa" />
              <button type="button" className="link-button" onClick={() => setImage(null)}>
                Quitar imagen
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <small className="ai-tool-risk">⚠ La acción requiere tu confirmación.</small>
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? 'Guardando…' : 'Confirmar y registrar'}
        </button>
      </div>
    </div>
  );
}
function ChatDeleteModal({ conversation, busy, close, confirm }: { conversation: { id: string; title: string } | null; busy: boolean; close: () => void; confirm: () => void }) {
  if (!conversation) return null;
  return <div className="modal-backdrop chat-delete-backdrop"><div className="modal delete-modal chat-delete-modal" role="dialog" aria-modal="true" aria-labelledby="chat-delete-title" aria-describedby="chat-delete-description"><div className="modal-heading"><h2 id="chat-delete-title">¿Eliminar este chat?</h2><button type="button" aria-label="Cerrar confirmación" onClick={close} disabled={busy}>×</button></div><p className="chat-delete-name">“{conversation.title}”</p><p id="chat-delete-description" className="delete-explanation">El chat y todos sus mensajes se eliminarán permanentemente. Esta acción no se puede deshacer.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={close} disabled={busy}>Cancelar</button><button type="button" className="destructive-button" onClick={confirm} disabled={busy}>{busy ? 'Eliminando…' : 'Eliminar chat'}</button></div></div></div>;
}
type AiMessage = {
  id?: number;
  role: 'user' | 'assistant';
  text: string;
  period?: string | null;
  source?: string;
  metrics?: Array<{ label: string; value: string; detail?: string }>;
  toolCall?: AiToolCall | null;
  toolStatus?: AiToolStatus;
  toolError?: string | null;
};
type AiConversation = { id: string; title: string; updatedAt: number; messages: AiMessage[] };
const createAiConversation = (): AiConversation => ({
  id: `ai-session-${crypto.randomUUID()}`,
  title: 'Nuevo chat',
  updatedAt: Date.now(),
  messages: [],
});

type ConversationPersistenceOptions = {
  conversations: AiConversation[];
  setConversations: React.Dispatch<React.SetStateAction<AiConversation[]>>;
  activeId: string;
  setActiveId: React.Dispatch<React.SetStateAction<string>>;
  busy: boolean;
  setQuestion: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deletingId: string | null;
  setDeletingId: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingDelete: React.Dispatch<React.SetStateAction<AiConversation | null>>;
  createConversation?: () => AiConversation;
  loadSessions?: boolean;
};

function useConversationPersistence({
  conversations,
  setConversations,
  activeId,
  setActiveId,
  busy,
  setQuestion,
  setError,
  setHistoryOpen,
  deletingId,
  setDeletingId,
  setPendingDelete,
  createConversation = createAiConversation,
  loadSessions = true,
}: ConversationPersistenceOptions) {
  const activeIdRef = useRef(activeId);
  const deletingSessionIdsRef = useRef(new Set<string>());
  activeIdRef.current = activeId;
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const updateActive = (update: (conversation: AiConversation) => AiConversation) =>
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === activeIdRef.current ? update(conversation) : conversation,
      ),
    );
  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations, setActiveId]);
  useEffect(() => {
    if (!loadSessions) return;
    let disposed = false;
    window.salesApi.ai.sessions
      .list()
      .then(async (list) => {
        const rows = await Promise.all(
          list.map(async (item) => {
            const full = await window.salesApi.ai.sessions.get(item.id);
            return full
              ? { id: full.id, title: full.title, updatedAt: Date.parse(full.updated_at) || Date.now(), messages: full.messages }
              : null;
          }),
        );
        if (disposed) return;
        const loaded = rows.filter(Boolean) as AiConversation[];
        if (loaded.length) {
          setConversations(loaded);
          setActiveId(loaded[0].id);
          return;
        }
        const fresh = createConversation();
        const persisted = await window.salesApi.ai.sessions.getOrCreate({ id: fresh.id, title: fresh.title });
        if (!disposed && persisted) {
          setConversations([{ ...fresh, id: persisted.id, title: persisted.title }]);
          setActiveId(persisted.id);
        }
      })
      .catch(() => undefined);
    return () => { disposed = true; };
  }, [createConversation, loadSessions, setActiveId, setConversations]);
  const newChat = async () => {
    const conversation = createConversation();
    try {
      await window.salesApi.ai.sessions.create({ id: conversation.id, title: conversation.title });
      setConversations((previous) => [conversation, ...previous]);
      setActiveId(conversation.id);
      setQuestion('');
      setError('');
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el chat.');
    }
  };
  const selectConversation = (id: string) => {
    setActiveId(id);
    setQuestion('');
    setError('');
    setHistoryOpen(false);
  };
  const deleteConversation = async (id: string) => {
    if (busy || deletingId) return;
    const currentId = activeIdRef.current;
    setDeletingId(id);
    deletingSessionIdsRef.current.add(id);
    try {
      await window.salesApi.ai.sessions.delete(id);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      if (id === currentId) {
        if (remaining.length) {
          setConversations(remaining);
          setActiveId(remaining[0].id);
        } else {
          const fresh = createConversation();
          const persisted = await window.salesApi.ai.sessions.getOrCreate({ id: fresh.id, title: fresh.title });
          setConversations([{ ...fresh, id: persisted.id, title: persisted.title }]);
          setActiveId(persisted.id);
        }
      } else setConversations(remaining);
      setQuestion('');
      setError('');
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el chat.');
    } finally {
      deletingSessionIdsRef.current.delete(id);
      setDeletingId(null);
      setPendingDelete(null);
    }
  };
  return { activeConversation, activeIdRef, deletingSessionIdsRef, updateActive, newChat, selectConversation, deleteConversation };
}

function AIChat({ visible = true, refresh }: { visible?: boolean; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState<AiConversation[]>(() => [createAiConversation()]);
  const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AiConversation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('COP');
  const persistence = useConversationPersistence({ conversations, setConversations, activeId, setActiveId, busy, setQuestion, setError, setHistoryOpen, deletingId, setDeletingId, setPendingDelete });
  const { activeIdRef, deletingSessionIdsRef } = persistence;
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const suggestions = [
    '¿Cómo fueron las ventas de hoy?',
    '¿Qué productos tienen poco stock?',
    '¿Cuál fue mi ganancia esta semana?',
    '¿Qué alerta debería atender primero?',
  ];
  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);
  useEffect(() => {
    const openChat = () => {
      setOpen(true);
      setHistoryOpen(false);
    };
    window.addEventListener('open-ai-chat', openChat);
    return () => window.removeEventListener('open-ai-chat', openChat);
  }, []);
  useEffect(() => {
    if (open && !historyOpen) inputRef.current?.focus();
  }, [open, historyOpen]);
  useEffect(() => {
    if (open)
      chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);
  const updateActive = (update: (conversation: AiConversation) => AiConversation) =>
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === activeConversation?.id ? update(conversation) : conversation,
      ),
    );
  const newChat = async () => {
    const conversation = createAiConversation();
    try {
      await window.salesApi.ai.sessions.create({ id: conversation.id, title: conversation.title });
      setConversations((previous) => [conversation, ...previous]);
      setActiveId(conversation.id);
      setQuestion('');
      setError('');
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el chat.');
    }
  };
  const selectConversation = (id: string) => {
    setActiveId(id);
    setQuestion('');
    setError('');
    setHistoryOpen(false);
  };
  const deleteConversation = async (id: string) => {
    if (busy || deletingId) return;
    const currentId = activeId;
    setDeletingId(id);
    deletingSessionIdsRef.current.add(id);
    try {
      await window.salesApi.ai.sessions.delete(id);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      if (id === currentId) {
        if (remaining.length) {
          setConversations(remaining);
          setActiveId(remaining[0].id);
        } else {
          const fresh = createAiConversation();
          const persisted = await window.salesApi.ai.sessions.getOrCreate({
            id: fresh.id,
            title: fresh.title,
          });
          setConversations([{ ...fresh, id: persisted.id, title: persisted.title }]);
          setActiveId(persisted.id);
        }
      } else {
        setConversations(remaining);
      }
      setQuestion('');
      setError('');
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el chat.');
    } finally {
      deletingSessionIdsRef.current.delete(id);
      setDeletingId(null);
      setPendingDelete(null);
    }
  };
  const send = async (value = question, mode: 'question' | 'daily-summary' = 'question') => {
    const text = value.trim();
    if (!text || busy || !activeConversation) return;
    const requestSessionId = activeConversation.id;
    const prior = messages.slice(-8).map((item) => ({ role: item.role, content: item.text }));
    const userMessage: AiMessage = { role: 'user', text };
    setQuestion('');
    setError('');
    let persistedSession;
    try {
      persistedSession = await window.salesApi.ai.sessions.getOrCreate({
        id: activeConversation.id,
        title: activeConversation.title,
      });
      await window.salesApi.ai.sessions.append({
        sessionId: persistedSession.id,
        role: 'user',
        text,
      });
      if (activeIdRef.current !== requestSessionId || deletingSessionIdsRef.current.has(requestSessionId)) return;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el mensaje.');
      return;
    }
    updateActive((conversation) => ({
      ...conversation,
      id: persistedSession.id,
      title: persistedSession.title,
      updatedAt: Date.now(),
      messages: [...conversation.messages, userMessage],
    }));
    setBusy(true);
    try {
      const answer = await window.salesApi.ai.analyze(text, prior, mode);
      if (activeIdRef.current !== requestSessionId || deletingSessionIdsRef.current.has(requestSessionId)) return;
      const savedAssistant = await window.salesApi.ai.sessions.append({
        sessionId: requestSessionId,
        role: 'assistant',
        text: answer.text,
        period: answer.period,
        source: answer.source,
        metrics: answer.metrics,
        toolCall: answer.toolCall,
      });
      if (activeIdRef.current !== requestSessionId || deletingSessionIdsRef.current.has(requestSessionId)) return;
      updateActive((conversation) => ({
        ...conversation,
        title: savedAssistant.title || conversation.title,
        updatedAt: Date.now(),
        messages: [
          ...conversation.messages,
          {
            id: savedAssistant.id,
            role: 'assistant',
            text: answer.text,
            period: answer.period,
            source: answer.source,
            metrics: answer.metrics,
            toolCall: answer.toolCall,
            toolStatus: answer.toolCall ? 'pending' : undefined,
          },
        ],
      }));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo conectar con el asistente.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {visible && open && (
        <section className="ai-chat-panel" role="dialog" aria-labelledby="ai-chat-title">
          <div className="ai-chat-header">
            <div>
              <strong id="ai-chat-title">Asistente de Pollo &amp; Caja</strong>
              <span>Consultas sobre tu operación</span>
            </div>
            <div className="ai-header-actions">
              <button type="button" onClick={newChat}>
                Nuevo chat
              </button>
              <button
                type="button"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen((value) => !value)}
              >
                Historial
              </button>
              <button
                type="button"
                className="ai-close"
                aria-label="Cerrar asistente"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </div>
          {historyOpen && (
            <aside className="ai-history-drawer" aria-label="Historial de chats">
              <div className="ai-history-heading">
                <div>
                  <strong>Historial</strong>
                  <span>
                    {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'} en esta
                    sesión
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar historial"
                  onClick={() => setHistoryOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="ai-history-list">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`ai-history-item ${conversation.id === activeConversation?.id ? 'selected' : ''}`}
                  >
                    <button type="button" onClick={() => selectConversation(conversation.id)}>
                      <strong>{conversation.title}</strong>
                      <span>
                        {conversation.messages.length}{' '}
                        {conversation.messages.length === 1 ? 'mensaje' : 'mensajes'} ·{' '}
                        {new Date(conversation.updatedAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar chat ${conversation.title}`}
                      onClick={() => setPendingDelete(conversation)}
                      disabled={busy || Boolean(deletingId)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          )}
          <div ref={chatBodyRef} className="ai-chat-body" aria-live="polite">
            {!messages.length && (
              <div className="ai-empty">
                <div className="ai-empty-icon">✦</div>
                <h3>¿En qué te ayudo?</h3>
                <p>Preguntame sobre ventas, stock y rendimiento de tu negocio.</p>
                <button
                  type="button"
                  className="ai-daily-action"
                  onClick={() => send('Analizar mi negocio hoy', 'daily-summary')}
                >
                  ✦ Analizar mi negocio
                </button>
                <div className="ai-suggestions">
                  {suggestions.map((item) => (
                    <button type="button" key={item} onClick={() => send(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="ai-message-bubble">
                  <span className="ai-message-content">{formatAIOutput(message.text)}</span>
                  {message.role === 'assistant' && message.metrics?.length ? (
                    <div className="ai-metrics">
                      {message.metrics.map((metric, metricIndex) => (
                        <div className="ai-metric" key={`${metric.label}-${metricIndex}`}>
                          <small>{metric.label}</small>
                          <strong>{metric.value}</strong>
                          {metric.detail && <span>{metric.detail}</span>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.role === 'assistant' && message.toolCall && (
                    <ExpenseToolPreview
                      toolCall={message.toolCall}
                      currency={currency}
                      refresh={refresh}
                      messageId={message.id}
                      sessionId={activeConversation.id}
                      toolStatus={message.toolStatus}
                      toolError={message.toolError}
                      onStatus={(toolStatus, toolError) =>
                        updateActive((conversation) => ({
                          ...conversation,
                          messages: conversation.messages.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, toolStatus, toolError } : entry,
                          ),
                        }))
                      }
                      onCancel={async () => {
                        if (message.id && message.toolStatus === 'pending') {
                          const result = await window.salesApi.ai.sessions.cancel({ sessionId: activeConversation.id, messageId: message.id });
                          updateActive((conversation) => ({
                            ...conversation,
                            messages: conversation.messages.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, toolStatus: result.status } : entry,
                            ),
                          }));
                        }
                      }}
                    />
                  )}
                  {message.role === 'assistant' && (message.period || message.source) && (
                    <small className="ai-meta">
                      {message.period && `Período: ${message.period}`}{' '}
                      {message.source && ` · Fuente: ${message.source}`}
                    </small>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="ai-message assistant ai-loading">
                <span>
                  Analizando<span className="ai-dots">…</span>
                </span>
              </div>
            )}
            {error && (
              <p className="ai-error" role="alert">
                {configured === false
                  ? 'La clave de Ollama Cloud no está configurada. Podés agregarla en Configuración → IA.'
                  : error}
              </p>
            )}
          </div>
          <p className="ai-disclaimer">
            La IA solo propone acciones. Nada se modifica sin tu confirmación.
          </p>
          <form
            className="ai-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="ai-question">
              Escribí tu pregunta
            </label>
            <input
              id="ai-question"
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Escribí una pregunta…"
              disabled={busy}
            />
            <button type="submit" aria-label="Enviar pregunta" disabled={busy || !question.trim()}>
              ↑
            </button>
          </form>
        </section>
      )}
      <ChatDeleteModal conversation={pendingDelete} busy={Boolean(deletingId)} close={() => setPendingDelete(null)} confirm={() => { if (pendingDelete) void deleteConversation(pendingDelete.id); }} />
      {visible && (
        <button
          type="button"
          className={`ai-fab ${open ? 'is-open' : ''}`}
          aria-label={open ? 'Cerrar asistente de IA' : 'Abrir asistente de IA'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>✦</span>
          <b>IA</b>
        </button>
      )}
    </>
  );
}
function AIWorkspace({ refresh }: { refresh: () => Promise<void> }) {
  const makeConversation = createAiConversation;
  const suggestions = [
    '¿Cómo fueron las ventas de hoy?',
    '¿Qué productos tienen poco stock?',
    '¿Cuál fue mi ganancia esta semana?',
    '¿Qué alerta debería atender primero?',
  ];
  const [conversations, setConversations] = useState<AiConversation[]>(() => [makeConversation()]);
  const [activeId, setActiveId] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AiConversation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('COP');
  const persistence = useConversationPersistence({ conversations, setConversations, activeId, setActiveId, busy, setQuestion, setError, setHistoryOpen, deletingId, setDeletingId, setPendingDelete, createConversation: makeConversation });
  const { activeIdRef, deletingSessionIdsRef } = persistence;
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const messages = active?.messages ?? [];
  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);
  useEffect(() => {
    if (!historyOpen) inputRef.current?.focus();
  }, [historyOpen]);
  const updateActive = (update: (conversation: AiConversation) => AiConversation) =>
    setConversations((previous) =>
      previous.map((item) => (item.id === active?.id ? update(item) : item)),
    );
  const deleteConversation = async (id: string) => {
    if (busy || deletingId) return;
    const currentId = activeId;
    setDeletingId(id);
    deletingSessionIdsRef.current.add(id);
    try {
      await window.salesApi.ai.sessions.delete(id);
      const remaining = conversations.filter((conversation) => conversation.id !== id);
      if (id === currentId) {
        if (remaining.length) {
          setConversations(remaining);
          setActiveId(remaining[0].id);
        } else {
          const fresh = makeConversation();
          const persisted = await window.salesApi.ai.sessions.getOrCreate({
            id: fresh.id,
            title: fresh.title,
          });
          setConversations([{ ...fresh, id: persisted.id, title: persisted.title }]);
          setActiveId(persisted.id);
        }
      } else {
        setConversations(remaining);
      }
      setQuestion('');
      setError('');
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el chat.');
    } finally {
      deletingSessionIdsRef.current.delete(id);
      setDeletingId(null);
      setPendingDelete(null);
    }
  };
  const newChat = async () => {
    const conversation = makeConversation();
    try {
      await window.salesApi.ai.sessions.create({ id: conversation.id, title: conversation.title });
      setConversations((previous) => [conversation, ...previous]);
      setActiveId(conversation.id);
      setQuestion('');
      setError('');
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el chat.');
    }
  };
  const send = async (value = question, mode: 'question' | 'daily-summary' = 'question') => {
    const text = value.trim();
    if (!text || busy || !active) return;
    const requestSessionId = active.id;
    const prior = messages.slice(-8).map((item) => ({ role: item.role, content: item.text }));
    let persistedSession;
    try {
      persistedSession = await window.salesApi.ai.sessions.getOrCreate({
        id: active.id,
        title: active.title,
      });
      await window.salesApi.ai.sessions.append({
        sessionId: persistedSession.id,
        role: 'user',
        text,
      });
      if (activeIdRef.current !== requestSessionId || deletingSessionIdsRef.current.has(requestSessionId)) return;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el mensaje.');
      return;
    }
    updateActive((item) => ({
      ...item,
      id: persistedSession.id,
      title: persistedSession.title,
      updatedAt: Date.now(),
      messages: [...item.messages, { role: 'user', text }],
    }));
    setQuestion('');
    setError('');
    setBusy(true);
    try {
      const answer = await window.salesApi.ai.analyze(text, prior, mode);
      if (activeIdRef.current !== requestSessionId || deletingSessionIdsRef.current.has(requestSessionId)) return;
      const savedAssistant = await window.salesApi.ai.sessions.append({
        sessionId: requestSessionId,
        role: 'assistant',
        text: answer.text,
        period: answer.period,
        source: answer.source,
        metrics: answer.metrics,
        toolCall: answer.toolCall,
      });
      if (activeIdRef.current !== requestSessionId || deletingSessionIdsRef.current.has(requestSessionId)) return;
      updateActive((item) => ({
        ...item,
        title: savedAssistant.title || item.title,
        updatedAt: Date.now(),
        messages: [
          ...item.messages,
          {
            id: savedAssistant.id,
            role: 'assistant',
            text: answer.text,
            period: answer.period,
            source: answer.source,
            metrics: answer.metrics,
            toolCall: answer.toolCall,
            toolStatus: answer.toolCall ? 'pending' : undefined,
          },
        ],
      }));
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'No se pudo conectar con el asistente.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ai-workspace ai-workspace-chat" aria-labelledby="ai-workspace-title">
      <div className="ai-workspace-header">
        <div>
          <div className="ai-workspace-kicker">✦ INTELIGENCIA PARA TU NEGOCIO</div>
          <h2 id="ai-workspace-title">Asistente de Pollo &amp; Caja</h2>
          <p>Consultá ventas, stock y rendimiento en lenguaje natural.</p>
        </div>
        <div className="ai-workspace-header-actions">
          <button type="button" className="secondary-button" onClick={newChat}>
            ＋ Nuevo chat
          </button>
          <button
            type="button"
            className="secondary-button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((value) => !value)}
          >
            Historial
          </button>
        </div>
      </div>
      <div className="ai-workspace-content">
        <div ref={bodyRef} className="ai-workspace-messages" aria-live="polite">
          {historyOpen && (
            <aside className="ai-workspace-history" aria-label="Historial de chats">
              <div className="ai-history-heading">
                <div>
                  <strong>Historial</strong>
                  <span>
                    {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'} en esta
                    sesión
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar historial"
                  onClick={() => setHistoryOpen(false)}
                >
                  ×
                </button>
              </div>
              {conversations.map((item) => (
                <div
                  key={item.id}
                  className={`ai-history-item ${item.id === active?.id ? 'selected' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(item.id);
                      setHistoryOpen(false);
                      setQuestion('');
                      setError('');
                    }}
                  >
                    {item.title}
                    <small>{item.messages.length} mensajes</small>
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar chat ${item.title}`}
                    onClick={() => setPendingDelete(item)}
                    disabled={busy || Boolean(deletingId)}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </aside>
          )}
          {!messages.length && !busy && (
            <div className="ai-empty">
              <div className="ai-empty-icon">✦</div>
              <h3>¿En qué te ayudo?</h3>
              <p>Preguntame sobre ventas, stock y rendimiento de tu negocio.</p>
              <button
                type="button"
                className="ai-daily-action"
                onClick={() => void send('Analizar mi negocio hoy', 'daily-summary')}
              >
                ✦ Analizar mi negocio
              </button>
              <div className="ai-suggestions">
                {suggestions.map((item) => (
                  <button type="button" key={item} onClick={() => void send(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
              <div className="ai-message-bubble">
                <span className="ai-message-content">{formatAIOutput(message.text)}</span>
                {message.role === 'assistant' && message.metrics?.length ? (
                  <div className="ai-metrics">
                    {message.metrics.map((metric, metricIndex) => (
                      <div className="ai-metric" key={`${metric.label}-${metricIndex}`}>
                        <small>{metric.label}</small>
                        <strong>{metric.value}</strong>
                        {metric.detail && <span>{metric.detail}</span>}
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.toolCall && (
                  <ExpenseToolPreview
                    toolCall={message.toolCall}
                    currency={currency}
                    refresh={refresh}
                    messageId={message.id}
                    sessionId={active.id}
                    toolStatus={message.toolStatus}
                    toolError={message.toolError}
                    onStatus={(toolStatus, toolError) =>
                      updateActive((item) => ({
                        ...item,
                        messages: item.messages.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, toolStatus, toolError } : entry,
                        ),
                      }))
                    }
                    onCancel={async () => {
                      if (message.id && message.toolStatus === 'pending') {
                        const result = await window.salesApi.ai.sessions.cancel({ sessionId: active.id, messageId: message.id });
                        updateActive((item) => ({
                          ...item,
                          messages: item.messages.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, toolStatus: result.status } : entry,
                          ),
                        }));
                      }
                    }}
                  />
                )}
                {message.role === 'assistant' && (message.period || message.source) && (
                  <small className="ai-meta">
                    {message.period && `Período: ${message.period}`}
                    {message.source && ` · Fuente: ${message.source}`}
                  </small>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="ai-message assistant ai-loading">
              <span>
                Analizando<span className="ai-dots">…</span>
              </span>
            </div>
          )}
          {error && (
            <p className="ai-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <p className="ai-disclaimer">
          La IA solo propone acciones. Nada se modifica sin tu confirmación.
        </p>
        <form
          className="ai-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="workspace-question">
            Escribí tu pregunta
          </label>
          <input
            id="workspace-question"
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Escribí una pregunta…"
            disabled={busy}
          />
          <button type="submit" aria-label="Enviar pregunta" disabled={busy || !question.trim()}>
            ↑
          </button>
        </form>
      </div>
      <ChatDeleteModal conversation={pendingDelete} busy={Boolean(deletingId)} close={() => setPendingDelete(null)} confirm={() => { if (pendingDelete) void deleteConversation(pendingDelete.id); }} />
    </section>
  );
}
function TitleBar() {
  return (
    <div className="title-bar">
      <div className="title-bar-brand">
        <div className="brand-mark small">P</div>
        <strong>Pollo &amp; Caja</strong>
      </div>
      <div className="window-controls">
        <button onClick={() => window.salesApi.window.minimize()}>−</button>
        <button onClick={() => window.salesApi.window.maximize()}>□</button>
        <button className="close-control" onClick={() => window.salesApi.window.close()}>
          ×
        </button>
      </div>
    </div>
  );
}
function NotificationCenter({
  alerts,
  navigate,
}: {
  alerts: DashboardAlert[];
  navigate: (page: Page) => void;
}) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const previousIds = useRef<string[]>([]);
  // Dismissals are deliberately kept in memory only. A refreshed alert with the same
  // identity stays dismissed, while a new backend identity is shown as new.
  const activeAlerts = alerts.filter((alert) => !dismissedIds.has(alert.id));
  const unreadAlerts = activeAlerts.filter((alert) => !readIds.has(alert.id));
  const criticalCount = activeAlerts.filter((alert) => alert.severity === 'critical').length;
  useEffect(() => {
    const currentIds = alerts.map((alert) => alert.id);
    setReadIds(
      (previous) =>
        new Set([
          ...currentIds.filter((id) => previousIds.current.includes(id) && previous.has(id)),
        ]),
    );
    previousIds.current = currentIds;
  }, [alerts]);
  useEffect(() => {
    if (open && unreadAlerts.length)
      setReadIds((previous) => new Set([...previous, ...unreadAlerts.map((alert) => alert.id)]));
  }, [open, unreadAlerts.length]);
  const dismiss = (id: string) => setDismissedIds((previous) => new Set([...previous, id]));
  const dismissAll = () =>
    setDismissedIds((previous) => new Set([...previous, ...activeAlerts.map((alert) => alert.id)]));
  return (
    <div className="notification-center">
      <button
        className={`notification-button ${unreadAlerts.length ? 'has-alerts' : ''}`}
        aria-label={`Abrir notificaciones${unreadAlerts.length ? `, ${unreadAlerts.length} sin leer` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ♢{unreadAlerts.length > 0 && <i>{unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}</i>}
      </button>
      {open && (
        <div className="notification-popover" role="dialog" aria-label="Centro de alertas">
          <div className="notification-heading">
            <div>
              <strong>Centro de alertas</strong>
              <span>
                {activeAlerts.length ? `${activeAlerts.length} alertas` : 'Todo en orden'}
              </span>
            </div>
            <div className="notification-heading-actions">
              {activeAlerts.length > 0 && (
                <button
                  className="clear-all-button"
                  aria-label="Descartar todas las alertas"
                  onClick={dismissAll}
                >
                  Limpiar todo
                </button>
              )}
              <button aria-label="Cerrar notificaciones" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </div>
          {activeAlerts.length ? (
            activeAlerts.map((alert) => (
              <div className="notification-item" key={alert.id}>
                <button
                  className="notification-item-main"
                  aria-label={`Revisar alerta: ${alert.title}`}
                  onClick={() => {
                    navigate(alert.page);
                    setOpen(false);
                  }}
                >
                  <span className={`notification-severity ${alert.severity}`}>
                    {alert.severity === 'critical' ? '!' : alert.severity === 'warning' ? '△' : 'i'}
                  </span>
                  <span>
                    <strong>{alert.title}</strong>
                    <small>{alert.message}</small>
                    <em>Revisar →</em>
                  </span>
                </button>
                <button
                  className="notification-dismiss"
                  aria-label={`Descartar alerta: ${alert.title}`}
                  title="Descartar alerta"
                  onClick={() => dismiss(alert.id)}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className="notification-empty">No hay alertas que requieran atención.</p>
          )}
          {criticalCount > 0 && (
            <small className="notification-footnote">Priorizadas por urgencia</small>
          )}
        </div>
      )}
    </div>
  );
}
function ProfileMenu({
  email,
  navigate,
  onLogout,
}: {
  email: string;
  navigate: (page: Page) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="profile-menu">
      <button
        className="avatar"
        aria-label="Abrir menú de perfil"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        JG
      </button>
      {open && (
        <div className="profile-popover" role="menu">
          <strong>Administrador</strong>
          <span>{email}</span>
          <small>Pollo &amp; Caja · Operación local</small>
          <button
            role="menuitem"
            onClick={() => {
              navigate('settings');
              setOpen(false);
            }}
          >
            ⚙ Configuración
          </button>
          <button role="menuitem" className="logout-action" onClick={onLogout}>
            ↪ Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
function Sidebar({ page, navigate }: { page: Page; navigate: (p: Page) => void }) {
  const item = (p: Page, icon: string, label: string) => (
    <button className={`nav-item ${page === p ? 'active' : ''}`} onClick={() => navigate(p)}>
      <span>{icon}</span>
      {label}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <strong>Pollo &amp; Caja</strong>
          <span>Gestión de ventas</span>
        </div>
      </div>
      <nav>
        <p className="nav-label">MENÚ PRINCIPAL</p>
        {item('dashboard', '⌂', 'Dashboard')}
        {item('tables', '▦', 'Mesas')}
        {item('products', '▣', 'Productos')}
        {item('checkout', '▤', 'Nueva venta')}
        {item('history', '◷', 'Historial de ventas')}
        <button
          className={`nav-item ${page === 'expenses' ? 'active' : ''}`}
          onClick={() => navigate('expenses')}
        >
          <span>↗</span>Gastos
        </button>
        <p className="nav-label section-label">IA / ASISTENTE</p>
        {item('ai', '✦', 'Asistente IA')}
        <p className="nav-label section-label">ADMINISTRACIÓN</p>
        <button
          className={`nav-item ${page === 'cash' ? 'active' : ''}`}
          onClick={() => navigate('cash')}
        >
          <span>▥</span>Caja
        </button>
        <button
          className={`nav-item ${page === 'reports' ? 'active' : ''}`}
          onClick={() => navigate('reports')}
        >
          <span>▤</span>Reportes
        </button>
        <button
          className={`nav-item ${page === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <span>⚙</span>Configuración
        </button>
      </nav>
      <div className="sidebar-footer">
        <div className="status-dot" />
        <span>Caja abierta</span>
        <b>Operación local</b>
        <small>Servicio activo</small>
      </div>
    </aside>
  );
}
function Dashboard({
  summary,
  sales,
  navigate,
}: {
  summary: any;
  sales: Sale[];
  navigate: (p: Page) => void;
}) {
  const [range, setRange] = useState(defaultRange);
  const [analytics, setAnalytics] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<Awaited<ReturnType<typeof window.salesApi.diagnostics.list>>>([]);
  const [diagnosticsState, setDiagnosticsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const loadDiagnostics = async () => {
    setDiagnosticsState('loading');
    try {
      setDiagnostics(await window.salesApi.diagnostics.list());
      setDiagnosticsState('ready');
    } catch {
      setDiagnosticsState('error');
    }
  };
  useEffect(() => {
    void loadDiagnostics();
  }, []);
  useEffect(() => {
    window.salesApi.sales.analytics(range).then(setAnalytics);
  }, [range.from, range.to]);
  const total = analytics?.totalCents ?? summary?.salesTodayCents ?? 0;
  const chartData = (analytics?.byDay ?? []).map((day: any) => ({
    day: String(day.day),
    total: Number.isFinite(Number(day.total_cents)) ? Math.max(0, Number(day.total_cents)) : 0,
  }));
  const chartMax = Math.max(...chartData.map((day: { total: number }) => day.total), 0);
  const chartPoints = chartData.map((day: { day: string; total: number }, index: number) => ({
    ...day,
    x: chartData.length === 1 ? 360 : 28 + (index * 664) / (chartData.length - 1),
    y: chartMax > 0 ? 178 - (day.total / chartMax) * 142 : 178,
  }));
  const chartPath = chartPoints.reduce((path: string, point: { x: number; y: number }, index: number, points: Array<{ x: number; y: number }>) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, '');
  const bestSellers = sales
    .flatMap((sale) => sale.items)
    .reduce<Record<string, number>>((counts, item) => {
      counts[item.product_name] = (counts[item.product_name] ?? 0) + item.quantity;
      return counts;
    }, {});
  const rankedProducts = Object.entries(bestSellers).sort(([, a], [, b]) => b - a).slice(0, 4);
  return (
    <>
      <div className="analytics-toolbar">
        <div>
          <strong>Rendimiento</strong>
          <span>Visualizá el negocio por período</span>
        </div>
        <label>
          Desde
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
        <button className="secondary-button" onClick={() => setRange(defaultRange())}>
          Últimos 7 días
        </button>
      </div>
      <section className="stats-grid">
        <StatCard
          label="Ventas del período"
          value={money(total)}
          change="Filtrado"
          icon="◉"
          tone="orange"
        />
        <StatCard
          label="Pedidos"
          value={String(analytics?.orders ?? 0)}
          change="Filtrado"
          icon="▤"
          tone="purple"
        />
        <StatCard
          label="Ticket promedio"
          value={money(analytics?.orders ? total / analytics.orders : 0)}
          change="Del período"
          icon="⌁"
          tone="green"
        />
        <StatCard
          label="Ganancia bruta"
          value={money(analytics?.grossProfitCents ?? 0)}
          change={`${(analytics?.marginPercent ?? 0).toFixed(1)}% margen`}
          icon="↗"
          tone="green"
        />
        <StatCard
          label="Gastos del día"
          value={money(summary?.expensesTodayCents ?? 0)}
          change="Hoy"
          icon="↗"
          tone="red"
        />
      </section>
      <section className="panel diagnostics-panel">
        <div className="panel-heading">
          <div>
            <h2>Diagnóstico de datos</h2>
            <p>Revisiones determinísticas del estado de la operación</p>
          </div>
          <button className="text-button diagnostics-refresh" onClick={() => void loadDiagnostics()} disabled={diagnosticsState === 'loading'}>
            {diagnosticsState === 'loading' ? 'Actualizando…' : 'Actualizar ↻'}
          </button>
        </div>
        {diagnosticsState === 'loading' && <p className="muted">Consultando diagnóstico…</p>}
        {diagnosticsState === 'error' && (
          <p className="form-error" role="alert">No se pudo cargar el diagnóstico. Intentá actualizar.</p>
        )}
        {diagnosticsState === 'ready' && !diagnostics.length && <p className="success-message">No se detectaron problemas.</p>}
        {diagnosticsState === 'ready' && diagnostics.length > 0 && (
          <div className="diagnostics-list">
            {diagnostics.slice(0, 4).map((issue) => (
              <button className="diagnostic-item" key={`${issue.issue_code}-${issue.entity_type}-${issue.entity_id ?? 'none'}`} onClick={() => navigate(issue.entity_type === 'product' ? 'products' : 'history')}>
                <span className={`diagnostic-severity ${issue.severity}`} aria-label={`Estado ${issue.severity}`}>
                  <span className="diagnostic-severity-dot" aria-hidden="true" />
                  {issue.severity}
                </span>
                <span className="diagnostic-message">{issue.message}</span>
                <span className="diagnostic-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="content-grid">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div>
              <h2>Ventas recientes</h2>
              <p>Últimas transacciones registradas</p>
            </div>
            <button className="text-button" onClick={() => navigate('history')}>
              Ver todas →
            </button>
          </div>
          <SalesTable sales={sales.slice(0, 5)} />
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Más vendidos</h2>
              <p>Según las ventas cargadas</p>
            </div>
          </div>
          {rankedProducts.length ? rankedProducts.map(([name, quantity]) => (
            <div className="best-seller-row" key={name}><strong>{name}</strong><span>{quantity} vendidos</span></div>
          )) : <p className="muted">Todavía no hay ventas para ordenar.</p>}
          <div className="panel-heading quick-heading">
            <div><h2>Acciones rápidas</h2><p>Lo que más usás</p></div>
          </div>
          <button className="quick-action primary" onClick={() => navigate('checkout')}>
            <span className="action-icon">＋</span>
            <div>
              <strong>Nueva venta</strong>
              <small>Registrar una venta</small>
            </div>
            <span>→</span>
          </button>
          <button className="quick-action" onClick={() => navigate('tables')}>
            <span className="action-icon green-icon">▦</span>
            <div>
              <strong>Gestionar mesas</strong>
              <small>Abrir cuentas y cobrar pedidos</small>
            </div>
            <span>→</span>
          </button>
          <button className="quick-action" onClick={() => navigate('products')}>
            <span className="action-icon purple-icon">▣</span>
            <div>
              <strong>Agregar producto</strong>
              <small>Actualizar catálogo</small>
            </div>
            <span>→</span>
          </button>
        </section>
      </div>
      <section className="bottom-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Resumen de ventas</h2>
              <p>Las ventas aparecerán aquí al registrar operaciones.</p>
            </div>
          </div>
          {chartPoints.length === 0 ? (
            <div className="empty-chart" role="status">
              <span aria-hidden="true">⌁</span>
              <strong>Sin ventas en este período</strong>
              <small>Probá ampliar las fechas para ver la tendencia.</small>
            </div>
          ) : (
            <div className="sales-chart-wrap">
              <svg className="sales-chart" viewBox="0 0 720 220" role="img" aria-label="Ventas por día en pesos colombianos">
                <g className="chart-grid" aria-hidden="true">
                  {[0, 1, 2, 3].map((step) => {
                    const y = 36 + step * 47;
                    return <line key={step} x1="28" x2="692" y1={y} y2={y} />;
                  })}
                </g>
                <path className="chart-line" d={chartPath} />
                {chartPoints.map((point: { day: string; total: number; x: number; y: number }) => (
                  <g className="chart-point" key={point.day}>
                    <title>{`${point.day}: ${money(point.total)}`}</title>
                    <circle cx={point.x} cy={point.y} r="4" />
                    <text x={point.x} y={Math.max(18, point.y - 11)} textAnchor="middle">{money(point.total)}</text>
                    <text className="chart-day-label" x={point.x} y="207" textAnchor="middle">
                      {new Date(`${point.day}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>
        <div className="panel stock-panel">
          <div className="panel-heading">
            <div>
              <h2>Stock bajo</h2>
              <p>Productos que necesitan atención</p>
            </div>
            <button className="text-button" onClick={() => navigate('products')}>
              Ver productos →
            </button>
          </div>
          {(summary?.lowStock ?? []).slice(0, 4).map((p: Product) => (
            <div className="stock-item" key={p.id}>
              <div className="product-thumb">
                {p.image_path ? <img src={p.image_path} /> : '🍗'}
              </div>
              <div className="stock-info">
                <strong>{p.name}</strong>
                <span>Quedan {p.stock} unidades</span>
              </div>
              <div className="stock-bar">
                <i style={{ width: `${Math.min(p.stock * 10, 100)}%` }} />
              </div>
            </div>
          ))}
          {!summary?.lowStock?.length && <p className="muted">No hay productos con stock bajo.</p>}
        </div>
      </section>
    </>
  );
}
function StatCard({
  label,
  value,
  change,
  icon,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  icon: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{change}</small>
      </div>
      <span className="card-menu">•••</span>
    </div>
  );
}
function SalesTable({ sales, onSelect }: { sales: Sale[]; onSelect?: (sale: Sale) => void }) {
  if (!sales.length)
    return (
      <div className="empty-state">
        <strong>No hay ventas en este período.</strong>
        <span>Probá cambiar las fechas o el medio de pago.</span>
      </div>
    );
  return (
    <div className="sales-table">
      <div className="table-row table-head">
        <span>VENTA</span>
        <span>DETALLE</span>
        <span>TOTAL</span>
        <span>PAGO</span>
        <span>VER</span>
      </div>
      {sales.map((s) => (
        <button className="table-row sale-row" key={s.id} onClick={() => onSelect?.(s)}>
          <span className="sale-id">#{String(s.id).padStart(4, '0')}</span>
          <span className="muted">
            {s.table_id ? `Mesa ${s.table_id} · ` : ''}{s.items.map((i) => `${i.quantity} ${i.product_name}`).join(', ')}
          </span>
          <span className="total">{money(s.total_cents)}</span>
          <span>
            <b className={`pill ${s.payment_method === 'cash' ? 'green' : 'blue'}`}>
              {s.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}
            </b>
          </span>
          <span className="detail-link">Ver detalle →</span>
        </button>
      ))}
    </div>
  );
}
function Products({
  products,
  refresh,
  navigate,
}: {
  products: Product[];
  refresh: () => Promise<void>;
  navigate: (p: Page) => void;
}) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [show, setShow] = useState(false);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<number | undefined>();
  return (
    <>
      <div className="page-actions">
        <div>
          <h2>Catálogo de productos</h2>
          <p className="subtitle">Administrá precios, imágenes y stock.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setEditing(null);
            setShow(true);
          }}
        >
          ＋ Nuevo producto
        </button>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <article className="product-card" key={p.id}>
            <div className="product-image">
              {p.image_path ? <img src={p.image_path} /> : <span>🍗</span>}
            </div>
            <div className="product-card-body">
              <div>
                <h3>{p.name}</h3>
                <p>{p.description || 'Sin descripción'}</p>
              </div>
              <strong>{money(p.price_cents)}</strong>
              <small>
                Costo: {money(p.cost_cents)} · Margen estimado:{' '}
                {money(p.price_cents - p.cost_cents)} (
                {p.price_cents
                  ? (((p.price_cents - p.cost_cents) / p.price_cents) * 100).toFixed(1)
                  : '0.0'}
                %)
              </small>
              <div className="product-meta">
                <span className={p.stock <= 10 ? 'low-stock' : ''}>{p.stock} en stock</span>
                <div className="product-actions" aria-label={`Acciones para ${p.name}`}>
                  <button
                    className="link-button product-action-adjust"
                    title={`Ajustar stock de ${p.name}`}
                    aria-label={`Ajustar stock de ${p.name}`}
                    onClick={() => setAdjusting(p)}
                  >
                    Ajustar
                  </button>
                  <button
                    className="link-button product-action-history"
                    title={`Ver movimientos de ${p.name}`}
                    aria-label={`Ver movimientos de ${p.name}`}
                    onClick={() => {
                      setHistoryProduct(p.id);
                    }}
                  >
                    Movimientos
                  </button>
                  <button
                    className="link-button product-action-edit"
                    title={`Editar ${p.name}`}
                    aria-label={`Editar ${p.name}`}
                    onClick={() => {
                      setEditing(p);
                      setShow(true);
                    }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!products.length && (
          <div className="empty-state">No hay productos. Creá el primero para comenzar.</div>
        )}
      </div>
      {show && (
        <ProductModal
          product={editing}
          close={() => setShow(false)}
          saved={async () => {
            await refresh();
            setShow(false);
          }}
        />
      )}
      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          close={() => setAdjusting(null)}
          saved={async () => {
            setAdjusting(null);
            await refresh();
          }}
        />
      )}
      {historyProduct !== undefined && (
        <MovementHistory
          productId={historyProduct}
          products={products}
          close={() => setHistoryProduct(undefined)}
        />
      )}
    </>
  );
}
function StockAdjustModal({
  product,
  close,
  saved,
}: {
  product: Product;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await window.salesApi.products.adjustStock({
        productId: product.id,
        quantityDelta: Number(delta),
        reason,
      });
      await saved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo ajustar el stock.');
    }
  };
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-heading">
          <h2>Ajustar stock · {product.name}</h2>
          <button type="button" onClick={close}>
            ×
          </button>
        </div>
        <p>
          Stock actual: <strong>{product.stock}</strong>
        </p>
        <label>
          Cantidad (positiva entra, negativa sale)
          <input
            required
            type="number"
            step="1"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
        </label>
        <label>
          Motivo
          <input
            required
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Conteo físico"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={close}>
            Cancelar
          </button>
          <button className="primary-button">Guardar ajuste</button>
        </div>
      </form>
    </div>
  );
}
function MovementHistory({
  productId,
  products,
  close,
}: {
  productId?: number;
  products: Product[];
  close: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState('all');
  useEffect(() => {
    window.salesApi.products.movements(productId, 200, { type }).then(setRows);
  }, [productId, type]);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-heading">
          <div>
            <h2>Historial de stock</h2>
            <p>Movimientos auditables con motivo y saldo.</p>
          </div>
          <button onClick={close}>×</button>
        </div>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Todos</option>
            <option value="sale">Ventas</option>
            <option value="entry">Entradas</option>
            <option value="adjustment">Ajustes</option>
          </select>
        </label>
        <div>
          {rows.map((row) => (
            <div className="expense-row" key={row.id}>
              <div>
                <strong>
                  {row.product_name || products.find((p) => p.id === row.product_id)?.name}
                </strong>
                <small>
                  {row.type} · {row.reason} · {new Date(row.created_at).toLocaleString('es-AR')}
                </small>
              </div>
              <b className={row.quantity_delta > 0 ? 'cash-in' : 'cash-out'}>
                {row.quantity_delta > 0 ? '+' : ''}
                {row.quantity_delta} ({row.stock_before} → {row.stock_after})
              </b>
            </div>
          ))}
          {!rows.length && <div className="empty-state">No hay movimientos.</div>}
        </div>
        <button className="secondary-button full-button" onClick={close}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
function ProductModal({
  product,
  close,
  saved,
}: {
  product: Product | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price_cents) : '');
  const [cost, setCost] = useState(product ? String(product.cost_cents) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [image, setImage] = useState(product?.image_path ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const dirty =
    Boolean(name.trim() || description.trim() || price || cost || stock || image) &&
    (name !== (product?.name ?? '') ||
      description !== (product?.description ?? '') ||
      price !== (product ? String(product.price_cents) : '') ||
      cost !== (product ? String(product.cost_cents) : '') ||
      stock !== (product ? String(product.stock) : '') ||
      image !== (product?.image_path ?? ''));
  const requestClose = () => {
    if (busy || deleteOpen) return;
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Querés descartarlos?')) return;
    close();
  };
  useEffect(() => {
    if (deleteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, busy, deleteOpen]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedName = name.trim();
    const priceValue = Number(price);
    const costValue = Number(cost);
    const stockValue = Number(stock);
    if (!normalizedName) return setError('Ingresá un nombre para el producto.');
    if (normalizedName.length > 120) return setError('El nombre puede tener hasta 120 caracteres.');
    if (!Number.isSafeInteger(priceValue) || priceValue < 0 || priceValue > 2147483647)
      return setError('Ingresá un precio entero válido.');
    if (!Number.isSafeInteger(costValue) || costValue < 0 || costValue > 2147483647)
      return setError('Ingresá un costo entero válido.');
    if (!Number.isInteger(stockValue) || stockValue < 0 || stockValue > 2147483647)
      return setError('Ingresá un stock entero válido.');
    const priceCents = priceValue;
    const costCents = costValue;
    if (!Number.isSafeInteger(priceCents) || !Number.isSafeInteger(costCents))
      return setError('Los importes son demasiado grandes.');
    setBusy(true);
    try {
      const input: ProductInput = {
        id: product?.id,
        name: normalizedName,
        description: description.trim(),
        priceCents,
        costCents,
        stock: stockValue,
        imagePath: image || null,
      };
      if (product) await window.salesApi.products.update({ ...input, id: product.id });
      else await window.salesApi.products.create(input);
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el producto.');
      setBusy(false);
    }
  };
  const archive = async () => {
    if (!product || archiveBusy || busy) return;
    setArchiveBusy(true);
    setError('');
    try {
      await window.salesApi.products.archive({ id: product.id });
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el producto.');
      setArchiveBusy(false);
    }
  };
  const chooseImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Elegí un archivo de imagen.');
    if (file.size > 5 * 1024 * 1024) return setError('La imagen no puede superar 5 MB.');
    setError('');
    setImageBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setImageBusy(false);
    };
    reader.onerror = () => {
      setError('No se pudo leer la imagen.');
      setImageBusy(false);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <form
        className="modal product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        onSubmit={submit}
      >
        <div className="modal-heading">
          <h2 id="product-modal-title">{product ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" aria-label="Cerrar formulario" onClick={requestClose}>
            ×
          </button>
        </div>
        <label>
          Nombre
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Descripción
          <textarea
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción opcional"
          />
        </label>
        <div className="form-row">
          <label>
            Precio de venta
            <input
              required
              type="number"
              min="0"
              max="2147483647"
              step="1"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Costo
            <input
              required
              type="number"
              min="0"
              max="2147483647"
              step="1"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label>
            Stock
            <input
              required
              type="number"
              min="0"
              max="2147483647"
              step="1"
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </label>
        </div>
        <label>
          Imagen del producto
          <input type="file" accept="image/*" onChange={(e) => chooseImage(e.target.files?.[0])} />
          {imageBusy && <small className="field-hint">Procesando imagen…</small>}
        </label>
        {image && (
          <div className="image-preview-wrap">
            <img className="image-preview" src={image} alt="Vista previa del producto" />
            <button type="button" className="link-button" onClick={() => setImage('')}>
              Quitar imagen
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {product && (
            <button
              type="button"
              className="archive-button"
              disabled={busy || archiveBusy || imageBusy}
              onClick={() => setDeleteOpen(true)}
            >
              {'Eliminar producto'}
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            disabled={busy || archiveBusy}
            onClick={requestClose}
          >
            Cancelar
          </button>
          <button className="primary-button" disabled={busy || archiveBusy || imageBusy}>
            {busy ? 'Guardando…' : 'Guardar producto'}
          </button>
        </div>
        {deleteOpen && product && (
          <ProductDeleteModal
            product={product}
            busy={archiveBusy}
            error={error}
            close={() => {
              if (!archiveBusy) setDeleteOpen(false);
            }}
            onDelete={archive}
          />
        )}
      </form>
    </div>
  );
}
function ProductDeleteModal({
  product,
  busy,
  error,
  close,
  onDelete,
}: {
  product: Product;
  busy: boolean;
  error: string;
  close: () => void;
  onDelete: () => Promise<void>;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busy) close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <div
        className="modal delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-product-title"
        aria-describedby="delete-product-description"
      >
        <div className="modal-heading">
          <h2 id="delete-product-title">Eliminar producto</h2>
          <button type="button" aria-label="Cerrar confirmación" disabled={busy} onClick={close}>
            ×
          </button>
        </div>
        <p id="delete-product-description">
          ¿Querés eliminar <strong>“{product.name}”</strong>?
        </p>
        <p className="delete-explanation">
          Se quitará del catálogo activo y del checkout. Las ventas y el historial de inventario se
          conservarán.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={close}>
            Cancelar
          </button>
          <button
            type="button"
            className="destructive-button"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            {busy ? 'Eliminando…' : 'Eliminar producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkout({ products, onSaved }: { products: Product[]; onSaved: () => Promise<void> }) {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const [received, setReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = products.filter((p) => cart[p.id]);
  const total = selected.reduce((sum, p) => sum + p.price_cents * (cart[p.id] || 0), 0);
  const change = Math.max(0, Math.round(Number(received || 0)) - total);
  const add = (p: Product, delta: number) =>
    setCart((c) => ({ ...c, [p.id]: Math.max(0, Math.min(p.stock, (c[p.id] || 0) + delta)) }));
  const filteredProducts = products.filter((p) =>
    `${p.name} ${p.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      } else if (event.key === 'Enter' && document.activeElement === searchRef.current && filteredProducts.length === 1) {
        event.preventDefault();
        if (filteredProducts[0].stock) add(filteredProducts[0], 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredProducts]);
  const submit = async () => {
    if (busy) return;
    setError('');
    if (!selected.length) return setError('Agregá al menos un producto.');
    if (payment === 'cash' && Number(received) < total)
      return setError('El efectivo recibido no alcanza para cubrir el total.');
    setBusy(true);
    try {
      const input: SaleInput = {
        totalCents: total,
        paymentMethod: payment,
        amountReceivedCents: payment === 'cash' ? Number(received) : total,
        changeCents: payment === 'cash' ? change : 0,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
        items: selected.map((p) => ({
          productId: p.id,
          productName: p.name,
          quantity: cart[p.id],
          unitPriceCents: p.price_cents,
          subtotalCents: p.price_cents * cart[p.id],
        })),
      };
      await window.salesApi.sales.create(input);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la venta.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="checkout-layout">
      <section className="panel product-picker">
        <div className="panel-heading">
          <div>
            <h2>Elegí los productos</h2>
            <p>Hacé clic en agregar para sumarlos a la venta.</p>
          </div>
        </div>
        <div className="checkout-search-header">
          <label className="checkout-search">
            <span className="search-label"><span className="search-icon" aria-hidden="true">⌕</span> Buscar producto</span>
            <kbd className="search-shortcut" aria-hidden="true">Ctrl/Cmd K</kbd>
            <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o descripción"
            aria-label="Buscar producto por nombre o descripción"
            />
          </label>
          <span className="search-results" aria-live="polite">
            {filteredProducts.length} resultados · {filteredProducts.filter((product) => product.stock > 0).length} disponibles
          </span>
        </div>
        <div className="picker-grid">
          {filteredProducts.map((p) => (
            <button
              className="picker-card"
              key={p.id}
              disabled={!p.stock}
              onClick={() => add(p, 1)}
            >
              <div className="product-thumb">
                {p.image_path ? <img src={p.image_path} /> : '🍗'}
              </div>
              <strong>{p.name}</strong>
              <span>{money(p.price_cents)}</span>
              <small>{p.stock} disponibles</small>
            </button>
          ))}
        </div>
        {!filteredProducts.length && <div className="empty-state">No hay productos que coincidan con la búsqueda.</div>}
      </section>
      <section className="panel cart-panel">
        <div className="panel-heading">
          <div>
            <h2>Detalle de venta</h2>
            <p>{selected.length} productos seleccionados</p>
          </div>
        </div>
        <div className="checkout-section-label">Productos seleccionados <span>{selected.length}</span></div>
        {selected.map((p) => (
          <div className="cart-row" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <small>{money(p.price_cents)} c/u</small>
            </div>
            <div className="quantity">
              <button onClick={() => add(p, -1)}>−</button>
              <b>{cart[p.id]}</b>
              <button onClick={() => add(p, 1)}>+</button>
            </div>
            <strong>{money(p.price_cents * cart[p.id])}</strong>
          </div>
        ))}
        {!selected.length && <div className="empty-state">Seleccioná productos para comenzar.</div>}
        <div className="checkout-total">
          <span>Total de la venta</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="checkout-section-label">Medio de pago</div>
        <div className="payment-tabs">
          <button
            className={payment === 'cash' ? 'selected' : ''}
            onClick={() => setPayment('cash')}
          >
            💵 Efectivo
          </button>
          <button
            className={payment === 'card' ? 'selected' : ''}
            onClick={() => setPayment('card')}
          >
            💳 Tarjeta
          </button>
        </div>
        <div className="checkout-section-label">Cliente y notas</div>
        <div className="checkout-extra-fields">
          <label>
            Cliente (opcional)
            <input maxLength={120} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre del cliente" />
          </label>
          <label>
            Notas (opcional)
            <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Indicaciones para la venta" rows={2} />
          </label>
        </div>
        {payment === 'cash' && (
          <div className="checkout-cash-section">
          <div className="checkout-section-label">Efectivo y vuelto</div>
          <label className="cash-input">
            Efectivo recibido
            <input
              type="number"
              min="0"
              step="1"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder="Ej. 50000"
            />
            {Number(received) > 0 && (
              <b className={change >= 0 ? 'change-ok' : 'change-error'}>
                {change >= 0 ? `Vuelto: ${money(change)}` : 'Falta dinero'}
              </b>
            )}
          </label>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="checkout-section-label">Confirmación</div>
        <button className="primary-button full-button" disabled={!selected.length || busy} onClick={() => void submit()}>
          {busy ? 'Guardando venta…' : 'Confirmar venta'}
        </button>
      </section>
    </div>
  );
}
function Tables({ products, settings, onChanged, onDirtyChange }: { products: Product[]; settings: SettingsData; onChanged: () => Promise<void>; onDirtyChange: (dirty: boolean) => void }) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<number, number>>({});
  const [orderDirty, setOrderDirty] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const [received, setReceived] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedTable = tables.find((table) => table.id === selectedId) ?? null;
  const selected = products.filter((product) => cart[product.id] > 0);
  const unitPrice = (product: Product) => priceOverrides[product.id] ?? product.price_cents;
  const total = selected.reduce((sum, product) => sum + unitPrice(product) * cart[product.id], 0);
  const change = Math.max(0, Math.round(Number(received || 0)) - total);

  const loadTables = async () => setTables(await window.salesApi.tables.list());
  useEffect(() => {
    void loadTables().catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las mesas.'));
  }, []);

  const selectTable = async (table: DiningTable) => {
    if (orderDirty && !window.confirm('Hay cambios sin guardar en este pedido. ¿Descartarlos y cambiar de mesa?')) return;
    setError('');
    setMessage('');
    setReceived('');
    try {
      const order = await window.salesApi.tables.getOrder(table.id);
      const nextCart: Record<number, number> = {};
      const nextPrices: Record<number, number> = {};
      for (const item of order?.items ?? []) {
        nextCart[item.product_id] = item.quantity;
        nextPrices[item.product_id] = item.unit_price_cents;
      }
      setSelectedId(table.id);
      setCart(nextCart);
      setPriceOverrides(nextPrices);
      setOrderDirty(false);
      onDirtyChange(false);
      setCustomerName(order?.customer_name ?? '');
      setNotes(order?.notes ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el pedido de la mesa.');
    }
  };

  const persistOrder = async (nextCart: Record<number, number>, announce = true) => {
    if (!selectedTable) return false;
    const nextItems = products
      .filter((item) => nextCart[item.id] > 0)
      .map((item) => ({ productId: item.id, quantity: nextCart[item.id] }));
    if (!nextItems.length) return false;
    setBusy(true);
    setError('');
    try {
      const savedOrder = await window.salesApi.tables.saveOrder({
        tableId: selectedTable.id,
        customerName: customerName.trim(),
        notes: notes.trim(),
        items: nextItems,
      });
      if (savedOrder && typeof savedOrder === 'object' && 'items' in savedOrder) {
        const savedItems = (savedOrder as { items: Array<{ product_id: number; unit_price_cents: number }> }).items;
        setPriceOverrides(Object.fromEntries(savedItems.map((item) => [item.product_id, item.unit_price_cents])));
      }
      setCart(nextCart);
      setOrderDirty(false);
      onDirtyChange(false);
      await loadTables();
      if (announce) setMessage(`Pedido de ${selectedTable.name} guardado automáticamente.`);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el pedido.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addProduct = (product: Product, delta: number) => {
    if (busy) return;
    const nextCart = { ...cart, [product.id]: Math.max(0, (cart[product.id] ?? 0) + delta) };
    if (nextCart[product.id] > product.stock) {
      setError(`No hay unidades disponibles adicionales de ${product.name}.`);
      return;
    }
    setError('');
    setCart(nextCart);
    if (delta > 0) void persistOrder(nextCart);
    else {
      setOrderDirty(true);
      onDirtyChange(true);
    }
  };

  const save = async () => {
    if (!selectedTable || !selected.length) {
      setError('Agregá al menos un producto antes de guardar el pedido.');
      return;
    }
    await persistOrder(cart, true);
  };

  const pay = async () => {
    if (!selectedTable || !selectedTable.order_id) {
      setError('Guardá el pedido antes de cobrarlo.');
      return;
    }
    if (orderDirty) {
      setError('Guardá los cambios del pedido antes de cobrar.');
      return;
    }
    if (payment === 'cash' && (!Number.isSafeInteger(Number(received)) || Number(received) < total)) {
      setError('El efectivo recibido debe cubrir el total del pedido.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await window.salesApi.tables.payOrder({
        tableId: selectedTable.id,
        paymentMethod: payment,
        amountReceivedCents: payment === 'cash' ? Number(received) : total,
        changeCents: payment === 'cash' ? change : 0,
      });
      setSelectedId(null);
      setCart({});
      setPriceOverrides({});
      setOrderDirty(false);
      onDirtyChange(false);
      setCustomerName('');
      setNotes('');
      setReceived('');
      await Promise.all([loadTables(), onChanged()]);
      setMessage('Cuenta cobrada y venta registrada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cobrar el pedido.');
    } finally {
      setBusy(false);
    }
  };

  const changeTableCount = async (delta: number) => {
    const nextCount = settings.tableCount + delta;
    if (nextCount < 1 || nextCount > 100) return;
    setBusy(true);
    setError('');
    try {
      const current = await window.salesApi.settings.get();
      await window.salesApi.settings.update({ ...current, tableCount: nextCount });
      await onChanged();
      await loadTables();
      setMessage(delta > 0 ? `Mesa ${nextCount} agregada.` : `Mesa ${settings.tableCount} eliminada.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo modificar la cantidad de mesas.');
    } finally {
      setBusy(false);
    }
  };

  const requestClear = () => {
    if (selectedTable?.order_id) setClearConfirmOpen(true);
  };

  const clear = async () => {
    if (!selectedTable?.order_id) return;
    setClearConfirmOpen(false);
    setBusy(true);
    try {
      await window.salesApi.tables.clearOrder(selectedTable.id);
      setSelectedId(null);
      setCart({});
      setPriceOverrides({});
      setOrderDirty(false);
      onDirtyChange(false);
      setCustomerName('');
      setNotes('');
      await loadTables();
      setMessage(`${selectedTable.name} quedó disponible.`);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo liberar la mesa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tables-page">
      <section className="panel tables-overview">
        <div className="panel-heading salon-heading">
          <div><h2>Salón</h2><p>Elegí una mesa para abrir o continuar su cuenta. El pedido queda guardado en este dispositivo.</p></div>
          <div className="table-management-actions">
            <span>{settings.tableCount} mesas</span>
            <button className="table-count-button" disabled={busy || settings.tableCount <= 1} onClick={() => void changeTableCount(-1)} aria-label="Eliminar la última mesa">−</button>
            <button className="table-count-button" disabled={busy || settings.tableCount >= 100} onClick={() => void changeTableCount(1)} aria-label="Agregar una mesa">+</button>
            <button className="secondary-button" disabled={busy} onClick={() => void loadTables()}>Actualizar ↻</button>
          </div>
        </div>
        <div className="tables-grid">
          {tables.map((table) => (
            <button key={table.id} className={`dining-table-card ${table.order_id ? 'occupied' : 'available'} ${table.id === selectedId ? 'selected' : ''}`} onClick={() => void selectTable(table)}>
              <span className="table-card-icon" aria-hidden="true">♧</span>
              <strong>{table.name}</strong>
              <span className="table-status">{table.order_id ? 'Pendiente de pago' : 'Disponible'}</span>
              {table.order_id ? <><span>{table.unit_count} unidades · {table.item_count} productos</span><b>{money(table.total_cents)}</b></> : <small>Tocar para abrir cuenta</small>}
            </button>
          ))}
          {!tables.length && <div className="empty-state">No hay mesas configuradas.</div>}
        </div>
        {error && !selectedTable && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="success-message" role="status">{message}</p>}
      </section>

      {selectedTable && (
        <div className="table-service-layout">
          <section className="panel table-product-panel">
            <div className="panel-heading"><div><h2>Agregar a {selectedTable.name}</h2><p>Seleccioná los productos para esta cuenta.</p></div></div>
            <div className="picker-grid">
              {products.filter((product) => product.stock > 0).map((product) => (
                <button key={product.id} className="picker-card" disabled={busy} onClick={() => addProduct(product, 1)}>
                  <div className="product-thumb">{product.image_path ? <img src={product.image_path} alt="" /> : '🍗'}</div>
                  <strong>{product.name}</strong><span>{money(product.price_cents)}</span><small>{product.stock} en inventario</small>
                </button>
              ))}
            </div>
            {!products.some((product) => product.stock > 0) && <div className="empty-state">No hay productos con stock disponible.</div>}
          </section>
          <section className="panel table-order-panel">
            <div className="panel-heading"><div><h2>Cuenta · {selectedTable.name}</h2><p>{selectedTable.order_id ? 'Pedido abierto' : 'Nueva cuenta'}</p></div><button className="text-button" onClick={() => { if (!orderDirty || window.confirm('Hay cambios sin guardar en este pedido. ¿Descartarlos?')) { setOrderDirty(false); onDirtyChange(false); setSelectedId(null); } }}>Cerrar</button></div>
            <label>Cliente (opcional)<input maxLength={120} value={customerName} onChange={(event) => { setCustomerName(event.target.value); setOrderDirty(true); onDirtyChange(true); }} placeholder="Nombre del cliente" /></label>
            <label>Notas<textarea maxLength={500} rows={2} value={notes} onChange={(event) => { setNotes(event.target.value); setOrderDirty(true); onDirtyChange(true); }} placeholder="Indicaciones para la cocina" /></label>
            <div className="table-order-items">
              {selected.map((product) => <div className="cart-row" key={product.id}><div><strong>{product.name}</strong><small>{money(unitPrice(product))} c/u</small></div><div className="quantity"><button onClick={() => addProduct(product, -1)}>−</button><b>{cart[product.id]}</b><button disabled={cart[product.id] >= product.stock} onClick={() => addProduct(product, 1)}>+</button></div><strong>{money(unitPrice(product) * cart[product.id])}</strong></div>)}
              {!selected.length && <div className="empty-state">La cuenta todavía no tiene productos.</div>}
            </div>
            <div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div>
            <button className="secondary-button full-button" disabled={!selected.length || busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar pedido'}</button>
            <div className="payment-tabs"><button className={payment === 'cash' ? 'selected' : ''} onClick={() => setPayment('cash')}>💵 Efectivo</button><button className={payment === 'card' ? 'selected' : ''} onClick={() => setPayment('card')}>💳 Tarjeta</button></div>
            {payment === 'cash' && <label>Efectivo recibido<input type="number" min={total} step="1" value={received} onChange={(event) => setReceived(event.target.value)} placeholder={String(total)} />{Number(received) >= total && <small>Vuelto: {money(change)}</small>}</label>}
            <button className="primary-button full-button" disabled={!selectedTable.order_id || !selected.length || busy || orderDirty} onClick={() => void pay()}>{busy ? 'Procesando…' : 'Cobrar y liberar mesa'}</button>
            {selectedTable.order_id && <button className="archive-button full-button" disabled={busy} onClick={requestClear}>Descartar pedido y liberar mesa</button>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <small>El inventario se descuenta al cobrar. Los pedidos abiertos reservan unidades para otras mesas.</small>
          </section>
        </div>
      )}
      {clearConfirmOpen && selectedTable && (
        <TableClearModal
          tableName={selectedTable.name}
          busy={busy}
          close={() => setClearConfirmOpen(false)}
          confirm={() => void clear()}
        />
      )}
    </div>
  );
}

function TableClearModal({ tableName, busy, close, confirm }: { tableName: string; busy: boolean; close: () => void; confirm: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, close]);

  return (
    <div className="modal-backdrop table-clear-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) close();
    }}>
      <div className="modal table-clear-modal" role="dialog" aria-modal="true" aria-labelledby="table-clear-title" aria-describedby="table-clear-description">
        <div className="table-clear-icon" aria-hidden="true">!</div>
        <div className="modal-heading table-clear-heading">
          <div>
            <p className="modal-kicker">Liberar mesa</p>
            <h2 id="table-clear-title">¿Descartar el pedido de {tableName}?</h2>
          </div>
          <button type="button" aria-label="Cerrar confirmación" onClick={close} disabled={busy}>×</button>
        </div>
        <p id="table-clear-description" className="table-clear-description">
          Se eliminarán los productos y las notas de esta cuenta. La mesa quedará disponible nuevamente.
        </p>
        <div className="table-clear-warning"><strong>Esta acción no registra una venta</strong><span>y no se puede deshacer desde el historial.</span></div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={close} disabled={busy}>Conservar pedido</button>
          <button type="button" className="destructive-button" onClick={confirm} disabled={busy}>{busy ? 'Liberando…' : 'Descartar y liberar'}</button>
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (await window.salesApi.auth.login({ email, password })) onLogin(email);
      else setError('Correo o contraseña incorrectos.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">P</div>
        <h1>Bienvenido</h1>
        <p>Ingresá a Pollo &amp; Caja para continuar</p>
        <form onSubmit={submit}>
          <label>
            Correo electrónico
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gmail.com"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button full-button" disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar al sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
function CashRegister({ onChanged }: { onChanged: () => Promise<void> }) {
  const [register, setRegister] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => setRegister(await window.salesApi.cash.get());
  useEffect(() => {
    load();
  }, []);
  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await window.salesApi.cash.open(Number(amount));
      setAmount('');
      setMessage('Caja abierta correctamente.');
      await load();
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo abrir la caja.');
    }
  };
  const close = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await window.salesApi.cash.close(Number(amount));
      setMessage(`Caja cerrada. Diferencia: ${money(result.differenceCents)}`);
      setAmount('');
      await load();
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cerrar la caja.');
    }
  };
  const withdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await window.salesApi.cash.withdraw({
        amountCents: Number(amount),
        reason,
      });
      setAmount('');
      setReason('');
      setMessage('Retiro registrado correctamente.');
      await load();
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo registrar el retiro.');
    }
  };
  const closed = register?.isClosed;
  return (
    <div className="cash-page">
      <div className="cash-summary">
        <div className="panel cash-balance">
          <span>Saldo esperado de hoy</span>
          <strong>{money(register?.balanceCents ?? 0)}</strong>
          <b className={register?.isOpen ? 'cash-open' : 'cash-closed'}>
            {register?.isOpen ? '● Caja abierta' : closed ? '● Caja cerrada' : '● Caja sin abrir'}
          </b>
          {register?.opening && (
            <small>
              Apertura: {money(register.opening.amount_cents)} ·{' '}
              {new Date(register.opening.created_at).toLocaleTimeString('es-AR')}
            </small>
          )}
          {closed && (
            <>
              <small>Contado: {money(register.countedCents ?? register.counted_cents)}</small>
              <small>
                Diferencia: {money(register.differenceCents ?? register.difference_cents)}
              </small>
            </>
          )}
        </div>
        <div className="panel cash-action">
          <h2>{register?.isOpen ? 'Cerrar caja' : closed ? 'Caja cerrada' : 'Abrir caja'}</h2>
          <p>
            {register?.isOpen
              ? 'Contá el efectivo disponible para comparar el saldo.'
              : closed
                ? 'La jornada ya tiene un cierre registrado.'
                : 'Ingresá el efectivo inicial de la jornada.'}
          </p>
          {!closed && (
            <form onSubmit={register?.isOpen ? close : open}>
              <label>
                {register?.isOpen ? 'Efectivo contado' : 'Saldo inicial'}
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej. 25000"
                />
              </label>
              <button className="primary-button">
                {register?.isOpen ? 'Cerrar caja' : 'Abrir caja'}
              </button>
            </form>
          )}
        </div>
      </div>
      {register?.isOpen && (
        <section className="panel expense-form">
          <div className="panel-heading">
            <div>
              <h2>Retirar efectivo</h2>
              <p>Registrá un retiro vinculado a la caja abierta.</p>
            </div>
          </div>
          <form onSubmit={withdraw}>
            <div className="form-row">
              <label>
                Monto
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej. 25000"
                />
              </label>
              <label>
                Motivo
                <input
                  required
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Retiro del dueño"
                />
              </label>
            </div>
            <button className="primary-button">Registrar retiro</button>
          </form>
        </section>
      )}
      {message && <p className="success-message">{message}</p>}
      <section className="panel cash-movements">
        <div className="panel-heading">
          <div>
            <h2>Movimientos del día</h2>
            <p>Ventas en efectivo, gastos, retiros y ajustes.</p>
          </div>
        </div>
        {register?.movements?.length ? (
          register.movements.map((movement: any) => (
            <div className="expense-row" key={movement.id}>
              <div>
                <strong>{movement.description}</strong>
                <small>
                  {movement.type} · {new Date(movement.created_at).toLocaleString('es-AR')}
                </small>
              </div>
              <b className={movement.amount_cents >= 0 ? 'cash-in' : 'cash-out'}>
                {movement.amount_cents >= 0 ? '+' : ''}
                {money(movement.amount_cents)}
              </b>
            </div>
          ))
        ) : (
          <div className="empty-state">No hay movimientos registrados hoy.</div>
        )}
      </section>
    </div>
  );
}
function Settings({ settings, onSaved }: { settings: SettingsData; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [aiConfig, setAiConfig] = useState<{
    model: string;
    configured: boolean;
    safeStorageAvailable: boolean;
  }>({ model: OLLAMA_MODELS[0].id, configured: false, safeStorageAvailable: false });
  const [apiKey, setApiKey] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [automaticBackup, setAutomaticBackup] = useState<AutomaticBackupStatus | null>(null);
  useEffect(() => setForm(settings), [settings]);
  useEffect(() => {
    window.salesApi.database.automaticStatus().then(setAutomaticBackup).catch(() => undefined);
  }, []);
  useEffect(() => {
    window.salesApi.ai.getConfig().then(setAiConfig);
  }, []);
  const saveAiKey = async () => {
    setAiBusy(true);
    try {
      if (!apiKey.trim()) throw new Error('Ingresá una clave de API.');
      await window.salesApi.ai.setKey(apiKey);
      setApiKey('');
      setAiConfig(await window.salesApi.ai.getConfig());
      setMessage('Clave de Ollama Cloud guardada de forma segura.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la clave.');
    } finally {
      setAiBusy(false);
    }
  };
  const removeAiKey = async () => {
    setAiBusy(true);
    try {
      await window.salesApi.ai.clearKey();
      setAiConfig(await window.salesApi.ai.getConfig());
      setMessage('Clave de Ollama Cloud eliminada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar la clave.');
    } finally {
      setAiBusy(false);
    }
  };
  const saveAiModel = async (model: string) => {
    try {
      const saved = await window.salesApi.ai.saveModel(model);
      setAiConfig((previous) => ({ ...previous, ...saved }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el modelo.');
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await window.salesApi.settings.update(form);
      setMessage('Configuración guardada.');
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    }
  };
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await window.salesApi.settings.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Contraseña actualizada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.');
    }
  };
  const backup = async () => {
    setBackupBusy(true);
    try {
      const result = await window.salesApi.database.backup();
      if (!result.canceled) {
        setMessage(`Copia guardada en ${result.filePath}`);
        setAutomaticBackup(await window.salesApi.database.automaticStatus());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la copia.');
    } finally {
      setBackupBusy(false);
    }
  };
  const restore = async () => {
    setBackupBusy(true);
    try {
      const result = await window.salesApi.database.restore();
      if (!result.canceled) {
        setMessage('Base restaurada correctamente.');
        await onSaved();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar la base.');
    } finally {
      setBackupBusy(false);
    }
  };
  return (
    <section className="settings-grid">
      <div className="panel settings-card">
        <div className="panel-heading">
          <div>
            <h2>Configuración del negocio</h2>
            <p>Personalizá la información de tu operación.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Nombre del negocio
            <input
              required
              maxLength={100}
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            />
          </label>
          <label>
            Moneda
            <input
              required
              maxLength={3}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            />
          </label>
          <label>
            Alerta de stock bajo
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
            />
          </label>
          <label>
            Cantidad de mesas
            <input
              required
              type="number"
              min="1"
              max="100"
              step="1"
              value={form.tableCount}
              onChange={(e) => setForm({ ...form, tableCount: Number(e.target.value) })}
            />
            <small className="field-hint">Para reducir la cantidad, primero liberá las mesas con pedidos abiertos.</small>
          </label>
          {message && <p className="success-message">{message}</p>}
          <button className="primary-button">Guardar configuración</button>
        </form>
      </div>
      <div className="panel settings-card">
        <div className="panel-heading">
          <div>
            <h2>IA · Ollama Cloud</h2>
            <p>La clave se cifra y se guarda solo en este equipo.</p>
          </div>
        </div>
        <div className="about-row">
          <span>Estado</span>
          <b className={aiConfig.configured ? 'status-label' : 'muted'}>
            {aiConfig.configured ? '● Configurada' : '○ No configurada'}
          </b>
        </div>
        <label>
          Clave de API
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={aiConfig.configured ? '••••••••••••' : 'Pegá tu clave de Ollama Cloud'}
            autoComplete="off"
          />
        </label>
        {!aiConfig.safeStorageAvailable && (
          <p className="form-error">
            El almacenamiento seguro no está disponible. No se puede guardar la clave.
          </p>
        )}
        <label>
          Modelo
          <select value={aiConfig.model} onChange={(e) => saveAiModel(e.target.value)}>
            {OLLAMA_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="primary-button"
            disabled={aiBusy || !aiConfig.safeStorageAvailable}
            onClick={saveAiKey}
          >
            Guardar clave
          </button>
          {aiConfig.configured && (
            <button
              type="button"
              className="secondary-button"
              disabled={aiBusy}
              onClick={removeAiKey}
            >
              Eliminar clave
            </button>
          )}
        </div>
        <div className="panel-heading">
          <div>
            <h2>Seguridad</h2>
            <p>Cambiá la contraseña del administrador.</p>
          </div>
        </div>
        <form onSubmit={changePassword}>
          <label>
            Contraseña actual
            <input
              required
              type="password"
              minLength={8}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            Nueva contraseña
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <button className="secondary-button">Cambiar contraseña</button>
        </form>
        <div className="about-row">
          <span>Base de datos</span>
          <strong>SQLite local</strong>
        </div>
        <div className="about-row">
          <span>Estado</span>
          <b className="status-label">● Operativa</b>
        </div>
        <div className="about-row">
          <span>Copias automáticas (solo la última)</span>
          <b className={automaticBackup?.lastError ? 'form-error' : 'status-label'}>
            {automaticBackup?.lastError
              ? '● Error en la última copia'
              : automaticBackup?.lastSuccessAt
                ? `● Última copia automática: ${new Date(automaticBackup.lastSuccessAt).toLocaleString('es-CO')}`
                : '○ Aún no ejecutada'}
          </b>
        </div>
        {automaticBackup?.lastError && (
          <p className="form-error">{automaticBackup.lastError}</p>
        )}
        <div className="about-row">
          <span>Copias de seguridad</span>
          <div className="export-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={backupBusy}
              onClick={backup}
            >
              Crear copia
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={backupBusy}
              onClick={restore}
            >
              Restaurar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
function History({ sales, onVoided }: { sales: Sale[]; onVoided: () => Promise<void> }) {
  const [message, setMessage] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [payment, setPayment] = useState<'all' | 'cash' | 'card'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'voided'>('active');
  const [filtered, setFiltered] = useState<Sale[]>(sales);
  const [selected, setSelected] = useState<Sale | null>(null);
  useEffect(() => {
    window.salesApi.sales
      .list(10000, { ...range, paymentMethod: payment, status })
      .then((result) => setFiltered(result as Sale[]));
  }, [range.from, range.to, payment, status, sales.length]);
  const exportData = async (format: 'csv' | 'xlsx') => {
    const result = await window.salesApi.export(format, { ...range, paymentMethod: payment, status });
    if (!result.canceled) setMessage(`Archivo guardado en ${result.filePath}`);
  };
  const total = filtered.reduce((sum, sale) => sum + sale.total_cents, 0);
  const cash = filtered
    .filter((sale) => sale.payment_method === 'cash')
    .reduce((sum, sale) => sum + sale.total_cents, 0);
  const card = total - cash;
  return (
    <section className="panel history-panel">
      <div className="history-filterbar">
        <div className="filter-intro">
          <strong>Filtrar período</strong>
          <span>Revisá y exportá tus ventas</span>
        </div>
        <label>
          Desde
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
        <label>
          Pago
          <select value={payment} onChange={(e) => setPayment(e.target.value as 'all' | 'cash' | 'card')}>
            <option value="all">Todos los medios</option>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
          </select>
        </label>
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'voided')}>
            <option value="active">Activas</option>
            <option value="voided">Anuladas</option>
            <option value="all">Todos los estados</option>
          </select>
        </label>
      </div>
      <div className="history-summary">
        <div>
          <span>Ventas del período</span>
          <strong>{money(total)}</strong>
          <small>
            {filtered.length} {filtered.length === 1 ? 'venta' : 'ventas'}
          </small>
        </div>
        <div>
          <span>En efectivo</span>
          <strong>{money(cash)}</strong>
          <small>Ingresos a caja</small>
        </div>
        <div>
          <span>Con tarjeta</span>
          <strong>{money(card)}</strong>
          <small>Pagos electrónicos</small>
        </div>
        <div>
          <span>Ticket promedio</span>
          <strong>{money(filtered.length ? total / filtered.length : 0)}</strong>
          <small>Por operación</small>
        </div>
      </div>
      <div className="panel-heading history-heading">
        <div>
          <h2>Historial de ventas</h2>
          <p>Hacé clic en una venta para ver sus productos, cobro y vuelto.</p>
        </div>
        <div className="export-actions">
          <button className="secondary-button" onClick={() => exportData('csv')}>
            Descargar CSV
          </button>
          <button className="primary-button" onClick={() => exportData('xlsx')}>
            Exportar Excel
          </button>
        </div>
      </div>
      {message && <p className="success-message">{message}</p>}
      <SalesTable sales={filtered} onSelect={setSelected} />
      {selected && (
        <SaleDetailModal
          sale={selected}
          close={() => setSelected(null)}
          onVoided={async () => {
            setSelected(null);
            await onVoided();
          }}
        />
      )}
    </section>
  );
}
function SaleDetailModal({
  sale,
  close,
  onVoided,
}: {
  sale: Sale;
  close: () => void;
  onVoided: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const voidSale = async () => {
    if (!reason.trim()) return setError('Ingresá un motivo para anular la venta.');
    if (
      !window.confirm(
        '¿Confirmás anular esta venta? Se devolverá el stock y se revertirá el efectivo cobrado.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await window.salesApi.sales.void(sale.id, reason.trim());
      await onVoided();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo anular la venta.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="modal sale-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
      >
        <div className="modal-heading">
          <div>
            <p className="modal-kicker">Detalle de operación</p>
            <h2 id="sale-detail-title">Venta #{String(sale.id).padStart(4, '0')}</h2>
          </div>
          <button type="button" aria-label="Cerrar detalle" onClick={close}>
            ×
          </button>
        </div>
        <div className="sale-detail-meta">
          <span>📅 {new Date(sale.created_at).toLocaleString('es-AR')}</span>
          <b className={`pill ${sale.payment_method === 'cash' ? 'green' : 'blue'}`}>
            {sale.payment_method === 'cash' ? '💵 Efectivo' : '💳 Tarjeta'}
          </b>
        </div>
        {sale.table_id && <div className="sale-payment-row"><span>Mesa</span><b>Mesa {sale.table_id}</b></div>}
        <div className="sale-items-detail">
          <h3>Productos vendidos</h3>
          {sale.items.map((item) => (
            <div className="sale-item-detail" key={`${sale.id}-${item.product_id}`}>
              <div>
                <strong>
                  {item.quantity} × {item.product_name}
                </strong>
                <small>{money(item.unit_price_cents)} por unidad</small>
              </div>
              <b>{money(item.subtotal_cents)}</b>
            </div>
          ))}
        </div>
        <div className="sale-totals">
          <div>
            <span>Total cobrado</span>
            <strong>{money(sale.total_cents)}</strong>
          </div>
          <div>
            <span>Recibido</span>
            <b>{money(sale.amount_received_cents)}</b>
          </div>
          <div>
            <span>{sale.payment_method === 'cash' ? 'Vuelto devuelto' : 'Estado del pago'}</span>
            <b>{sale.payment_method === 'cash' ? money(sale.change_cents) : 'Aprobado'}</b>
          </div>
        </div>
        {(sale.customer_name || sale.notes) && (
          <div className="sale-extra">
            {sale.customer_name && (
              <p>
                <strong>Cliente:</strong> {sale.customer_name}
              </p>
            )}
            {sale.notes && (
              <p>
                <strong>Notas:</strong> {sale.notes}
              </p>
            )}
          </div>
        )}
        {sale.status !== 'voided' && (
          <div className="sale-void-form">
            <label>
              Motivo de anulación
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej. devolución solicitada por el cliente"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="secondary-button full-button"
              disabled={busy}
              onClick={voidSale}
            >
              {busy ? 'Anulando…' : 'Anular venta'}
            </button>
          </div>
        )}
        {sale.status === 'voided' && (
          <p className="form-error">
            Venta anulada{sale.void_record_reason ? `: ${sale.void_record_reason}` : ''}
          </p>
        )}
        <button className="secondary-button full-button" onClick={close}>
          Cerrar detalle
        </button>
      </div>
    </div>
  );
}
function Reports() {
  const [date, setDate] = useState(dateInput(new Date()));
  const [report, setReport] = useState<any>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    window.salesApi.report
      .daily(date)
      .then(setReport)
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar el reporte.'),
      );
  }, [date]);
  const exportReport = async (format: 'csv' | 'xlsx') => {
    const result = await window.salesApi.report.export(date, format);
    if (!result.canceled) setMessage(`Reporte guardado en ${result.filePath}`);
  };
  return (
    <div className="reports-page">
      <div className="page-actions">
        <div>
          <h2>Reporte diario</h2>
          <p className="subtitle">Resumen operativo de una jornada local.</p>
        </div>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="export-actions">
          <button className="secondary-button" onClick={() => exportReport('csv')}>
            CSV
          </button>
          <button className="primary-button" onClick={() => exportReport('xlsx')}>
            Exportar XLSX
          </button>
        </div>
      </div>
      {message && <p className="success-message">{message}</p>}
      {report && (
        <>
          <section className="stats-grid">
            <StatCard
              label="Ventas"
              value={money(report.totalCents)}
              change={`${report.orders} pedidos`}
              icon="◉"
              tone="orange"
            />
            <StatCard
              label="Efectivo"
              value={money(report.paymentSplit.cashCents)}
              change="Ventas del día"
              icon="💵"
              tone="green"
            />
            <StatCard
              label="Tarjeta"
              value={money(report.paymentSplit.cardCents)}
              change="Ventas del día"
              icon="💳"
              tone="purple"
            />
            <StatCard
              label="Ganancia bruta"
              value={money(report.grossProfitCents)}
              change={`${report.marginPercent.toFixed(1)}% margen`}
              icon="↗"
              tone="green"
            />
          </section>
          <div className="content-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Gastos por categoría</h2>
                  <p>Total: {money(report.expensesTotalCents)}</p>
                </div>
              </div>
              {report.expenses.length ? (
                report.expenses.map((expense: any) => (
                  <div className="expense-row" key={expense.category}>
                    <strong>{expense.category}</strong>
                    <b>{money(expense.total_cents)}</b>
                  </div>
                ))
              ) : (
                <div className="empty-state">No hay gastos en esta fecha.</div>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Control de caja</h2>
                  <p>Estado de la jornada</p>
                </div>
              </div>
              <div className="expense-row">
                <span>Apertura</span>
                <b>{report.cash.openingCents == null ? '—' : money(report.cash.openingCents)}</b>
              </div>
              <div className="expense-row">
                <span>Esperado</span>
                <b>{report.cash.expectedCents == null ? '—' : money(report.cash.expectedCents)}</b>
              </div>
              <div className="expense-row">
                <span>Contado</span>
                <b>{report.cash.countedCents == null ? '—' : money(report.cash.countedCents)}</b>
              </div>
              <div className="expense-row">
                <span>Diferencia</span>
                <b>
                  {report.cash.differenceCents == null ? '—' : money(report.cash.differenceCents)}
                </b>
              </div>
              <p className="success-message">
                Estado:{' '}
                {report.cash.status === 'closed'
                  ? 'Caja cerrada'
                  : report.cash.status === 'open'
                    ? 'Caja abierta'
                    : 'Sin apertura'}
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Expenses({ onChanged }: { onChanged: () => Promise<void> }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('insumos');
  const [error, setError] = useState('');
  const load = async () => setExpenses(await window.salesApi.expenses.list(100));
  useEffect(() => {
    load();
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amountCents = Number(amount);
    if (!description.trim()) {
      setError('Ingresá una descripción para el gasto.');
      return;
    }
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      setError('El monto debe ser un número entero positivo de pesos COP.');
      return;
    }
    try {
      await window.salesApi.expenses.create({ description: description.trim(), amountCents, category });
      setDescription('');
      setAmount('');
      await load();
      await onChanged();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo guardar el gasto.';
      setError(
        message.includes('caja')
          ? `${message} Abrila desde Control de caja y volvé a intentar.`
          : message,
      );
    }
  };
  return (
    <div className="expenses-layout">
      <section className="panel expense-form">
        <div className="panel-heading">
          <div>
            <h2>Registrar gasto</h2>
            <p>Cargá compras y egresos de la caja.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Descripción
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Compra de carbón"
            />
          </label>
          <div className="form-row">
            <label>
              Monto
              <input
                required
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 25000"
              />
            </label>
            <label>
              Categoría
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="insumos">Insumos</option>
                <option value="servicios">Servicios</option>
                <option value="personal">Personal</option>
                <option value="other">Otros</option>
              </select>
            </label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button">Guardar gasto</button>
        </form>
      </section>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Gastos registrados</h2>
            <p>Últimos egresos de la operación.</p>
          </div>
        </div>
        {expenses.length ? (
          expenses.map((exp) => (
            <div className="expense-row" key={exp.id}>
              <div>
                <strong>{exp.description}</strong>
                <small>
                  {exp.category} · {new Date(exp.created_at).toLocaleString('es-AR')}
                </small>
              </div>
              <b>{money(exp.amount_cents)}</b>
            </div>
          ))
        ) : (
          <div className="empty-state">Todavía no hay gastos registrados.</div>
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
