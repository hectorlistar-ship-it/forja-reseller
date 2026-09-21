import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/auth';
import { toast } from 'react-hot-toast';

interface Order {
  id: number;
  platform_key: string;
  platform_name: string;
  platform_icon: string;
  price_usd: number;
  created_at: number;
  email: string | null;
  password: string | null;
  delivery_type?: string;
  delivery_note?: string | null;
  delivery_info?: string | null;
  delivered_at?: number | null;
  status?: string;
}

export function MyPurchases() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/store/my-purchases`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
      }).then(r => r.json());
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgb(var(--ring-strong))', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-serif)', fontWeight: 500, margin: 0 }}>Mis compras</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: 'rgb(var(--muted))', fontSize: '14px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="btn btn-ghost" style={{ padding: '8px 16px' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="shadow-ring-1 card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No tienes compras aún</p>
          <Link to={`/tienda/${localStorage.getItem('store_slug') || 'default'}`} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {orders.map(order => (
            <OrderCard key={order.id} order={order} onToggle={() => setShowDetails(showDetails === order.id ? null : order.id)} isOpen={showDetails === order.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onToggle, isOpen }: { order: Order; onToggle: () => void; isOpen: boolean }) {
  const iconMap: Record<string, string> = {
    netflix: '📺',
    hbo: '🎬',
    disney: '✨',
    vix: '📺',
    spotify: '🎵',
    youtube: '▶️',
  };

  return (
    <div className="shadow-ring-1 card" style={{ overflow: 'hidden', borderRadius: 'var(--radius)' }}>
      <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <span style={{ fontSize: '32px' }}>{iconMap[order.platform_key] || '📦'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-serif)' }}>{order.platform_name}</h3>
              <span className="badge" style={{ background: 'rgb(var(--gold) / 0.15)', color: 'rgb(var(--gold))', border: '1px solid rgb(var(--gold) / 0.35)' }}>${order.price_usd} USDT</span>
            </div>
            <p style={{ margin: 0, color: 'rgb(var(--muted))', fontSize: '13px' }}>
              {new Date(order.created_at).toLocaleString('es-MX')}
            </p>
          </div>
          <span style={{ color: 'rgb(var(--subtle))', padding: '0 16px' }}>
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div style={{ borderTop: '1px solid rgb(var(--border))', padding: '16px', background: 'rgb(var(--surface-2))', borderRadius: '0 0 var(--radius) var(--radius)' }}>
          {order.delivery_type === 'manual' && order.status === 'pending_delivery' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="badge" style={{ background: 'rgb(var(--gold) / 0.15)', color: 'rgb(var(--gold))', border: '1px solid rgb(var(--gold) / 0.35)' }}>🕒 Pendiente de entrega</span>
              </div>
              <p style={{ margin: 0, color: 'rgb(var(--muted))', fontSize: 14, lineHeight: 1.6 }}>
                El vendedor está activando tu producto. En cuanto lo entregue, aparecerá aquí automáticamente.
                {order.delivery_note ? ` ${order.delivery_note}` : ''}
              </p>
            </div>
          ) : order.delivery_type === 'manual' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="badge badge-ok">✅ Entregado</span>
              </div>
              <label style={{ display: 'block', fontSize: '11px', color: 'rgb(var(--subtle))', marginBottom: '4px', textTransform: 'uppercase' }}>Tu producto</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <code style={{ flex: 1, background: 'rgb(var(--bg))', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgb(var(--border))', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{order.delivery_info || 'Producto entregado.'}</code>
                <button onClick={() => copyToClipboard(order.delivery_info || '', 'Producto')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>Copiar</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'rgb(var(--subtle))', marginBottom: '4px', textTransform: 'uppercase' }}>Email</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1, background: 'rgb(var(--bg))', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgb(var(--border))', fontSize: '13px' }}>{order.email}</code>
                    <button onClick={() => copyToClipboard(order.email || '', 'Email')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>Copiar</button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'rgb(var(--subtle))', marginBottom: '4px', textTransform: 'uppercase' }}>Contraseña</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code style={{ flex: 1, background: 'rgb(var(--bg))', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgb(var(--border))', fontSize: '13px' }}>{order.password}</code>
                    <button onClick={() => copyToClipboard(order.password || '', 'Contraseña')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>Copiar</button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => copyToClipboard(`${order.email} / ${order.password}`, 'Credenciales')} className="btn btn-primary" style={{ padding: '10px 16px' }}>
                  Copiar todo
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copiado`);
  });
}

export default MyPurchases;