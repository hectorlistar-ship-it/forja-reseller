import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './config';
import { PLANS } from './config';
import { createDb } from './db/client';
import * as queries from './db/queries';
import {
  createAuthMiddleware,
  requireSuperAdmin,
  requireReseller,
  optionalAuth,
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  extractToken,
  verifyToken,
} from './auth';
import storeRoutes from './store/routes';
import { botRoutes } from './bot/routes';
import { binanceRoutes } from './binance/routes';

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  // NOTE: credentials:true only makes sense with cookie-based auth, and
  // browsers reject it when combined with origin:'*'. This API is Bearer
  // token only, so it's neither needed nor safe to enable.
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'forja-reseller', timestamp: Date.now() }));

function clientIp(c: any): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}

// ============================================
// PUBLIC API (no auth required)
// ============================================

// Public catalog for store
app.get('/api/public/catalog/:slug', async (c) => {
  const db = createDb(c.env);
  const slug = c.req.param('slug');

  const store = await queries.getStoreBySlug(db, slug);
  if (!store || store.status !== 'active') {
    return c.json({ error: 'Tienda no encontrada' }, 404);
  }

  const platforms = await queries.getStorePlatforms(db, store.id);
  const inventory = await queries.getInventorySummary(db, store.id);

  const catalog = platforms.map(p => {
    const inv = inventory.find(i => i.platform_key === p.platform_key);
    return {
      key: p.platform_key,
      name: p.name,
      type: p.type,
      icon: p.icon,
      image_url: p.image_url,
      price_usd: p.sale_price_usd,
      stock: inv?.available ?? 0,
    };
  }).filter(p => p.stock > 0);

  return c.json({
    store: { slug: store.slug, name: store.name },
    platforms: catalog,
  });
});

// Public payment info
app.get('/api/public/payment-info', async (c) => {
  const db = createDb(c.env);
  const wallet = await queries.getGlobalSetting(db, 'binance_wallet');
  const rate = await queries.getGlobalSetting(db, 'credit_rate_usdt');

  return c.json({
    wallet: wallet?.value || 'CONFIGURAR_WALLET',
    rate: Number(rate?.value || '1'),
    packages: [
      { usdt: 5, label: '5 USDT' },
      { usdt: 10, label: '10 USDT' },
      { usdt: 20, label: '20 USDT' },
      { usdt: 50, label: '50 USDT' },
    ],
  });
});

