import { Link } from 'react-router-dom';
import { useAuth } from '../api/auth';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const slug = user?.store?.slug || 'default';

  return (
    <div className="theme-public flex min-h-screen flex-col" style={{ background: 'rgb(var(--bg))' }}>
      <div className="shrink-0">
        <a
          href={`/tienda/${slug}`}
          className="block"
          style={{
            background: 'rgb(var(--brand))',
            color: 'rgb(var(--brand-fg))',
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500 }}>
            {user ? `Tienda: ${user.store?.name || slug}` : 'Compra con USDT · Entrega instantánea'}
          </span>
        </a>

        <div style={{ position: 'sticky', top: 0, zIndex: 40, width: '100%' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4px 24px', paddingTop: 16 }}>
            <nav
              className="shadow-ring-1"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 999,
                padding: '8px 12px',
                background: 'rgba(12,12,18,0.8)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <Link to={`/tienda/${slug}`} style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 10, paddingLeft: 4 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgb(var(--ring-strong)), rgb(var(--gold)))',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 15,
                    color: '#fff',
                    boxShadow: '0 0 20px rgb(var(--brand) / 0.45)',
                  }}
                >
                  {(user?.store?.name || 'S').charAt(0).toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'rgb(var(--fg))' }}>
                  {user?.store?.name || 'Tienda Demo'}
                </span>
              </Link>

              <div style={{ flex: 1 }} />

              <Link to={`/tienda/${slug}`} style={{ fontSize: 13, color: 'rgb(var(--muted))', padding: '6px 12px', borderRadius: 999 }}>
                Inicio
              </Link>
              <Link to={`/tienda/${slug}/login`} style={{ fontSize: 13, color: 'rgb(var(--muted))', padding: '6px 12px', borderRadius: 999 }}>
                Mis compras
              </Link>
            </nav>
          </div>
        </div>
      </div>

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <footer
        className="shadow-ring-1"
        style={{
          marginTop: 48,
          borderTop: '1px solid rgb(var(--border))',
          padding: '28px 24px',
          textAlign: 'center',
          color: 'rgb(var(--muted))',
          fontSize: 13,
          background: 'rgb(var(--surface))',
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 500, color: 'rgb(var(--fg))', marginBottom: 6 }}>
          {user?.store?.name || 'Tienda Demo'}
        </div>
        <div>Compra segura · Entrega instantánea · Soporte por Telegram</div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgb(var(--subtle))' }}>Powered by Forja Reseller</div>
      </footer>
    </div>
  );
}

export default Layout;