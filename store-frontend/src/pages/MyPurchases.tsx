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
  email: string;
  password: string;
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
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Mis compras</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)', fontSize: '14px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="btn btn-ghost" style={{ padding: '8px 16px' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
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
    <div className="card" style={{ overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <span style={{ fontSize: '32px' }}>{iconMap[order.platform_key] || '📦'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{order.platform_name}</h3>
              <span className="badge badge-ok">${order.price_usd} USDT</span>
            </div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
              {new Date(order.created_at).toLocaleString('es-MX')}
            </p>
          </div>
          <span style={{ color: 'var(--dim)', padding: '0 16px' }}>
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isOpen && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '16px', background: 'var(--bg)', borderRadius: '0 0 8px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Email</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ flex: 1, background: 'var(--bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px' }}>{order.email}</code>
                <button onClick={() => copyToClipboard(order.email, 'Email')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>Copiar</button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--dim)', marginBottom: '4px', textTransform: 'uppercase' }}>Contraseña</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code style={{ flex: 1, background: 'var(--bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px' }}>{order.password}</code>
                <button onClick={() => copyToClipboard(order.password, 'Contraseña')} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>Copiar</button>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => copyToClipboard(`${order.email} / ${order.password}`, 'Credenciales')} className="btn btn-primary" style={{ padding: '10px 16px' }}>
              Copiar todo
            </button>
          </div>
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