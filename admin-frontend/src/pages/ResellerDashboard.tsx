import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import { toast } from 'react-hot-toast';

interface Store {
  id: number;
  slug: string;
  name: string;
  wallet_binance: string | null;
  status: string;
}

type Tab = 'resumen' | 'tiendas' | 'inventario' | 'pedidos' | 'clientes' | 'pagos';

export function ResellerDashboard() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('resumen');
  const [loading, setLoading] = useState(true);

  const loadStores = useCallback(async () => {
    try {
      const data = await api.get<{ stores: Store[] }>('/api/admin/stores');
      setStores(data.stores || []);
      if (data.stores?.length && !storeId) setStoreId(data.stores[0].id);
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar tiendas');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { loadStores(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--muted)' }}>Cargando...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Mis tiendas</h1>
        {stores.length > 0 && (
          <select
            value={storeId ?? ''}
            onChange={e => setStoreId(Number(e.target.value))}
            style={{ padding: '10px 12px', minWidth: '220px' }}
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>
            ))}
          </select>
        )}
      </div>

      {stores.length === 0 ? (
        <NoStoresYet onCreated={loadStores} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
            {(['resumen', 'tiendas', 'inventario', 'pedidos', 'clientes', 'pagos'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="btn btn-ghost"
                style={{
                  borderRadius: '8px 8px 0 0',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--accent)' : 'var(--muted)',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'resumen' && storeId && <ResumenTab storeId={storeId} />}
          {tab === 'tiendas' && <TiendasTab stores={stores} onChanged={loadStores} />}
          {tab === 'inventario' && storeId && <InventarioTab storeId={storeId} />}
          {tab === 'pedidos' && storeId && <PedidosTab storeId={storeId} />}
          {tab === 'clientes' && storeId && <ClientesTab storeId={storeId} />}
          {tab === 'pagos' && storeId && <PagosTab storeId={storeId} />}
        </>
      )}
    </div>
  );
}

function NoStoresYet({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/admin/stores', { slug, name, wallet_binance: wallet || undefined });
      toast.success('Tienda creada');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear tienda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '480px' }}>
      <h2 style={{ marginBottom: '12px' }}>Crea tu primera tienda</h2>
      <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Slug (URL)</label>
          <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="mi-tienda" required style={{ width: '100%', padding: '10px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Tienda" required style={{ width: '100%', padding: '10px' }} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Wallet Binance (USDT)</label>
          <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x..." style={{ width: '100%', padding: '10px' }} />
        </div>
        <button className="btn btn-primary" disabled={loading} style={{ padding: '12px' }}>
          {loading ? 'Creando...' : 'Crear tienda'}
        </button>
      </form>
    </div>
  );
}

function ResumenTab({ storeId }: { storeId: number }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/admin/stats?store_id=${storeId}`).then(setStats).catch(() => {});
  }, [storeId]);

  if (!stats) return <div style={{ color: 'var(--muted)' }}>Cargando...</div>;

  const cards = [
    { label: 'Stock disponible', value: stats.stock_available },
    { label: 'Clientes', value: stats.total_clients },
    { label: 'Pedidos', value: stats.total_orders },
    { label: 'Ingresos (USDT)', value: `$${stats.total_revenue}` },
    { label: 'Ganancia (USDT)', value: `$${stats.total_profit}` },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
      {cards.map(c => (
        <div key={c.label} className="card">
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>{c.label}</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function TiendasTab({ stores, onChanged }: { stores: Store[]; onChanged: () => void }) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowNew(v => !v)} className="btn btn-primary" style={{ padding: '10px 16px' }}>
          {showNew ? 'Cancelar' : '+ Nueva tienda'}
        </button>
      </div>

      {showNew && (
        <div style={{ marginBottom: '16px' }}>
          <NoStoresYet onCreated={() => { setShowNew(false); onChanged(); }} />
        </div>
      )}

      <div style={{ display: 'grid', gap: '10px' }}>
        {stores.map(s => (
          <StoreCard key={s.id} store={s} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function StoreCard({ store, onChanged }: { store: Store; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.name);
  const [wallet, setWallet] = useState(store.wallet_binance || '');
  const [status, setStatus] = useState(store.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/admin/stores/${store.id}`, { name, wallet_binance: wallet, status });
      toast.success('Tienda actualizada');
      setEditing(false);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      {!editing ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{store.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>/{store.slug}</span></div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Wallet: {store.wallet_binance || 'sin configurar'} · Estado: {store.status}
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="btn btn-ghost" style={{ padding: '8px 12px' }}>Editar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" style={{ padding: '8px' }} />
          <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="Wallet Binance" style={{ padding: '8px' }} />
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px' }}>
            <option value="active">Activa</option>
            <option value="paused">Pausada</option>
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={saving} className="btn btn-primary" style={{ padding: '8px 16px' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setEditing(false)} className="btn btn-ghost" style={{ padding: '8px 16px' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InventarioTab({ storeId }: { storeId: number }) {
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    api.get<{ platforms: any[] }>(`/api/admin/inventory?store_id=${storeId}`)
      .then(d => setPlatforms(d.platforms || []))
      .catch((err) => toast.error(err.message || 'Error al cargar inventario'));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowAdd(v => !v)} className="btn btn-primary" style={{ padding: '10px 16px' }}>
          {showAdd ? 'Cancelar' : '+ Agregar cuentas'}
        </button>
      </div>

      {showAdd && (
        <AddAccountsForm storeId={storeId} onAdded={() => { setShowAdd(false); load(); }} />
      )}

      <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
        {platforms.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin plataformas configuradas para esta tienda.</p>}
        {platforms.map((p: any) => (
          <div key={p.platform_key} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>${p.sale_price_usd} USDT · costo ${p.cost_price_usd}</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <span className="badge badge-ok">{p.stock} disponibles</span>
              <span style={{ color: 'var(--muted)' }}>{p.sold} vendidas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddAccountsForm({ storeId, onAdded }: { storeId: number; onAdded: () => void }) {
  const [platform, setPlatform] = useState('netflix');
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cuentas = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const [email, password, ...notes] = line.split(':');
        return { email, password, notes: notes.join(':') || undefined };
      })
      .filter(c => c.email && c.password);

    if (cuentas.length === 0) {
      toast.error('Agrega al menos una cuenta en formato email:password');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ added: number }>(`/api/admin/inventory/add?store_id=${storeId}`, { plataforma: platform, cuentas });
      toast.success(`${res.added} cuentas agregadas`);
      setRaw('');
      onAdded();
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar cuentas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Plataforma</label>
        <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ width: '100%', padding: '10px' }}>
          <option value="netflix">Netflix</option>
          <option value="hbo">HBO Max</option>
          <option value="disney">Disney+</option>
          <option value="vix">Vix</option>
          <option value="spotify">Spotify Premium</option>
          <option value="youtube">YouTube Premium</option>
        </select>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>
          Cuentas (una por línea: email:contraseña)
        </label>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={'correo1@mail.com:clave123\ncorreo2@mail.com:clave456'}
          rows={6}
          style={{ width: '100%', padding: '10px', fontFamily: 'ui-monospace, monospace', fontSize: '13px' }}
        />
      </div>
      <button className="btn btn-primary" disabled={loading} style={{ padding: '12px' }}>
        {loading ? 'Agregando...' : 'Agregar al inventario'}
      </button>
    </form>
  );
}

function PedidosTab({ storeId }: { storeId: number }) {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    api.get<{ orders: any[] }>(`/api/admin/orders?store_id=${storeId}`)
      .then(d => setOrders(d.orders || []))
      .catch(err => toast.error(err.message || 'Error al cargar pedidos'));
  }, [storeId]);

  if (orders.length === 0) return <p style={{ color: 'var(--muted)' }}>Aún no hay pedidos.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
            <th style={{ padding: '8px' }}>Cliente</th>
            <th style={{ padding: '8px' }}>Plataforma</th>
            <th style={{ padding: '8px' }}>Precio</th>
            <th style={{ padding: '8px' }}>Ganancia</th>
            <th style={{ padding: '8px' }}>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o: any) => (
            <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px' }}>{o.client_username}</td>
              <td style={{ padding: '8px' }}>{o.platform_name}</td>
              <td style={{ padding: '8px' }}>${o.price_usd}</td>
              <td style={{ padding: '8px' }}>${o.profit_usd}</td>
              <td style={{ padding: '8px' }}>{new Date(o.created_at * 1000).toLocaleString('es-MX')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientesTab({ storeId }: { storeId: number }) {
  const [clients, setClients] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [lastPassword, setLastPassword] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ clients: any[] }>(`/api/admin/clients?store_id=${storeId}`)
      .then(d => setClients(d.clients || []))
      .catch(err => toast.error(err.message || 'Error al cargar clientes'));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<{ password: string }>(`/api/admin/clients?store_id=${storeId}`, { nombre: nombre.trim() });
      setLastPassword(res.password);
      setNombre('');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear cliente');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <form onSubmit={createClient} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de usuario" style={{ flex: 1, padding: '10px' }} />
        <button className="btn btn-primary" disabled={creating} style={{ padding: '10px 16px' }}>
          {creating ? 'Creando...' : '+ Crear cliente'}
        </button>
      </form>

      {lastPassword && (
        <div className="card" style={{ marginBottom: '16px', background: 'var(--accent-soft)' }}>
          Contraseña generada: <code>{lastPassword}</code> — cópiala, no se volverá a mostrar.
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px' }}>
        {clients.map((c: any) => (
          <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{c.username}</span>
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{c.status}</span>
          </div>
        ))}
        {clients.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin clientes registrados todavía.</p>}
      </div>
    </div>
  );
}

function PagosTab({ storeId }: { storeId: number }) {
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    api.get<{ payments: any[] }>(`/api/admin/payments?store_id=${storeId}`)
      .then(d => setPayments(d.payments || []))
      .catch(err => toast.error(err.message || 'Error al cargar pagos'));
  }, [storeId]);

  if (payments.length === 0) return <p style={{ color: 'var(--muted)' }}>No hay pagos pendientes.</p>;

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {payments.map((p: any) => (
        <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>@{p.binance_user}</span>
          <span>${p.usdt_amount} USDT</span>
          <span style={{ color: 'var(--muted)' }}>{new Date(p.created_at * 1000).toLocaleString('es-MX')}</span>
        </div>
      ))}
    </div>
  );
}

export default ResellerDashboard;
