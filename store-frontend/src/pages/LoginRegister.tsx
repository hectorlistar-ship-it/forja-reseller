import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/auth';
import { toast } from 'react-hot-toast';

export function LoginRegister() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(slug!, username, password);
      } else {
        await register(slug!, username, password);
      }
      toast.success(isLogin ? '¡Bienvenido!' : '¡Cuenta creada!');
      navigate('/mis-compras');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!slug) {
    return <div style={{ textAlign: 'center', padding: '60px 20px' }}>Tienda no especificada</div>;
  }

  return (
    <div style={{ maxWidth: '400px', margin: '60px auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p style={{ color: 'var(--muted)' }}>Tienda: <strong>{slug}</strong></p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
            Usuario
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
            autoComplete="username"
            placeholder="usuario"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={4}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="contraseña"
          />
        </div>

        {error && (
          <div style={{ color: 'var(--bad)', fontSize: '13px', textAlign: 'center', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px' }}>
          {loading ? 'Cargando...' : (isLogin ? 'Entrar' : 'Crear cuenta')}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--muted)', fontSize: '14px' }}>
        {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'} {' '}
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
        >
          {isLogin ? 'Regístrate' : 'Inicia sesión'}
        </button>
      </p>
    </div>
  );
}

export default LoginRegister;