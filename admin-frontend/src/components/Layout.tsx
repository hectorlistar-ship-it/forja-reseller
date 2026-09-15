import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../api/auth';
import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = user?.role === 'superadmin'
    ? [{ to: '/super', label: 'SuperAdmin' }, { to: '/', label: 'Mis tiendas' }]
    : [{ to: '/', label: 'Mis tiendas' }];

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <aside style={{
        width: 220,
        borderRight: '1px solid var(--line)',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px', padding: '0 8px' }}>
          Forja Admin
        </div>
        {navItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              color: location.pathname === item.to ? 'var(--accent)' : 'var(--muted)',
              background: location.pathname === item.to ? 'var(--accent-soft)' : 'transparent',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {item.label}
          </Link>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', padding: '0 8px', marginBottom: '8px' }}>
            {user?.username || 'SuperAdmin'}
          </div>
          <button onClick={logout} className="btn btn-ghost" style={{ width: '100%', padding: '8px 12px' }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '24px 32px', overflowX: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
