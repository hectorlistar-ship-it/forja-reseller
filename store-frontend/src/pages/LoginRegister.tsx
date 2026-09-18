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
    <div style={{ maxWidth: 420, margin: '80px auto 40px', padding: '0 20px' }}>
      <div className="shadow-ring-1 card" style={{ padding: '36px 32px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, margin: '0 auto 16px', borderRadius: 14, background: 'linear-gradient(135deg, rgb(var(--ring-strong)), rgb(var(--gold)))', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, color: '#0a0a12', fontFamily: 'var(--font-serif)', boxShadow: '0 0 26px rgb(var(--brand) / 0.4)' }}>
            {slug.charAt(0).toUpperCase()}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-serif)', margin: '0 0 6px' }}>
            {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p style={{ color: 'rgb(var(--muted))', fontSize: 14, margin: 0 }}>
            {isLogin ? 'Tu cuentas y pedidos en un solo lugar' : 'Únete y activa el pago con USDT'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgb(var(--muted))' }}>
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
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgb(var(--muted))' }}>
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
              style={{ width: '100%' }}
            />
          </div>

          {error && (
            <div style={{ color: 'rgb(var(--bad))', fontSize: 13, textAlign: 'center', padding: '10px', background: 'rgb(var(--bad) / 0.1)', borderRadius: 10, border: '1px solid rgb(var(--bad) / 0.25)' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px' }}>
            {loading ? 'Cargando...' : (isLogin ? 'Entrar' : 'Crear cuenta')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'rgb(var(--muted))', fontSize: 14 }}>
          {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'} {' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: 'rgb(var(--ring-strong))', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
          >
            {isLogin ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginRegister;