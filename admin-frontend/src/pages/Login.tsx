import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, Role } from '../api/auth';
import { toast } from 'react-hot-toast';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<Role>('reseller');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(role, username, password);
      toast.success('¡Bienvenido!');
      navigate(role === 'superadmin' ? '/super' : '/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '380px', margin: '80px auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Panel Forja Reseller</h1>
        <p style={{ color: 'var(--muted)' }}>Acceso de administración</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setRole('reseller')}
          className={role === 'reseller' ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ flex: 1, padding: '10px' }}
        >
          Reseller
        </button>
        <button
          type="button"
          onClick={() => setRole('superadmin')}
          className={role === 'superadmin' ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ flex: 1, padding: '10px' }}
        >
          SuperAdmin
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {role === 'reseller' && (
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="usuario"
              style={{ width: '100%', padding: '12px' }}
            />
          </div>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="contraseña"
            style={{ width: '100%', padding: '12px' }}
          />
        </div>

        {error && (
          <div style={{ color: 'var(--bad)', fontSize: '13px', textAlign: 'center', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px' }}>
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
