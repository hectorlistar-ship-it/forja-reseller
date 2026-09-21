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
  delivery_type?: string;
  delivery_note?: string | null;
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
  const [walletTrc20, setWalletTrc20] = useState('');
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        const catalog = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/catalog/${slug}`).then(r => r.json());
        if (catalog.platforms) {
          setPlatforms(catalog.platforms);
          if (catalog.store?.wallet_binance) setWalletAddress(catalog.store.wallet_binance);
          if (catalog.store?.trc20_address) setWalletTrc20(catalog.store.trc20_address);
          if (catalog.store?.business_name) setStoreName(catalog.store.business_name);
          if (platformKey) {
            const preselected = catalog.platforms.find((p: any) => p.key === platformKey);
            if (preselected) {
              setPlatform(preselected);
              setStep('pay');
            }
          }
        }
      } catch {
        // Ignore
      }
    }
    loadData();
  }, [slug, platformKey]);

  const handlePlatformSelect = (p: any) => {
    if (p.delivery_type !== 'manual' && p.stock <= 0) {
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
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to={`/tienda/${slug}`} style={{ color: 'rgb(var(--ring-strong))', textDecoration: 'none', fontSize: 14 }}>← Volver al catálogo</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500, marginTop: 12, marginBottom: 4 }}>
          {platform?.delivery_type === 'manual' ? 'Comprar producto' : 'Comprar cuenta'}
        </h1>
        <p style={{ color: 'rgb(var(--muted))' }}>
          {platform?.delivery_type === 'manual'
            ? 'Paga con USDT y el vendedor activará tu producto'
            : 'Paga con USDT y recibe tu cuenta al instante'}
        </p>
      </div>

      {step === 'select' && platforms.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 16, fontSize: 18, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>Selecciona plataforma</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {platforms
              .filter((p: any) => p.delivery_type === 'manual' || p.stock > 0)
              .map((p: any) => (
                <button
                  key={p.key}
                  onClick={() => handlePlatformSelect(p)}
                  className="shadow-ring-1"
                  style={{
                    textAlign: 'left',
                    padding: 16,
                    background: 'rgb(var(--surface))',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ color: 'rgb(var(--muted))', fontSize: 13 }}>
                    ${p.price_usd} USDT · {p.delivery_type === 'manual' ? 'entrega manual' : `${p.stock} disponibles`}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {step === 'pay' && platform && (
        <div>
          <h2 style={{ marginBottom: 16, fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500 }}>Paso 1: Paga en Binance</h2>

          <div className="card shadow-ring-1" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Detalles de la compra</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{platform.name}</span>
              <strong style={{ color: 'rgb(var(--gold))', fontSize: 22 }}>${platform.price_usd} USDT</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgb(var(--muted))', fontSize: 14 }}>
              <span>Tu usuario Binance</span>
              <strong>@{binanceUser || '—'}</strong>
            </div>
          </div>

          {platform.delivery_type === 'manual' && (
            <div className="card shadow-ring-1" style={{ marginBottom: 20, background: 'rgb(var(--gold) / 0.1)', border: '1px solid rgb(var(--gold) / 0.35)' }}>
              <h3 style={{ marginBottom: 8, fontSize: 15 }}>🕒 Entrega manual</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'rgb(var(--muted))' }}>
                Este producto lo activa el vendedor después de confirmar tu pago.
                {platform.delivery_note ? ` ${platform.delivery_note}` : ''}
              </p>
            </div>
          )}

          <div className="card shadow-ring-1" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Wallet de pago {storeName && `— ${storeName}`}</h3>
            {walletAddress && <>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, background: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: walletTrc20 ? 8 : 0 }}>
                <span>{walletAddress}</span>
                <button onClick={() => navigator.clipboard.writeText(walletAddress || '')} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>Copiar</button>
              </div>
              {walletTrc20 && (
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, background: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{walletTrc20}</span>
                  <button onClick={() => navigator.clipboard.writeText(walletTrc20 || '')} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>Copiar</button>
                </div>
              )}
            </>}
            {!walletAddress && <p style={{ fontSize: 13, color: 'rgb(var(--subtle))' }}>El vendedor aún no configura su billetera. Contacta al soporte.</p>}
            <p style={{ marginTop: 8, fontSize: 12, color: 'rgb(var(--subtle))' }}>
              Envía exactamente <strong>${platform.price_usd} USDT</strong> a {walletTrc20 ? 'cualquiera de estas cuentas (UID Binance o TRC20 Fiat)' : 'esta wallet (UID de Binance)'} desde tu cuenta Binance.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'rgb(var(--muted))' }}>
              Tu usuario de Binance (ej: @juan123)
            </label>
            <input
              type="text"
              value={binanceUser}
              onChange={e => setBinanceUser(e.target.value)}
              placeholder="@tuusuario"
              required
              style={{ width: '100%', padding: 12 }}
            />
          </div>

          <button onClick={handleBuy} disabled={loading || !binanceUser.trim()} className="btn btn-primary" style={{ width: '100%', padding: 14 }}>
            {loading ? 'Procesando...' : 'He pagado, verificar pago'}
          </button>
        </div>
      )}

      {step === 'verify' && paymentId && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <h2 style={{ marginBottom: 12, fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24 }}>Confirma tu pago</h2>
          <p style={{ color: 'rgb(var(--muted))', marginBottom: 24 }}>
            Cuando termines de pagar en Binance, verifica el estado de tu compra.
          </p>
          <button onClick={() => navigate(`/binance-pago/${paymentId}`)} className="btn btn-primary" style={{ width: '100%', padding: 14, marginBottom: 12 }}>
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
