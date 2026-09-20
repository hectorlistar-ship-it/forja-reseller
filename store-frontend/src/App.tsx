import { Routes, Route } from 'react-router-dom';
import { PublicCatalog } from './pages/PublicCatalog';
import { LoginRegister } from './pages/LoginRegister';
import { BuyFlow } from './pages/BuyFlow';
import { BinancePayment } from './pages/BinancePayment';
import { MyPurchases } from './pages/MyPurchases';
import { AuthProvider } from './api/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

function StoreHome() {
  return (
    <div style={{ maxWidth: '520px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
      <h2 style={{ marginBottom: '12px' }}>Forja Store</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
        Esta dirección no es la de ninguna tienda. Cada tienda tiene su propio enlace directo que recibes del vendedor,
        por ejemplo: <strong>tu-tienda.forjastore.com</strong>
      </p>
      <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
        Si compraste en una tienda, usa el enlace exacto que te compartió el vendedor. Si todavía no tienes uno, contacta
        al vendedor para recibirlo.
      </p>
    </div>
  );
}

function AppContent() {
  return (
    <Routes>
      <Route path="/tienda/:slug" element={<PublicCatalog />} />
      <Route path="/tienda/:slug/login" element={<LoginRegister />} />
      <Route path="/tienda/:slug/register" element={<LoginRegister />} />
      <Route path="/binance-pago/:paymentId" element={<BinancePayment />} />

      {/* Protected routes */}
      <Route
        path="/tienda/:slug/comprar/:platformKey?"
        element={
          <ProtectedRoute>
            <Layout>
              <BuyFlow />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-compras"
        element={
          <ProtectedRoute>
            <Layout>
              <MyPurchases />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<StoreHome />} />
      <Route path="*" element={<StoreHome />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
