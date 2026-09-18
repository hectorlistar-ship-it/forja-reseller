import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
interface StoreInfo {
  slug: string;
  name: string;
}

const FALLBACK_IMAGES: Record<string, string> = {
  netflix: 'linear-gradient(135deg, #1f1f2e 0%, #3d0a1e 100%)',
  hbo: 'linear-gradient(135deg, #1f1f2e 0%, #1a114d 100%)',
  disney: 'linear-gradient(135deg, #1f1f2e 0%, #12204a 100%)',
  vix: 'linear-gradient(135deg, #1f1f2e 0%, #2a1a0a 100%)',
  spotify: 'linear-gradient(135deg, #1f1f2e 0%, #05261a 100%)',
  youtube: 'linear-gradient(135deg, #1f1f2e 0%, #2a1205 100%)',
};

function PlatformLogo({ platform }: { platform: any }) {
  const text = platform.key?.charAt(0).toUpperCase() || platform.name?.charAt(0) || 'S';
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = platform.image_url && !imageFailed;
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: FALLBACK_IMAGES[platform.key] || 'linear-gradient(135deg, #1f1f2e, #15151f)',
      }}
    >
      {showImage ? (
        <img
          src={platform.image_url}
          alt={platform.name}
          onError={() => setImageFailed(true)}
          style={{ maxWidth: '72%', maxHeight: '56%', objectFit: 'contain', filter: 'drop-shadow(0 0 24px rgb(var(--brand) / 0.35))' }}
        />
      ) : (
        <span
          style={{
            width: 62,
            height: 62,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgb(var(--ring-strong)), rgb(var(--gold)))',
            display: 'grid',
            placeItems: 'center',
            fontSize: 30,
            fontWeight: 800,
            color: '#0a0a12',
            fontFamily: 'var(--font-serif)',
            boxShadow: '0 0 30px rgb(var(--brand) / 0.4)',
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
}

export function PublicCatalog() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      if (!slug) return;
      try {
        const data = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/catalog/${slug}`).then(r => {
          if (!r.ok) throw new Error('Tienda no encontrada');
          return r.json();
        });
        setStore(data.store);
        setPlatforms(data.platforms || []);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgb(var(--brand))', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ color: 'rgb(var(--bad))', marginBottom: 12, fontFamily: 'var(--font-serif)' }}>Error</h1>
        <p style={{ color: 'rgb(var(--muted))' }}>{error}</p>
      </div>
    );
  }

  if (!store) return null;

  const totalStock = platforms.reduce((acc: number, p: any) => acc + (p.stock || 0), 0);
  const filtered = platforms.filter((p: any) => (p.name + p.key).toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      {/* HERO */}
      <section style={{ position: 'relative', minHeight: 540, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'rgb(var(--bg))' }}>
        <div style={{ position: 'absolute', top: -140, left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, borderRadius: '50%', background: 'radial-gradient(closest-side, rgb(var(--brand) / 0.16), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 80, right: -160, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(closest-side, rgb(var(--gold) / 0.1), transparent)', pointerEvents: 'none' }} />
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.07, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgb(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--fg)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 25%, transparent 75%)',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '80px 24px 64px', textAlign: 'center' }}>
          <div className="shadow-ring-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, background: 'rgb(var(--surface))', padding: '6px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgb(var(--ring-strong))' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>
            {totalStock} cuentas disponibles hoy
          </div>

          <h1 className="storefront-heading-gradient" style={{ margin: '24px auto 0', maxWidth: 860, fontFamily: 'var(--font-serif)', fontSize: 'clamp(44px, 8vw, 76px)', fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.025em' }}>
            {store.name}.<br />Streaming, instantáneo.
          </h1>

          <p style={{ margin: '22px auto 0', maxWidth: 560, fontSize: 17, lineHeight: 1.6, color: 'rgb(var(--muted))' }}>
            Cuentas premium verificadas. Pago seguro con USDT, entrega instantánea, cero fricción.
          </p>

          <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <a href="#products" className="btn btn-primary" style={{ padding: '14px 26px' }}>
              Ver catálogo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
            <a href="#reviews" className="btn btn-ghost" style={{ padding: '14px 26px' }}>Leer reseñas</a>
          </div>

          <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '24px', fontSize: 13, color: 'rgb(var(--muted))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(var(--ring-strong))' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <strong className="tabular-nums" style={{ color: 'rgb(var(--fg))' }}>{platforms.length}</strong> Plataformas
            </div>
            <span style={{ width: 1, height: 14, background: 'rgb(var(--border))' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(var(--ring-strong))' }}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
              <strong className="tabular-nums" style={{ color: 'rgb(var(--fg))' }}>{totalStock}</strong> En stock
            </div>
            <span style={{ width: 1, height: 14, background: 'rgb(var(--border))' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(var(--ring-strong))' }}><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>
              <strong style={{ color: 'rgb(var(--fg))' }}>4.9</strong> Valoración
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="products" style={{ background: 'rgb(var(--surface) / 0.35)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ marginBottom: 40, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgb(var(--ring-strong))' }}>Productos</span>
              <h2 className="storefront-heading-gradient" style={{ margin: '10px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 500, lineHeight: 1.1 }}>
                Todo lo que vendemos
              </h2>
            </div>
            <span className="shadow-ring-1" style={{ borderRadius: 999, background: 'rgb(var(--surface))', padding: '7px 16px', fontSize: 13, color: 'rgb(var(--muted))' }}>
              {platforms.length} {platforms.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative', maxWidth: 480 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--subtle))' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Buscar en ${platforms.length} productos…`}
                style={{ width: '100%', height: 48, borderRadius: 14, background: 'rgb(var(--surface))', paddingLeft: 44, paddingRight: 16, fontSize: 14 }}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgb(var(--muted))' }}>
              <p style={{ fontSize: 17 }}>Sin resultados para «{query}»</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {filtered.map((p: any) => (
                <PlatformCard key={p.key} platform={p} slug={slug!} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" style={{ background: 'rgb(var(--bg))' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ marginBottom: 36 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgb(var(--ring-strong))' }}>Reseñas</span>
            <h2 className="storefront-heading-gradient" style={{ margin: '10px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 500, lineHeight: 1.1 }}>
              Lo que dicen los clientes
            </h2>
          </div>
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {[
              { name: 'Cliente verificado', text: 'Pagué y en segundos tenía mi cuenta. Proceso super simple.', stars: 5 },
              { name: 'Comprador frecuente', text: 'Llevo varias cuentas y todo ha funcionado perfecto. 100% recomendado.', stars: 5 },
              { name: 'Usuario nuevo', text: 'Muy fácil de usar, todo automático y funcional.', stars: 5 },
            ].map(r => (
              <div key={r.name} className="card shadow-ring-1" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', gap: 3, color: 'rgb(var(--gold))' }}>
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgb(var(--fg))' }}>«{r.text}»</p>
                <span style={{ fontSize: 13, color: 'rgb(var(--muted))' }}>{r.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function PlatformCard({ platform, slug }: { platform: any; slug: string }) {
  return (
    <div className="group shadow-editorial" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'rgb(var(--surface))', transition: 'transform 0.2s, box-shadow 0.2s', textDecoration: 'none' }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', width: '100%', overflow: 'hidden', background: 'rgb(var(--surface-2))' }}>
        <PlatformLogo platform={platform} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6, padding: 16 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, lineHeight: 1.2 }}>{platform.name}</h3>
        <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, color: 'rgb(var(--fg))' }}>${platform.price_usd} <span style={{ fontSize: 13, color: 'rgb(var(--subtle))', fontFamily: 'var(--font-sans)' }}>USDT</span></span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: platform.stock > 0 ? 'rgb(124 245 155)' : 'rgb(var(--bad))' }}>
            {platform.stock > 0 ? `${platform.stock} disponibles` : 'Sin stock'}
          </span>
        </div>
        <Link to={`/tienda/${slug}/comprar/${platform.key}`} className="btn btn-primary" style={{ marginTop: 12, width: '100%', padding: '11px 16px' }}>
          Comprar ahora
        </Link>
      </div>
    </div>
  );
}

export default PublicCatalog;