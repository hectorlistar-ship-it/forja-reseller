class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Try to refresh token
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Retry with new token
        return this.request(endpoint, options);
      }
      // If refresh failed, redirect to login
      const storeSlug = localStorage.getItem('store_slug') || 'default';
      localStorage.clear();
      window.location.href = `/tienda/${storeSlug}/login`;
      throw new Error('Sesión expirada');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(err.error || 'Error en la petición');
    }

    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${refreshToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.token);
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

  post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }
}

export const api = new ApiClient();