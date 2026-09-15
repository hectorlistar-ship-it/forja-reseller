import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  id: number;
  username: string;
  store: { slug: string; name: string };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (slug: string, username: string, password: string) => Promise<void>;
  register: (slug: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState(true);

  const refreshToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${refreshToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.token);
        return data.token;
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } catch {
      // Ignore
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      // We need to know the slug to fetch user info
      // For now, we'll store user info in localStorage at login
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (slug: string, username: string, password: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/login/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al iniciar sesión');
    }
    
    const data = await res.json();
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.user?.store?.slug) localStorage.setItem('store_slug', data.user.store.slug);
    
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (slug: string, username: string, password: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/register/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al registrarse');
    }
    
    // Auto-login after registration
    await login(slug, username, password);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}