// Public register
app.post('/api/public/register/:slug', async (c) => {
  const db = createDb(c.env);
  const slug = c.req.param('slug');

  const rate = await queries.checkRateLimit(db, `register:${slug}:${clientIp(c)}`, 5, 60_000);
  if (!rate.allowed) {
    return c.json({ error: 'Demasiados intentos, espera un momento' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password || username.length < 3 || password.length < 6) {
    return c.json({ error: 'Usuario (min 3) y contraseña (min 6) requeridos' }, 400);
  }

  const store = await queries.getStoreBySlug(db, slug);
  if (!store || store.status !== 'active') {
    return c.json({ error: 'Tienda no encontrada' }, 404);
  }

  const clientCount = await db.first<{ c: number }>(
    `SELECT COUNT(*) as c FROM clients WHERE store_id = ?`, [store.id]
  );
  if ((clientCount?.c ?? 0) >= 10000) {
    return c.json({ error: 'Límite de clientes alcanzado' }, 400);
  }

  const existing = await queries.getClientByUsername(db, store.id, username);
  if (existing) {
    return c.json({ error: 'El usuario ya existe' }, 409);
  }

  const passwordHash = await hashPassword(password);
  await queries.createClient(db, {
    storeId: store.id,
    username,
    passwordHash,
  });

  return c.json({ message: 'Registro exitoso' }, 201);
});

// Public login (client)
app.post('/api/public/login/:slug', async (c) => {
  const db = createDb(c.env);
  const slug = c.req.param('slug');

  const rate = await queries.checkRateLimit(db, `login:${slug}:${clientIp(c)}`, 10, 60_000);
  if (!rate.allowed) {
    return c.json({ error: 'Demasiados intentos, espera un momento' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: 'Usuario y contraseña requeridos' }, 400);
  }

  const store = await queries.getStoreBySlug(db, slug);
  if (!store || store.status !== 'active') {
    return c.json({ error: 'Tienda no encontrada' }, 404);
  }

  const client = await queries.getClientByUsername(db, store.id, username);
  if (!client || client.status !== 'active') {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const valid = await verifyPassword(password, client.password_hash);
  if (!valid) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const access = await createAccessToken(c.env, { userId: client.id, type: 'client', storeId: store.id });
  const refresh = await createRefreshToken(c.env, { userId: client.id, type: 'client', storeId: store.id });

  await queries.updateClientLogin(db, client.id);

  return c.json({
    token: access.token,
    refresh_token: refresh.token,
    user: {
      id: client.id,
      username: client.username,
      store: { slug: store.slug, name: store.name },
    },
  });
});

// Reseller login
app.post('/api/reseller/login', async (c) => {
  const db = createDb(c.env);
  const rate = await queries.checkRateLimit(db, `reseller-login:${clientIp(c)}`, 10, 60_000);
  if (!rate.allowed) {
    return c.json({ error: 'Demasiados intentos, espera un momento' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: 'Usuario y contraseña requeridos' }, 400);
  }

  const reseller = await queries.getResellerByUsername(db, username);
  if (!reseller || reseller.status !== 'active') {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const valid = await verifyPassword(password, reseller.password_hash);
  if (!valid) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const access = await createAccessToken(c.env, { userId: reseller.id, type: 'reseller' });
  const refresh = await createRefreshToken(c.env, { userId: reseller.id, type: 'reseller' });
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await queries.createSession(db, { id: refresh.jti, userType: 'reseller', userId: reseller.id, expiresAt });

  return c.json({
    token: access.token,
    refresh_token: refresh.token,
    user: { id: reseller.id, username: reseller.username, plan: reseller.plan },
  });
});

// SuperAdmin login (single shared password, since there's no superadmin table)
app.post('/api/super/login', async (c) => {
  const db = createDb(c.env);
  const rate = await queries.checkRateLimit(db, `super-login:${clientIp(c)}`, 5, 60_000);
  if (!rate.allowed) {
    return c.json({ error: 'Demasiados intentos, espera un momento' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const { password } = body;
  if (!password || !c.env.DASHBOARD_PASSWORD || password !== c.env.DASHBOARD_PASSWORD) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const access = await createAccessToken(c.env, { userId: 0, type: 'superadmin' });
  const refresh = await createRefreshToken(c.env, { userId: 0, type: 'superadmin' });
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await queries.createSession(db, { id: refresh.jti, userType: 'superadmin', userId: 0, expiresAt });

  return c.json({ token: access.token, refresh_token: refresh.token });
});

// Logout (revokes the refresh session so the token can't be refreshed again)
app.post('/api/logout', optionalAuth(), async (c) => {
  const user = c.get('user');
  const db = createDb(c.env);
  if (user?.jti) {
    await queries.revokeSession(db, user.jti);
  }
  return c.json({ message: 'Sesión cerrada' });
});

// Token refresh
app.post('/api/public/refresh', optionalAuth(), async (c) => {
  const refreshToken = extractToken(c.req.header('Authorization'));
  if (!refreshToken) {
    return c.json({ error: 'Refresh token requerido' }, 401);
  }

  const payload = await verifyToken(c.env, refreshToken);
  if (!payload) {
    return c.json({ error: 'Refresh token inválido' }, 401);
  }

  const db = createDb(c.env);

  if (payload.type !== 'client') {
    const session = await queries.getSession(db, payload.jti);
    if (!session) {
      return c.json({ error: 'Sesión revocada o expirada' }, 401);
    }
  }

  if (payload.type === 'client') {
    const client = await queries.getClientById(db, Number(payload.sub));
    if (!client || client.status !== 'active') {
      return c.json({ error: 'Cliente no encontrado' }, 401);
    }
    const store = await queries.getStoreById(db, payload.storeId!);
    if (!store || store.status !== 'active') {
      return c.json({ error: 'Tienda no disponible' }, 401);
    }
    const access = await createAccessToken(c.env, { userId: client.id, type: 'client', storeId: store.id });
    return c.json({ token: access.token });
  }

  // reseller / superadmin: session was already checked above, just re-mint
  const access = await createAccessToken(c.env, {
    userId: Number(payload.sub),
    type: payload.type,
    storeId: payload.storeId,
    resellerId: payload.resellerId,
  });
  return c.json({ token: access.token });
});

// ============================================
// SUPERADMIN ROUTES (require superadmin)
// ============================================

const superAdminAuth = [createAuthMiddleware(), requireSuperAdmin()];

app.get('/api/super/stats', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const stats = await queries.getSuperAdminStats(db);
  return c.json(stats);
});

app.get('/api/super/resellers', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const resellers = await queries.listResellers(db);
  return c.json({ resellers });
});

app.post('/api/super/resellers', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.json();

  const { username, password, plan, max_stores } = body;
  if (!username || !password) {
    return c.json({ error: 'username y password requeridos' }, 400);
  }

  const existing = await queries.getResellerByUsername(db, username);
  if (existing) {
    return c.json({ error: 'El reseller ya existe' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const result = await queries.createReseller(db, {
    username,
    passwordHash,
    plan: plan || 'basic',
    maxStores: max_stores || 1,
  });

  return c.json({ message: 'Reseller creado', id: result.meta.last_row_id }, 201);
});

app.put('/api/super/resellers/:id', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();

  const data: any = {};
  if (body.password) data.passwordHash = await hashPassword(body.password);
  if (body.plan) data.plan = body.plan;
  if (body.max_stores) data.maxStores = body.max_stores;
  if (body.status) data.status = body.status;

  await queries.updateReseller(db, id, data);
  return c.json({ message: 'Reseller actualizado' });
});

app.delete('/api/super/resellers/:id', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const id = Number(c.req.param('id'));
  await queries.updateReseller(db, id, { status: 'suspended' });
  return c.json({ message: 'Reseller suspendido' });
});

// Platforms management (SuperAdmin)
app.get('/api/super/platforms', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const platforms = await queries.listPlatforms(db, false);
  return c.json({ platforms });
});

app.post('/api/super/platforms', ...superAdminAuth, async (c) => {
  const db = createDb(c.env);
  const body = await c.req.json();
  await queries.upsertPlatform(db, {
    key: body.key,
    name: body.name,
    type: body.type,
    icon: body.icon,
    imageUrl: body.image_url,
    costPrice: body.cost_price,
    salePrice: body.sale_price,
    isActive: body.is_active ?? 1,
    sortOrder: body.sort_order ?? 0,
  });
  return c.json({ message: 'Plataforma guardada' });
});

// ============================================
// RESELLER ADMIN ROUTES (require reseller)
// ============================================

const resellerAuth = [createAuthMiddleware(), requireReseller()];

// Helper: does this store belong to the authenticated reseller?
// (superadmin bypasses the check)
async function assertStoreOwnership(db: ReturnType<typeof createDb>, storeId: number, user: any): Promise<boolean> {
  if (user.type === 'superadmin') return true;
  const store = await queries.getStoreById(db, storeId) as { reseller_id: number } | null;
  return !!store && store.reseller_id === user.userId;
}

// Resolves & authorizes the store_id for reseller/superadmin endpoints that
// operate on a single store. Resellers can own multiple stores, so the
// store is always chosen explicitly via ?store_id=, never inferred from
// the token - ownership is checked here. Returns a Response to send
// as-is when resolution fails, or the numeric storeId when it succeeds.
async function resolveStoreId(c: any, db: ReturnType<typeof createDb>, user: any): Promise<number | Response> {
  const storeId = Number(c.req.query('store_id'));
  if (!storeId) {
    return c.json({ error: 'store_id requerido' }, 400);
  }
  const owns = await assertStoreOwnership(db, storeId, user);
  if (!owns) {
    return c.json({ error: 'No tienes acceso a esta tienda' }, 403);
  }
  return storeId;
}

// Store management
app.get('/api/admin/stores', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const resellerId = user.type === 'superadmin' ?
    (c.req.query('reseller_id') ? Number(c.req.query('reseller_id')) : 0) :
    user.userId;

  if (!resellerId) return c.json({ stores: [] });

  const stores = await queries.getStoresByReseller(db, resellerId);
  return c.json({ stores });
});

app.post('/api/admin/stores', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const resellerId = user.type === 'superadmin' ? Number(c.req.query('reseller_id')) : user.userId;

  const body = await c.req.json();
  const { slug, name, wallet_binance } = body;

  if (!slug || !name) {
    return c.json({ error: 'slug y name requeridos' }, 400);
  }

  const existing = await queries.getStoreBySlug(db, slug);
  if (existing) {
    return c.json({ error: 'El slug ya existe' }, 409);
  }

  // Enforce plan limits (superadmin bypasses)
  if (user.type !== 'superadmin') {
    const reseller = await queries.getResellerById(db, resellerId) as { max_stores: number } | null;
    if (reseller) {
      const currentCount = await queries.countStoresByReseller(db, resellerId);
      if (currentCount >= reseller.max_stores) {
        return c.json({ error: `Límite de tiendas alcanzado para tu plan (${reseller.max_stores})` }, 403);
      }
    }
  }

  const result = await queries.createStore(db, {
    resellerId,
    slug,
    name,
    walletBinance: wallet_binance,
  });

  return c.json({ message: 'Tienda creada', id: result.meta.last_row_id }, 201);
});

app.put('/api/admin/stores/:id', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const id = Number(c.req.param('id'));

  const owns = await assertStoreOwnership(db, id, user);
  if (!owns) {
    return c.json({ error: 'No tienes acceso a esta tienda' }, 403);
  }

  const body = await c.req.json();

  await queries.updateStore(db, id, {
    name: body.name,
    walletBinance: body.wallet_binance,
    configJson: body.config_json ? JSON.stringify(body.config_json) : undefined,
    status: body.status,
  });

  return c.json({ message: 'Tienda actualizada' });
});

// Inventory
app.get('/api/admin/inventory', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const summary = await queries.getInventorySummary(db, storeId);
  const platforms = await queries.getStorePlatforms(db, storeId);

  const platformsWithStock = platforms.map(p => {
    const inv = summary.find(s => s.platform_key === p.platform_key);
    return {
      ...p,
      stock: inv?.available ?? 0,
      sold: inv?.sold ?? 0,
    };
  });

  return c.json({ platforms: platformsWithStock });
});

