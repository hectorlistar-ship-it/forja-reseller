import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicCatalog } from './pages/PublicCatalog';
import { LoginRegister } from './pages/LoginRegister';
import { BuyFlow } from './pages/BuyFlow';
import { BinancePayment } from './pages/BinancePayment';
import { MyPurchases } from './pages/MyPurchases';
import { AuthProvider } from './api/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

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

      <Route path="/" element={<Navigate to="/tienda/default" replace />} />
      <Route path="*" element={<Navigate to="/tienda/default" replace />} />
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
