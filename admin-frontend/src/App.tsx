import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { ResellerDashboard } from './pages/ResellerDashboard';
import { SuperDashboard } from './pages/SuperDashboard';
import { AuthProvider } from './api/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <ResellerDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/super"
        element={
          <ProtectedRoute role="superadmin">
            <Layout>
              <SuperDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
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
