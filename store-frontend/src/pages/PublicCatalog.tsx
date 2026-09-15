import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
interface StoreInfo {
  slug: string;
  name: string;
}

export function PublicCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      if (!slug) return;
      try {
        const data = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/catalog/${slug}`).then(r => {
          if (!r.ok) throw new Error('Tienda no encontrada');
          return r.json();
        });
        setStore(data.store);
        setPlatforms(data.platforms);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar catálogo');
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h1 style={{ color: 'var(--bad)', marginBottom: '12px' }}>Error</h1>
        <p style={{ color: 'var(--muted)' }}>{error}</p>
      </div>
    );
  }

  if (!store) return null;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>{store.name}</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>Catálogo de cuentas streaming</p>
      </div>

      {platforms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <p>No hay stock disponible en este momento.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {platforms.map((p: any) => (
            <PlatformCard key={p.key} platform={p} slug={slug!} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformCard({ platform, slug }: { platform: any; slug: string }) {
  const iconMap: Record<string, string> = {
    netflix: '📺',
    hbo: '🎬',
    disney: '✨',
    vix: '📺',
    spotify: '🎵',
    youtube: '▶️',
  };

  return (
    <Link to={`/tienda/${slug}/comprar/${platform.key}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.2s, box-shadow 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '32px' }}>{iconMap[platform.key] || '📦'}</span>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{platform.name}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>{platform.type}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>${platform.price_usd} USDT</span>
          <span className={`badge ${platform.stock > 0 ? 'badge-ok' : 'badge-bad'}`}>
            {platform.stock > 0 ? `${platform.stock} disponibles` : 'Sin stock'}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default PublicCatalog;