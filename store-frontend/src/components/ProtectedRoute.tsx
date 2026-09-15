import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../api/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    const loginTarget = slug ? `/tienda/${slug}/login` : (user as any)?.store?.slug
      ? `/tienda/${(user as any).store.slug}/login`
      : `/tienda/${localStorage.getItem('store_slug') || 'default'}/login`;
    return <Navigate to={loginTarget} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}