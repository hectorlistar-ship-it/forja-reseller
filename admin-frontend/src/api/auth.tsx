import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Role = 'reseller' | 'superadmin';

interface AdminUser {
  id: number;
  username?: string;
  plan?: string;
  role: Role;
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  login: (role: Role, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    const token = localStorage.getItem('admin_access_token');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (role: Role, username: string, password: string) => {
    const endpoint = role === 'superadmin' ? '/api/super/login' : '/api/reseller/login';
    const body = role === 'superadmin' ? { password } : { username, password };

    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al iniciar sesión');
    }

    const data = await res.json();
    const adminUser: AdminUser = {
      id: data.user?.id ?? 0,
      username: data.user?.username,
      plan: data.user?.plan,
      role,
    };

    localStorage.setItem('admin_access_token', data.token);
    if (data.refresh_token) localStorage.setItem('admin_refresh_token', data.refresh_token);
    localStorage.setItem('admin_user', JSON.stringify(adminUser));
    setUser(adminUser);
  };

  const logout = () => {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
