import { Navigate } from 'react-router-dom';
import { useAuth, Role } from '../api/auth';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A superadmin can also access reseller-only screens (the backend allows
  // it too), but a plain reseller can't reach the superadmin panel.
  if (role === 'superadmin' && user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
