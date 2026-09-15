import { Link } from 'react-router-dom';
import { useAuth } from '../api/auth';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'rgba(17,19,24,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <Link to={`/tienda/${user?.store?.slug || 'default'}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <path d="M8 21h8"/><path d="M12 17v4"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>Reseller Store</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/mis-compras" style={{ color: 'var(--muted)', fontSize: '14px', textDecoration: 'none' }}>Mis compras</Link>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '20px 24px' }}>
        {children}
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '16px 24px', textAlign: 'center', color: 'var(--dim)', fontSize: '12px' }}>
        Reseller Store - Powered by Forja
      </footer>
    </div>
  );
}

export default Layout;
