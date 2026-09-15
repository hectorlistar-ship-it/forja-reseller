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
    return <div style={{ textAlign: 'center', padding: '60px 20px' }}>ID de pago no válido</div>;
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        {status === 'checking' && (
          <div style={{ width: '80px', height: '80px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1.5s linear infinite', margin: '0 auto 24px' }} />
        )}
        
        {status === 'verified' && (
          <div style={{ color: 'var(--ok)', fontSize: '48px', marginBottom: '16px' }}>✓</div>
        )}
        
        {status === 'failed' && (
          <div style={{ color: 'var(--bad)', fontSize: '48px', marginBottom: '16px' }}>✗</div>
        )}

        <h2 style={{ marginBottom: '8px' }}>{status === 'verified' ? '¡Pago verificado!' : status === 'failed' ? 'Error en verificación' : 'Verificando pago...'}</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>{message}</p>

        {status === 'verified' && (
          <div className="card" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Tu cuenta</h3>
            <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
              Tu cuenta ha sido asignada y está disponible en <Link to="/mis-compras" style={{ color: 'var(--accent)' }}>Mis compras</Link>
            </p>
            <Link to="/mis-compras" className="btn btn-primary" style={{ width: '100%' }}>
              Ver mis compras
            </Link>
          </div>
        )}

        {status === 'checking' && (
          <p style={{ color: 'var(--dim)', fontSize: '13px', marginTop: '16px' }}>
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