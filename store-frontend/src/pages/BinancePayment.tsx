import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

export function BinancePayment() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [status, setStatus] = useState<'checking' | 'verified' | 'failed'>('checking');
  const [message, setMessage] = useState('Verificando tu pago...');

  useEffect(() => {
    async function checkPayment() {
      if (!paymentId) return;
      
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/store/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ payment_id: paymentId }),
        });
        
        const data = await res.json();
        
        if (data.status === 'verified') {
          setStatus('verified');
          setMessage('¡Pago verificado! Tu cuenta ha sido asignada.');
          // We would need to fetch the order details here
        } else {
          setStatus('checking');
          setMessage('Pago pendiente de verificación. El sistema revisa automáticamente cada 2 minutos.');
          // Poll again in 30 seconds
          setTimeout(checkPayment, 30000);
        }
      } catch (err) {
        setStatus('failed');
        setMessage('Error al verificar el pago. Intenta más tarde.');
      }
    }
    
    if (paymentId) checkPayment();
  }, [paymentId]);

  if (!paymentId) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgb(var(--muted))' }}>ID de pago no válido</div>;
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '24px 20px' }}>
      <div className="card shadow-ring-1" style={{ textAlign: 'center', padding: '44px 28px', borderRadius: 'var(--radius-lg)' }}>
        {status === 'checking' && (
          <div style={{ width: '72px', height: '72px', border: '3px solid rgb(var(--ring-strong))', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1.5s linear infinite', margin: '0 auto 24px', boxShadow: '0 0 24px rgb(var(--brand) / 0.35)' }} />
        )}

        {status === 'verified' && (
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 18px',
            borderRadius: 50,
            background: 'rgb(var(--ok) / 0.15)',
            border: '1px solid rgb(var(--ok) / 0.4)',
            color: 'rgb(var(--ok))',
            fontSize: '34px',
            display: 'grid',
            placeItems: 'center',
          }}>✓</div>
        )}

        {status === 'failed' && (
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 18px',
            borderRadius: 50,
            background: 'rgb(var(--bad) / 0.15)',
            border: '1px solid rgb(var(--bad) / 0.4)',
            color: 'rgb(var(--bad))',
            fontSize: '34px',
            display: 'grid',
            placeItems: 'center',
          }}>✗</div>
        )}

        <h2 style={{ marginBottom: '8px', fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22 }}>{status === 'verified' ? '¡Pago verificado!' : status === 'failed' ? 'Error en verificación' : 'Verificando pago...'}</h2>
        <p style={{ color: 'rgb(var(--muted))', marginBottom: '24px' }}>{message}</p>

        {status === 'verified' && (
          <div className="card" style={{ textAlign: 'left', marginBottom: '24px', background: 'rgb(var(--surface-2))' }}>
            <h3 style={{ marginBottom: '12px', fontSize: 15 }}>Tu cuenta</h3>
            <p style={{ color: 'rgb(var(--muted))', marginBottom: '16px' }}>
              Tu cuenta ha sido asignada y está disponible en <Link to="/mis-compras" style={{ color: 'rgb(var(--ring-strong))' }}>Mis compras</Link>
            </p>
            <Link to="/mis-compras" className="btn btn-primary" style={{ width: '100%' }}>
              Ver mis compras
            </Link>
          </div>
        )}

        {status === 'checking' && (
          <p style={{ color: 'rgb(var(--subtle))', fontSize: '13px', marginTop: '16px' }}>
            Revisando automáticamente cada 30 segundos...
          </p>
        )}

        {status === 'failed' && (
          <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

export default BinancePayment;