app.post('/api/admin/inventory/add', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const body = await c.req.json();
  const { cuentas, plataforma } = body;

  if (!cuentas || !Array.isArray(cuentas) || !plataforma) {
    return c.json({ error: 'cuentas (array) y plataforma requeridos' }, 400);
  }

  if (user.type !== 'superadmin') {
    const store = await queries.getStoreById(db, storeId) as { reseller_id: number } | null;
    if (store) {
      const reseller = await queries.getResellerById(db, store.reseller_id) as { max_accounts_per_store: number } | null;
      if (reseller) {
        const currentCount = await queries.countAccountsByStore(db, storeId);
        if (currentCount + cuentas.length > reseller.max_accounts_per_store) {
          return c.json({ error: `Límite de cuentas por tienda alcanzado para tu plan (${reseller.max_accounts_per_store})` }, 403);
        }
      }
    }
  }

  const result = await queries.addAccounts(db, c.env, storeId, plataforma, cuentas);
  return c.json({ message: `${result.added} cuentas agregadas`, added: result.added });
});

// Orders
app.get('/api/admin/orders', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;
  const limit = Number(c.req.query('limit')) || 100;

  const orders = await queries.getOrdersByStore(db, storeId, limit);
  return c.json({ orders });
});

// Clients
app.get('/api/admin/clients', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const clients = await queries.getClientsByStore(db, storeId);
  return c.json({ clients });
});

