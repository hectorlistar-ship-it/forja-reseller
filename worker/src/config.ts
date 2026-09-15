// Centralized configuration from environment variables
export interface Env {
  // Bindings
  DB: D1Database;

  // Secrets
  TELEGRAM_BOT_TOKEN: string;
  DASHBOARD_PASSWORD: string;
  BRIDGE_TOKEN: string;
  JWT_SECRET: string;
  GMAIL_USER: string;
  GMAIL_APP_PASSWORD: string;
  ENCRYPTION_KEY: string; // 32 random bytes, base64 - encrypts stored account passwords
  TELEGRAM_ADMIN_CHAT_ID?: string; // chat id that receives sale notifications
  
  // Vars
  ENVIRONMENT: string;
  BOT_NAME: string;
  BUSINESS_NAME: string;
  BOT_LANGUAGE: string;
  BUFFER_SECONDS: string;
}

export function getEnv(c: any): Env {
  return c.env as unknown as Env;
}

export const PLATFORM_DEFAULTS = {
  netflix: { name: 'Netflix', icon: 'tv', cost: 3.5, sale: 7 },
  hbo: { name: 'HBO Max', icon: 'film', cost: 2, sale: 5 },
  disney: { name: 'Disney+', icon: 'sparkles', cost: 2.5, sale: 6 },
  vix: { name: 'Vix', icon: 'tv', cost: 1.5, sale: 4 },
  spotify: { name: 'Spotify Premium', icon: 'music', cost: 1.5, sale: 4 },
  youtube: { name: 'YouTube Premium', icon: 'youtube', cost: 2, sale: 5 },
};

export const PLANS = {
  basic: { name: 'Básico', maxStores: 1, maxAccounts: 1000, price: 0 },
  pro: { name: 'Profesional', maxStores: 3, maxAccounts: 5000, price: 29 },
  enterprise: { name: 'Enterprise', maxStores: 10, maxAccounts: 20000, price: 99 },
};