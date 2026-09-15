import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/http';
import { toast } from 'react-hot-toast';

interface Platform {
  key: string;
  name: string;
  type: string;
  icon: string;
  price_usd: number;
  stock: number;
}

export function BuyFlow() {
  const { slug, platformKey } = useParams<{ slug: string; platformKey?: string }>();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [binanceUser, setBinanceUser] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'pay' | 'verify'>('select');
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        const catalog = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/catalog/${slug}`).then(r => r.json());
        if (catalog.platforms) {
          setPlatforms(catalog.platforms);
          if (platformKey) {
            const preselected = catalog.platforms.find((p: any) => p.key === platformKey);
            if (preselected) {
              setPlatform(preselected);
              setStep('pay');
            }
          }
        }

        const paymentInfo = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/payment-info`).then(r => r.json());
        setWalletAddress(paymentInfo.wallet || 'CONFIGURAR_WALLET');
      } catch {
        // Ignore
      }
    }
    loadData();
  }, [slug, platformKey]);

  const handlePlatformSelect = (p: any) => {
    if (p.stock <= 0) {
      toast.error('Sin stock disponible');
      return;
    }
    setPlatform(p);
    setStep('pay');
  };

  const handleBuy = async () => {
    if (!platform || !binanceUser.trim()) {
      toast.error('Completa tu usuario de Binance');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post<any>('/api/store/buy', {
        platform_key: platform.key,
        binance_user: binanceUser.trim(),
      });

      setPaymentId(data.payment_id);
      setStep('verify');
      toast.success('Compra iniciada. Completa el pago en Binance.');
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar compra');
    } finally {
      setLoading(false);
    }
  };

  if (!slug) return <div style={{ textAlign: 'center', padding: '60px 20px' }}>Tienda no especificada</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link to={`/tienda/${slug}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '14px' }}>← Volver al catálogo</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', marginBottom: '4px' }}>Comprar cuenta</h1>
        <p style={{ color: 'var(--muted)' }}>Paga con USDT y recibe tu cuenta al instante</p>
      </div>

      {step === 'select' && platforms.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Selecciona plataforma</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {platforms
              .filter((p: any) => p.stock > 0)
              .map((p: any) => (
                <button
                  key={p.key}
                  onClick={() => handlePlatformSelect(p)}
                  style={{
                    textAlign: 'left',
                    padding: '16px',
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>${p.price_usd} USDT · {p.stock} disponibles</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {step === 'pay' && platform && (
        <div>
          <h2 style={{ marginBottom: '16px' }}>Paso 1: Paga en Binance</h2>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '12px' }}>Detalles de la compra</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{platform.name}</span>
              <strong style={{ color: 'var(--accent)', fontSize: '20px' }}>${platform.price_usd} USDT</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '14px' }}>
              <span>Tu usuario Binance</span>
              <strong>@{binanceUser || '—'}</strong>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '12px' }}>Wallet de pago</h3>
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '14px',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>{walletAddress || 'CONFIGURAR_WALLET'}</span>
              <button onClick={() => navigator.clipboard.writeText(walletAddress || '')} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }}>
                Copiar
              </button>
            </div>
            <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--dim)' }}>
              Envía exactamente <strong>${platform.price_usd} USDT</strong> a esta wallet desde tu cuenta Binance.
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--muted)' }}>
              Tu usuario de Binance (ej: @juan123)
            </label>
            <input
              type="text"
              value={binanceUser}
              onChange={e => setBinanceUser(e.target.value)}
              placeholder="@tuusuario"
              required
              style={{ width: '100%', padding: '12px' }}
            />
          </div>

          <button onClick={handleBuy} disabled={loading || !binanceUser.trim()} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
            {loading ? 'Procesando...' : 'He pagado, verificar pago'}
          </button>
        </div>
      )}

      {step === 'verify' && paymentId && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 style={{ marginBottom: '12px' }}>Confirma tu pago</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
            Cuando termines de pagar en Binance, verifica el estado de tu compra.
          </p>
          <button onClick={() => navigate(`/binance-pago/${paymentId}`)} className="btn btn-primary" style={{ width: '100%', padding: '14px', marginBottom: '12px' }}>
            Verificar pago
          </button>
          <button onClick={() => { setStep('pay'); setPaymentId(null); }} className="btn btn-ghost">
            Volver
          </button>
        </div>
      )}
    </div>
  );
}

export default BuyFlow;
