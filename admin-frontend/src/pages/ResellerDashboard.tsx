import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/http';
import { toast } from 'react-hot-toast';

// Sube una imagen desde el disco → devuelve URL directa (consultar /api/admin/upload)
function ImageUploadField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen');
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await api.post<{ url: string }>('/api/admin/upload', {
        data_base64: dataBase64,
        mime: file.type,
      });
      onChange(res.url);
      toast.success('Imagen subida');
    } catch (err: any) {
      toast.error(err.message || 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'https://... o sube una imagen'}
          style={{ flex: 1, padding: '10px' }}
        />
        <input ref={inputRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-secondary" disabled={uploading} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          {uploading ? 'Subiendo...' : '⬆️ Subir'}
        </button>
      </div>
      {value.startsWith('/upload/') && (
        <img src={value} alt="preview" style={{ marginTop: '8px', height: '56px', borderRadius: '8px', objectFit: 'contain' }} />
      )}
    </div>
  );
}

interface Store {
  id: number;
  slug: string;
  name: string;
  wallet_binance: string | null;
  status: string;
}

type Tab = 'resumen' | 'tiendas' | 'inventario' | 'pedidos' | 'clientes' | 'pagos' | 'negocio';

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
            {(['resumen', 'tiendas', 'inventario', 'pedidos', 'clientes', 'pagos', 'negocio'] as Tab[]).map(t => (
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
          {tab === 'negocio' && storeId && <NegocioTab storeId={storeId} />}
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
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editingPromo, setEditingPromo] = useState<string | null>(null);
  const [promoUrl, setPromoUrl] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('streaming');
  const [newCost, setNewCost] = useState('');
  const [newSale, setNewSale] = useState('');
  const [newImage, setNewImage] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  const load = useCallback(() => {
    api.get<{ platforms: any[] }>(`/api/admin/inventory?store_id=${storeId}`)
      .then(d => setPlatforms(d.platforms || []))
      .catch((err) => toast.error(err.message || 'Error al cargar inventario'));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const savePromoImage = async (platformKey: string) => {
    setPromoLoading(true);
    try {
      await api.put(`/api/admin/inventory/${platformKey}?store_id=${storeId}`, { promo_image_url: promoUrl || null });
      toast.success('Imagen de promo actualizada');
      setEditingPromo(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar imagen');
    } finally {
      setPromoLoading(false);
    }
  };

  const createProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const sale = Number(newSale);
    if (!newName.trim() || !sale || sale <= 0) {
      toast.error('Ingresa el nombre y el precio de venta (> 0)');
      return;
    }
    setCreatingProduct(true);
    try {
      await api.post(`/api/admin/inventory/product?store_id=${storeId}`, {
        name: newName.trim(),
        type: newType,
        cost_price_usd: newCost === '' ? 0 : Number(newCost),
        sale_price_usd: sale,
        image_url: newImage.trim() || undefined,
      });
      toast.success('Producto agregado a tu tienda');
      setNewName(''); setNewCost(''); setNewSale(''); setNewImage('');
      setShowNewProduct(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear producto');
    } finally {
      setCreatingProduct(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => setShowNewProduct(v => !v)} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
          {showNewProduct ? 'Cancelar' : '+ Agregar producto'}
        </button>
        <button onClick={() => setShowAdd(v => !v)} className="btn btn-primary" style={{ padding: '10px 16px' }}>
          {showAdd ? 'Cancelar' : '+ Agregar cuentas'}
        </button>
      </div>

      {showNewProduct && (
        <form onSubmit={createProduct} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Nombre del producto</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ej: Photoshop, Curso de Trading, Netflix..."
              style={{ width: '100%', padding: '10px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Tipo</label>
            <select value={newType} onChange={e => setNewType(e.target.value)} style={{ width: '100%', padding: '10px' }}>
              <option value="streaming">Streaming</option>
              <option value="software">Software</option>
              <option value="herramienta">Herramienta</option>
              <option value="curso">Curso</option>
              <option value="producto">Producto / Otro</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Precio costo (USDT)</label>
              <input value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="0" type="number" step="0.01" style={{ width: '100%', padding: '10px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Precio venta (USDT)</label>
              <input value={newSale} onChange={e => setNewSale(e.target.value)} placeholder="5" type="number" step="0.01" style={{ width: '100%', padding: '10px' }} />
            </div>
          </div>
          <ImageUploadField
            label="Imagen del producto (opcional)"
            value={newImage}
            onChange={setNewImage}
            placeholder="Pega una URL o súbela"
          />
          <button className="btn btn-primary" disabled={creatingProduct} style={{ padding: '12px' }}>
            {creatingProduct ? 'Creando...' : 'Crear producto'}
          </button>
        </form>
      )}

      {showAdd && (
        <AddAccountsForm storeId={storeId} onAdded={() => { setShowAdd(false); load(); }} />
      )}

      <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
        {platforms.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>
            Tu tienda está vacía. Usa «+ Agregar producto» para crear el primero (streaming, software, herramientas, cursos...).
          </p>
        )}
        {platforms.map((p: any) => (
          <div key={p.platform_key} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>${p.sale_price_usd} USDT · costo ${p.cost_price_usd}</div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                <span className="badge badge-ok">{p.stock} disponibles</span>
                <span style={{ color: 'var(--muted)' }}>{p.sold} vendidas</span>
                <button
                  onClick={() => { setEditingPromo(editingPromo === p.platform_key ? null : p.platform_key); setPromoUrl(p.promo_image_url || ''); }}
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  {p.promo_image_url ? '🖼️ Editar promo' : '🖼️ Imagen promo'}
                </button>
              </div>
            </div>
            {editingPromo === p.platform_key && (
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <ImageUploadField
                    label="Imagen para /promo (dejar vacía para la predeterminada)"
                    value={promoUrl}
                    onChange={setPromoUrl}
                    placeholder="Pega una URL o súbela"
                  />
                </div>
                <button onClick={() => savePromoImage(p.platform_key)} disabled={promoLoading} className="btn btn-primary" style={{ padding: '8px 12px', alignSelf: 'flex-end' }}>
                  {promoLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddAccountsForm({ storeId, onAdded }: { storeId: number; onAdded: () => void }) {
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [platform, setPlatform] = useState('');
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ platforms: any[] }>(`/api/admin/inventory?store_id=${storeId}`)
      .then(d => {
        const plats = d.platforms || [];
        setPlatforms(plats);
        if (plats.length > 0) setPlatform(plats[0].platform_key);
      })
      .catch(() => {});
  }, [storeId]);

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
        {platforms.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No hay plataformas disponibles para esta tienda.</p>
        ) : (
          <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ width: '100%', padding: '10px' }}>
            {platforms.map((p: any) => (
              <option key={p.platform_key} value={p.platform_key}>{p.name}</option>
            ))}
          </select>
        )}
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
      <button className="btn btn-primary" disabled={loading || platforms.length === 0} style={{ padding: '12px' }}>
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

function NegocioTab({ storeId }: { storeId: number }) {
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    business_name: '',
    wallet_binance: '',
    trc20_address: '',
    gmail_user: '',
    gmail_app_password: '',
    bot_token: '',
  });
  const [saving, setSaving] = useState(false);
  const [savedSecret, setSavedSecret] = useState<{ gmail?: boolean; token?: boolean }>({});
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoTimezone, setPromoTimezone] = useState(-180);
  const [promoChats, setPromoChats] = useState<any[]>([]);

  const load = useCallback(() => {
    api.get<{ settings: any }>(`/api/admin/mi-negocio?store_id=${storeId}`)
      .then(d => {
        const s = d.settings;
        setSettings(s);
        setForm({
          name: s.name || '',
          business_name: s.business_name || '',
          wallet_binance: s.wallet_binance || '',
          trc20_address: s.trc20_address || '',
          gmail_user: s.gmail_user || '',
          gmail_app_password: '',
          bot_token: '',
        });
        setSavedSecret({ gmail: !!s.gmail_password_set, token: !!s.bot_token_set });
        setPromoEnabled(!!s.promo_enabled);
        setPromoTimezone(s.promo_timezone ?? -180);
      })
      .catch(err => toast.error(err.message || 'Error al cargar configuración'));

    api.get<{ promo_enabled: number; promo_timezone: number; chats: any[] }>(`/api/admin/promos/chats?store_id=${storeId}`)
      .then(d => {
        setPromoEnabled(!!d.promo_enabled);
        setPromoTimezone(d.promo_timezone);
        setPromoChats(d.chats || []);
      })
      .catch(() => {});
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/admin/mi-negocio?store_id=${storeId}`, { ...form, promo_enabled: promoEnabled ? 1 : 0, promo_timezone: promoTimezone });
      toast.success('Negocio actualizado');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div style={{ color: 'var(--muted)' }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: '640px' }}>
      <form onSubmit={save} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Mi negocio</h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
          Estos datos los configuras tú: el dueño de la plataforma nunca ve tus credenciales.
        </p>

        <Field label="Nombre de la tienda">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mi Tienda" style={{ width: '100%', padding: '10px' }} />
        </Field>

        <Field label="Marca / Nombre de negocio (se muestra al cliente)">
          <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="Ej: CinePlus Store" style={{ width: '100%', padding: '10px' }} />
        </Field>

        <Field label="UID Binance (donde recibes tus pagos)">
          <input value={form.wallet_binance} onChange={e => setForm({ ...form, wallet_binance: e.target.value })} placeholder="Ej: 68500125" style={{ width: '100%', padding: '10px' }} />
        </Field>

        <Field label="Dirección TRC20 (opcional, método de pago alternativo)">
          <input value={form.trc20_address} onChange={e => setForm({ ...form, trc20_address: e.target.value })} placeholder="Tkr0m..." style={{ width: '100%', padding: '10px' }} />
        </Field>

        <Field label="Gmail para validar pagos (sin contraseña real, usa App Password)">
          <input value={form.gmail_user} onChange={e => setForm({ ...form, gmail_user: e.target.value })} placeholder="tucorreo@gmail.com" style={{ width: '100%', padding: '10px' }} />
          {savedSecret.gmail && <span className="badge badge-ok">📧 Configurado</span>}
        </Field>

        <Field label="App Password de Gmail (16 caracteres, se guarda cifrada)">
          <input type="password" value={form.gmail_app_password} onChange={e => setForm({ ...form, gmail_app_password: e.target.value })} placeholder={savedSecret.gmail ? '•••••••• (déjalo vacío para conservar)' : 'abcd efgh ijkl mnop'} style={{ width: '100%', padding: '10px' }} />
          {savedSecret.gmail && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Ya tienes una guardada. Vacío = no cambia.</span>}
        </Field>

        <Field label="Token de tu bot de Telegram (de @BotFather)">
          <input type="password" value={form.bot_token} onChange={e => setForm({ ...form, bot_token: e.target.value })} placeholder={savedSecret.token ? '•••••••• (déjalo vacío para conservar)' : '123456:ABC-DEF...'} style={{ width: '100%', padding: '10px' }} />
          {savedSecret.token && <span className="badge badge-ok">🤖 Bot configurado</span>}
        </Field>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>📅 Promos automáticas diarias</h3>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--muted)' }}>
            El bot publica tus servicios en tus grupos a las <b>8:30 AM</b> y <b>2:00 PM</b> (hora de tu zona).
            Agrega tu bot a un grupo como <b>administrador</b> y quedará registrado automáticamente aquí.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '10px' }}>
            <input type="checkbox" checked={promoEnabled} onChange={e => setPromoEnabled(e.target.checked)} />
            Activar publicación automática diaria
          </label>
          <SelectTimezone prefix="Zona horaria: " value={promoTimezone} onChange={setPromoTimezone} />

          {promoChats.length > 0 && (
            <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
              {promoChats.map((chat: any) => (
                <div key={chat.chat_id} className="card" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', fontSize: '13px' }}>
                  <span>{chat.chat_title || `Grupo #${chat.chat_id}`}</span>
                  <span className="badge badge-ok">📢 Promos activas</span>
                </div>
              ))}
            </div>
          )}
          {promoChats.length === 0 && promoEnabled && (
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              Aún no hay grupos registrados. Agrega tu bot a un grupo como administrador.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" disabled={saving} style={{ padding: '12px 20px' }}>
            {saving ? 'Guardando...' : 'Guardar mi negocio'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function SelectTimezone({ prefix, value, onChange }: { prefix: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
      <span>{prefix}</span>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ padding: '6px', fontSize: '13px' }}
      >
        <option value={-300}>UTC-5 (Ciudad de México)</option>
        <option value={-240}>UTC-4 (Rep. Dominicana, Venezuela)</option>
        <option value={-180}>UTC-3 (Argentina, Chile)</option>
        <option value={-60}>UTC-1 (Portugal)</option>
        <option value={0}>UTC (Londres)</option>
        <option value={60}>UTC+1 (España, Madrid)</option>
      </select>
    </div>
  );
}

export default ResellerDashboard;
