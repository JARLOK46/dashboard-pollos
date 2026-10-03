import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const sales = [
  { id: '#V-1048', customer: 'Mostrador', items: '2 pollos + papas', total: '$ 18.500', method: 'Efectivo', tone: 'green' },
  { id: '#V-1047', customer: 'Delivery · Laura M.', items: '1 pollo familiar', total: '$ 12.000', method: 'Tarjeta', tone: 'blue' },
  { id: '#V-1046', customer: 'Mostrador', items: '3 combos', total: '$ 26.500', method: 'Efectivo', tone: 'green' },
  { id: '#V-1045', customer: 'Delivery · Carlos R.', items: '2 pollos', total: '$ 21.000', method: 'Tarjeta', tone: 'blue' },
];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P</div><div><strong>Pollo &amp; Caja</strong><span>Gestión de ventas</span></div></div>
        <nav>
          <p className="nav-label">MENÚ PRINCIPAL</p>
          <a className="nav-item active"><span>⌂</span> Dashboard</a>
          <a className="nav-item"><span>▣</span> Productos</a>
          <a className="nav-item"><span>▤</span> Nueva venta</a>
          <a className="nav-item"><span>◷</span> Historial de ventas</a>
          <a className="nav-item"><span>↗</span> Gastos</a>
          <p className="nav-label section-label">ADMINISTRACIÓN</p>
          <a className="nav-item"><span>▥</span> Caja</a>
          <a className="nav-item"><span>⚙</span> Configuración</a>
        </nav>
        <div className="sidebar-footer"><div className="status-dot" /> <span>Caja abierta</span><b>$ 184.250</b></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">MIÉRCOLES, 12 DE JUNIO DE 2024</p><h1>Buen día, Jarlok <span>👋</span></h1><p className="subtitle">Este es el resumen de tu negocio hoy.</p></div><div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♧<i /></button><div className="avatar">JG</div></div></header>
        <section className="stats-grid">
          <StatCard label="Ventas de hoy" value="$ 86.500" change="+12,5%" hint="vs. ayer" icon="◉" tone="orange" />
          <StatCard label="Pedidos" value="24" change="+8,2%" hint="vs. ayer" icon="▤" tone="purple" />
          <StatCard label="Ticket promedio" value="$ 3.604" change="+4,6%" hint="vs. ayer" icon="⌁" tone="green" />
          <StatCard label="Gastos del día" value="$ 18.200" change="-2,4%" hint="vs. ayer" icon="↗" tone="red" negative />
        </section>
        <div className="content-grid">
          <section className="panel sales-panel"><div className="panel-heading"><div><h2>Ventas de hoy</h2><p>Últimas transacciones registradas</p></div><button className="text-button">Ver todas <span>→</span></button></div><div className="sales-table"><div className="table-row table-head"><span>VENTA</span><span>CLIENTE</span><span>DETALLE</span><span>TOTAL</span><span>PAGO</span></div>{sales.map((sale) => <div className="table-row" key={sale.id}><span className="sale-id">{sale.id}</span><span>{sale.customer}</span><span className="muted">{sale.items}</span><span className="total">{sale.total}</span><span><b className={`pill ${sale.tone}`}>{sale.method}</b></span></div>)}</div></section>
          <section className="panel quick-panel"><div className="panel-heading"><div><h2>Acciones rápidas</h2><p>Lo que más usás</p></div></div><button className="quick-action primary"><span className="action-icon">＋</span><div><strong>Nueva venta</strong><small>Registrar una venta</small></div><span>→</span></button><button className="quick-action"><span className="action-icon purple-icon">▣</span><div><strong>Agregar producto</strong><small>Actualizar catálogo</small></div><span>→</span></button><button className="quick-action"><span className="action-icon green-icon">↗</span><div><strong>Registrar gasto</strong><small>Cargar un nuevo gasto</small></div><span>→</span></button></section>
        </div>
        <section className="bottom-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h2>Resumen de ventas</h2><p>Rendimiento de los últimos 7 días</p></div><select><option>Esta semana</option></select></div><div className="chart"><div className="chart-labels"><span>$100k</span><span>$75k</span><span>$50k</span><span>$25k</span><span>$0</span></div><div className="chart-area"><div className="grid-lines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 600 170" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity=".25"/><stop offset="100%" stopColor="#f97316" stopOpacity="0"/></linearGradient></defs><path d="M0 135 C 30 125, 48 115, 85 120 S 130 80, 170 105 S 215 95, 250 80 S 300 100, 335 70 S 385 85, 420 60 S 475 75, 510 45 S 560 55, 600 20 L600 170 L0 170Z" fill="url(#fill)"/><path d="M0 135 C 30 125, 48 115, 85 120 S 130 80, 170 105 S 215 95, 250 80 S 300 100, 335 70 S 385 85, 420 60 S 475 75, 510 45 S 560 55, 600 20" fill="none" stroke="#f97316" strokeWidth="3"/></svg><div className="x-labels"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></div></div></div><div className="panel stock-panel"><div className="panel-heading"><div><h2>Stock bajo</h2><p>Productos que necesitan atención</p></div><button className="text-button">Ver productos <span>→</span></button></div><div className="stock-item"><div className="product-thumb chicken">🍗</div><div className="stock-info"><strong>Pollo entero</strong><span>Quedan 8 unidades</span></div><div className="stock-bar"><i style={{width:'20%'}} /></div></div><div className="stock-item"><div className="product-thumb fries">🍟</div><div className="stock-info"><strong>Papas fritas</strong><span>Quedan 12 porciones</span></div><div className="stock-bar"><i style={{width:'35%'}} /></div></div><div className="stock-item"><div className="product-thumb soda">🥤</div><div className="stock-info"><strong>Gaseosa 1.5L</strong><span>Quedan 6 unidades</span></div><div className="stock-bar"><i style={{width:'15%'}} /></div></div></div></section>
      </main>
    </div>
  );
}
function StatCard({label,value,change,hint,icon,tone,negative=false}:{label:string;value:string;change:string;hint:string;icon:string;tone:string;negative?:boolean}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={negative?'down':''}>{change} <em>{hint}</em></small></div><span className="card-menu">•••</span></div> }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