app.post('/api/admin/clients', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const body = await c.req.json();
  const { nombre, password } = body;

  if (!nombre) return c.json({ error: 'nombre requerido' }, 400);

  const existing = await queries.getClientByUsername(db, storeId, nombre);
  if (existing) return c.json({ error: 'El cliente ya existe' }, 409);

  const plainPassword = password || generateReadablePassword();
  const passwordHash = await hashPassword(plainPassword);
  await queries.createClient(db, { storeId, username: nombre, passwordHash });

  return c.json({ message: `Cliente ${nombre} creado`, password: plainPassword }, 201);
});

function generateReadablePassword(): string {
  // Short, typeable default password instead of reusing the username
  // (which would be guessable by anyone who knows the client's username).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

// Binance payments
app.get('/api/admin/payments', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const payments = await queries.getPendingPayments(db, storeId);
  return c.json({ payments });
});

// Platforms with prices
app.get('/api/admin/plataformas', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const platforms = await queries.getStorePlatforms(db, storeId);
  return c.json({ plataformas: platforms });
});

// Store stats
app.get('/api/admin/stats', ...resellerAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = await resolveStoreId(c, db, user);
  if (typeof storeId !== 'number') return storeId;

  const stats = await queries.getStoreStats(db, storeId);
  return c.json(stats);
});

// ============================================
// STORE ROUTES (client authenticated)
// ============================================

app.route('/api/store', storeRoutes);

// ============================================
// BOT ROUTES
// ============================================

app.route('/webhooks', botRoutes);

// ============================================
// BINANCE BRIDGE CALLBACK
// ============================================

app.route('/api/binance', binanceRoutes);

// ============================================
// 404
// ============================================

app.notFound((c) => c.json({ error: 'No encontrado' }, 404));

// ============================================
// ERROR HANDLER
// ============================================

app.onError((err, c) => {
  console.error('[Error]', err);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

export default app;
