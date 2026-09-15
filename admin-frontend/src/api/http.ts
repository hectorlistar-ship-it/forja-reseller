class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('admin_access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (res.status === 401 && retry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request(endpoint, options, false);
      }
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(err.error || 'Error en la petición');
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem('admin_refresh_token');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${refreshToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('admin_access_token', data.token);
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
