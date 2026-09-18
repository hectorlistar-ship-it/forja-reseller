import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/http';
import { toast } from 'react-hot-toast';

type Tab = 'resumen' | 'resellers' | 'plataformas';

export function SuperDashboard() {
  const [tab, setTab] = useState<Tab>('resumen');

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>SuperAdmin</h1>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--line)' }}>
        {(['resumen', 'resellers', 'plataformas'] as Tab[]).map(t => (
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

      {tab === 'resumen' && <ResumenTab />}
      {tab === 'resellers' && <ResellersTab />}
      {tab === 'plataformas' && <PlatformsTab />}
    </div>
  );
}

function ResumenTab() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/api/super/stats').then(setStats).catch((err) => toast.error(err.message));
  }, []);

  if (!stats) return <div style={{ color: 'var(--muted)' }}>Cargando...</div>;

  const cards = [
    { label: 'Resellers activos', value: stats.total_resellers },
    { label: 'Tiendas activas', value: stats.total_stores },
    { label: 'Cuentas en stock', value: stats.total_accounts },
    { label: 'Clientes totales', value: stats.total_clients },
    { label: 'Pedidos totales', value: stats.total_orders },
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

function ResellersTab() {
  const [resellers, setResellers] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    api.get<{ resellers: any[] }>('/api/super/resellers')
      .then(d => setResellers(d.resellers || []))
      .catch(err => toast.error(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowNew(v => !v)} className="btn btn-primary" style={{ padding: '10px 16px' }}>
          {showNew ? 'Cancelar' : '+ Nuevo reseller'}
        </button>
      </div>

      {showNew && <NewResellerForm onCreated={() => { setShowNew(false); load(); }} />}

      <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
        {resellers.map((r: any) => (
          <ResellerRow key={r.id} reseller={r} onChanged={load} />
        ))}
        {resellers.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin resellers todavía.</p>}
      </div>
    </div>
  );
}

function NewResellerForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState('basic');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/super/resellers', { username, password, plan });
      toast.success('Reseller creado');
      setUsername('');
      setPassword('');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear reseller');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Usuario</label>
        <input value={username} onChange={e => setUsername(e.target.value)} required style={{ padding: '10px' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '10px' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Plan</label>
        <select value={plan} onChange={e => setPlan(e.target.value)} style={{ padding: '10px' }}>
          <option value="basic">Básico (1 tienda)</option>
          <option value="pro">Profesional (3 tiendas)</option>
          <option value="enterprise">Enterprise (10 tiendas)</option>
        </select>
      </div>
      <button className="btn btn-primary" disabled={loading} style={{ padding: '10px 16px' }}>
        {loading ? 'Creando...' : 'Crear'}
      </button>
    </form>
  );
}

function ResellerRow({ reseller, onChanged }: { reseller: any; onChanged: () => void }) {
  const toggleStatus = async () => {
    const newStatus = reseller.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/api/super/resellers/${reseller.id}`, { status: newStatus });
      toast.success(newStatus === 'active' ? 'Reseller reactivado' : 'Reseller suspendido');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar');
    }
  };

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{reseller.username}</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Plan: {reseller.plan} · Máx. tiendas: {reseller.max_stores} · Estado: {reseller.status}
        </div>
      </div>
      <button onClick={toggleStatus} className="btn btn-ghost" style={{ padding: '8px 12px' }}>
        {reseller.status === 'active' ? 'Suspender' : 'Reactivar'}
      </button>
    </div>
  );
}

function PlatformsTab() {
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    api.get<{ platforms: any[] }>('/api/super/platforms')
      .then(d => setPlatforms(d.platforms || []))
      .catch(err => toast.error(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowNew(v => !v)} className="btn btn-primary" style={{ padding: '10px 16px' }}>
          {showNew ? 'Cancelar' : '+ Nueva plataforma'}
        </button>
      </div>

      {showNew && <NewPlatformForm onCreated={() => { setShowNew(false); load(); }} />}

      <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
        {platforms.map((p: any) => (
          <PlatformRow key={p.key} platform={p} onChanged={load} />
        ))}
        {platforms.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin plataformas configuradas.</p>}
      </div>
    </div>
  );
}

function PlatformRow({ platform, onChanged }: { platform: any; onChanged: () => void }) {
  const [imageUrl, setImageUrl] = useState(platform.image_url || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/api/super/platforms', {
        key: platform.key,
        name: platform.name,
        type: platform.type,
        icon: platform.icon,
        image_url: imageUrl.trim(),
        cost_price: platform.cost_price_usd,
        sale_price: platform.sale_price_usd,
        is_active: platform.is_active,
        sort_order: platform.sort_order,
      });
      toast.success('Imagen guardada');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {imageUrl ? (
            <img src={imageUrl} alt={platform.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: 32, height: 32, objectFit: 'contain' }} />
          ) : null}
          <span>{platform.name} <span style={{ color: 'var(--muted)' }}>({platform.key})</span></span>
        </span>
        <span>${platform.cost_price_usd} costo → ${platform.sale_price_usd} venta</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="URL de la imagen (PNG, JPG, SVG…)"
          style={{ flex: 1, minWidth: '220px', padding: '10px' }}
        />
        <button onClick={save} className="btn btn-primary" disabled={saving} style={{ padding: '10px 16px' }}>
          {saving ? 'Guardando...' : 'Guardar imagen'}
        </button>
      </div>
    </div>
  );
}

function NewPlatformForm({ onCreated }: { onCreated: () => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('streaming');
  const [imageUrl, setImageUrl] = useState('');
  const [cost, setCost] = useState('');
  const [sale, setSale] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/super/platforms', {
        key, name, type,
        image_url: imageUrl.trim(),
        cost_price: Number(cost),
        sale_price: Number(sale),
        is_active: 1,
      });
      toast.success('Plataforma guardada');
      setKey(''); setName(''); setType('streaming'); setImageUrl(''); setCost(''); setSale('');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Key</label>
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="netflix" required style={{ padding: '10px', width: '110px' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Netflix" required style={{ padding: '10px' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Tipo</label>
        <input value={type} onChange={e => setType(e.target.value)} style={{ padding: '10px', width: '110px' }} />
      </div>
      <div style={{ flexBasis: '100%' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>URL de la imagen (opcional)</label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://.../netflix.png" style={{ padding: '10px', width: '100%' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Costo</label>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} required style={{ padding: '10px', width: '90px' }} />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--muted)' }}>Venta</label>
        <input type="number" step="0.01" value={sale} onChange={e => setSale(e.target.value)} required style={{ padding: '10px', width: '90px' }} />
      </div>
      <button className="btn btn-primary" disabled={loading} style={{ padding: '10px 16px' }}>
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

export default SuperDashboard;
