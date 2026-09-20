import { Db } from './client';
import { encryptSecret, decryptSecret } from '../crypto';
import type { Env } from '../config';

// ============================================
// RESELLERS
// ============================================

export async function createReseller(db: Db, data: {
  username: string;
  passwordHash: string;
  plan?: string;
  maxStores?: number;
}) {
  return db.run(
    `INSERT INTO resellers (username, password_hash, plan, max_stores) VALUES (?, ?, ?, ?)`,
    [data.username, data.passwordHash, data.plan || 'basic', data.maxStores || 1]
  );
}

export async function getResellerByUsername(db: Db, username: string) {
  return db.first<{ id: number; username: string; password_hash: string; plan: string; max_stores: number; status: string }>(
    `SELECT * FROM resellers WHERE username = ?`,
    [username.toLowerCase()]
  );
}

export async function getResellerById(db: Db, id: number) {
  return db.first(`SELECT * FROM resellers WHERE id = ?`, [id]);
}

export async function listResellers(db: Db, status?: string) {
  let sql = `SELECT * FROM resellers`;
  const params: any[] = [];
  if (status) {
    sql += ` WHERE status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC`;
  return db.all(sql, params);
}

export async function updateReseller(db: Db, id: number, data: Partial<{
  passwordHash: string;
  plan: string;
  maxStores: number;
  status: string;
}>) {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.passwordHash) { fields.push('password_hash = ?'); values.push(data.passwordHash); }
  if (data.plan) { fields.push('plan = ?'); values.push(data.plan); }
  if (data.maxStores) { fields.push('max_stores = ?'); values.push(data.maxStores); }
  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  
  if (fields.length === 0) return { success: true, meta: { changes: 0 } };
  
  fields.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));
  values.push(id);
  
  return db.run(`UPDATE resellers SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ============================================
// STORES
// ============================================

export async function createStore(db: Db, data: {
  resellerId: number;
  slug: string;
  name: string;
  walletBinance?: string;
}) {
  return db.run(
    `INSERT INTO stores (reseller_id, slug, name, wallet_binance) VALUES (?, ?, ?, ?)`,
    [data.resellerId, data.slug, data.name, data.walletBinance || null]
  );
}

// Slugs storable en DB (minúsculas, sin acentos).
export function slugify(input: string): string {
  const normalized = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'producto';
}

// Agrega un producto a la tienda del vendedor. Si la plataforma aún no existe
// en el catálogo global (key), se crea como propia del vendedor (owner_store_id).
// Si ya existe globalmente (netflix, etc.) o es propia del mismo dueño, la reutiliza.
export async function addStoreProduct(db: Db, store: { id: number; slug: string }, data: {
  name: string;
  type: string;
  costPrice?: number;
  salePrice?: number;
  imageUrl?: string;
  icon?: string;
}): Promise<{ platformKey: string; created: boolean }> {
  let baseKey = slugify(data.name);
  let platformKey = baseKey;

  // Buscar si ya existe global o del mismo vendedor
  let existing = await db.first<any>(`SELECT * FROM platforms WHERE key = ?`, [platformKey]);
  if (existing && existing.owner_store_id !== null && existing.owner_store_id !== store.id) {
    platformKey = `${baseKey}-${store.slug}`;
    existing = await db.first<any>(`SELECT * FROM platforms WHERE key = ?`, [platformKey]);
  }

  let created = false;
  if (!existing) {
    await db.run(
      `INSERT INTO platforms (key, name, type, icon, image_url, cost_price_usd, sale_price_usd, is_active, sort_order, owner_store_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 9999, ?)`,
      [platformKey, data.name, data.type || 'producto', data.icon || null, data.imageUrl || null,
       data.costPrice ?? 0, data.salePrice ?? 0, store.id]
    );
    created = true;
  }

  await db.run(
    `INSERT INTO store_platforms (store_id, platform_key, cost_price_usd, sale_price_usd, is_active, promo_image_url)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(store_id, platform_key) DO UPDATE SET
       cost_price_usd = excluded.cost_price_usd,
       sale_price_usd = excluded.sale_price_usd,
       is_active = 1`,
    [store.id, platformKey, data.costPrice ?? null, data.salePrice ?? null, data.imageUrl || null]
  );

  return { platformKey, created };
}

export async function getStoreBySlug(db: Db, slug: string) {
  return db.first(`SELECT * FROM stores WHERE slug = ?`, [slug]);
}

export async function getStoreById(db: Db, id: number) {
  return db.first(`SELECT * FROM stores WHERE id = ?`, [id]);
}

// The store the bot/catalog should default to. Prefers a globally configured
// owner store, otherwise returns the first active store.
export async function getDefaultStoreId(db: Db): Promise<number | null> {
  const ownerSetting = await getGlobalSetting(db, 'owner_store_slug');
  if (ownerSetting?.value) {
    const store = await getStoreBySlug(db, ownerSetting.value);
    if (store && store.status === 'active') return store.id;
  }
  const anyStore = await db.first<{ id: number }>(`SELECT * FROM stores WHERE status = 'active' ORDER BY id ASC LIMIT 1`);
  return anyStore?.id ?? null;
}

export async function getDefaultStore(db: Db): Promise<any | null> {
  const id = await getDefaultStoreId(db);
  if (!id) return null;
  return getStoreById(db, id);
}

export async function getStoresByReseller(db: Db, resellerId: number) {
  return db.all(`SELECT * FROM stores WHERE reseller_id = ? ORDER BY created_at DESC`, [resellerId]);
}

export async function countStoresByReseller(db: Db, resellerId: number): Promise<number> {
  const row = await db.first<{ c: number }>(
    `SELECT COUNT(*) as c FROM stores WHERE reseller_id = ? AND status != 'deleted'`,
    [resellerId]
  );
  return row?.c ?? 0;
}

export async function countAccountsByStore(db: Db, storeId: number): Promise<number> {
  const row = await db.first<{ c: number }>(
    `SELECT COUNT(*) as c FROM accounts WHERE store_id = ?`,
    [storeId]
  );
  return row?.c ?? 0;
}

export async function updateStore(db: Db, id: number, data: Partial<{
  name: string;
  walletBinance: string;
  configJson: string;
  status: string;
}>) {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.name) { fields.push('name = ?'); values.push(data.name); }
  if (data.walletBinance !== undefined) { fields.push('wallet_binance = ?'); values.push(data.walletBinance); }
  if (data.configJson) { fields.push('config_json = ?'); values.push(data.configJson); }
  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  
  if (fields.length === 0) return { success: true, meta: { changes: 0 } };
  
  fields.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));
  values.push(id);
  
  return db.run(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ============================================
// PLATFORMS
// ============================================

export async function listPlatforms(db: Db, activeOnly = true) {
  let sql = `SELECT * FROM platforms`;
  if (activeOnly) sql += ` WHERE is_active = 1`;
  sql += ` ORDER BY sort_order, name`;
  return db.all(sql);
}

export async function getPlatform(db: Db, key: string) {
  return db.first(`SELECT * FROM platforms WHERE key = ?`, [key]);
}

export async function upsertPlatform(db: Db, data: {
  key: string;
  name: string;
  type: string;
  icon?: string;
  imageUrl?: string;
  costPrice: number;
  salePrice: number;
  isActive?: number;
  sortOrder?: number;
}) {
  return db.run(
    `INSERT INTO platforms (key, name, type, icon, image_url, cost_price_usd, sale_price_usd, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       icon = excluded.icon,
       image_url = excluded.image_url,
       cost_price_usd = excluded.cost_price_usd,
       sale_price_usd = excluded.sale_price_usd,
       is_active = excluded.is_active,
       sort_order = excluded.sort_order`,
    [data.key, data.name, data.type, data.icon || null, data.imageUrl || null, data.costPrice, data.salePrice, data.isActive ?? 1, data.sortOrder ?? 0]
  );
}

// Store platform overrides
export async function setStorePlatformPrice(db: Db, storeId: number, platformKey: string, costPrice?: number, salePrice?: number, isActive = 1, promoImageUrl?: string | null) {
  return db.run(
    `INSERT INTO store_platforms (store_id, platform_key, cost_price_usd, sale_price_usd, is_active, promo_image_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, platform_key) DO UPDATE SET
       cost_price_usd = excluded.cost_price_usd,
       sale_price_usd = excluded.sale_price_usd,
       is_active = excluded.is_active,
       promo_image_url = COALESCE(excluded.promo_image_url, store_platforms.promo_image_url)`,
    [storeId, platformKey, costPrice ?? null, salePrice ?? null, isActive, promoImageUrl ?? null]
  );
}

export async function getStorePlatforms(db: Db, storeId: number) {
  return db.all(
    `SELECT sp.*, p.name, p.type, p.icon, p.image_url
     FROM store_platforms sp
     JOIN platforms p ON sp.platform_key = p.key
     WHERE sp.store_id = ? AND sp.is_active = 1 AND p.is_active = 1
     ORDER BY p.sort_order, p.name`,
    [storeId]
  );
}

// ============================================
// ACCOUNTS (INVENTORY)
// ============================================

export interface AccountInput {
  email: string;
  password: string;
  notes?: string;
}

export async function addAccounts(db: Db, env: Env, storeId: number, platformKey: string, accounts: AccountInput[]) {
  if (accounts.length === 0) return { added: 0 };

  const now = Math.floor(Date.now() / 1000);
  const sql = `INSERT INTO accounts (store_id, platform_key, email, password, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`;

  const statements = await Promise.all(accounts.map(async acc => {
    const encryptedPassword = await encryptSecret(env, acc.password);
    return { sql, params: [storeId, platformKey, acc.email, encryptedPassword, acc.notes || null, now] };
  }));

  await db.batch(statements);
  return { added: accounts.length };
}

// Decrypts an account's password for delivery to the buyer / admin.
export async function decryptAccountPassword(env: Env, encryptedPassword: string): Promise<string> {
  return decryptSecret(env, encryptedPassword);
}

export async function getAvailableAccounts(db: Db, storeId: number, platformKey: string, limit = 1) {
  return db.all(
    `SELECT * FROM accounts 
     WHERE store_id = ? AND platform_key = ? AND sold = 0 
     ORDER BY created_at ASC LIMIT ?`,
    [storeId, platformKey, limit]
  );
}

export async function getInventorySummary(db: Db, storeId: number) {
  return db.all(
    `SELECT platform_key, 
            COUNT(*) as total,
            SUM(CASE WHEN sold = 0 THEN 1 ELSE 0 END) as available,
            SUM(CASE WHEN sold = 1 THEN 1 ELSE 0 END) as sold
     FROM accounts 
     WHERE store_id = ? 
     GROUP BY platform_key`,
    [storeId]
  );
}

export async function getAccountById(db: Db, id: number) {
  return db.first(`SELECT * FROM accounts WHERE id = ?`, [id]);
}

export async function markAccountSold(db: Db, accountId: number, clientId: number, orderId: number) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `UPDATE accounts SET sold = 1, sold_at = ?, client_id = ?, order_id = ? WHERE id = ?`,
    [now, clientId, orderId, accountId]
  );
}

// ============================================
// STORE BUSINESS SETTINGS (Mi negocio)
// ============================================

// Returns non-secret business settings (never the encrypted secrets).
export interface BusinessSettings {
  id: number;
  name: string;
  business_name: string | null;
  wallet_binance: string | null;
  trc20_address: string | null;
  gmail_user: string | null;
  bot_token_set: boolean;
  gmail_password_set: boolean;
  promo_enabled: boolean;
  promo_timezone: number;
}

export async function getBusinessSettings(db: Db, storeId: number): Promise<BusinessSettings | null> {
  return db.first<BusinessSettings>(
    `SELECT id, name, business_name, wallet_binance, trc20_address, gmail_user,
            CASE WHEN bot_token IS NOT NULL THEN 1 ELSE 0 END as bot_token_set,
            CASE WHEN gmail_app_password IS NOT NULL THEN 1 ELSE 0 END as gmail_password_set,
            CASE WHEN promo_enabled IS NOT NULL AND promo_enabled = 1 THEN 1 ELSE 0 END as promo_enabled,
            COALESCE(promo_timezone, -180) as promo_timezone
     FROM stores WHERE id = ?`,
    [storeId]
  );
}

export interface BusinessSettingsInput {
  name?: string;
  businessName?: string;
  walletBinance?: string;   // UID Binance
  trc20Address?: string;   // dirección TRC20 (opcional)
  gmailUser?: string;
  gmailAppPassword?: string;
  botToken?: string;
}

export async function updateBusinessSettings(db: Db, env: Env, storeId: number, data: BusinessSettingsInput) {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name) { fields.push('name = ?'); values.push(data.name); }
  if (data.businessName !== undefined) { fields.push('business_name = ?'); values.push(data.businessName || null); }
  if (data.walletBinance !== undefined) { fields.push('wallet_binance = ?'); values.push(data.walletBinance || null); }
  if (data.trc20Address !== undefined) { fields.push('trc20_address = ?'); values.push(data.trc20Address || null); }
  if (data.gmailUser !== undefined) { fields.push('gmail_user = ?'); values.push(data.gmailUser || null); }
  if (data.gmailAppPassword !== undefined) {
    fields.push('gmail_app_password = ?');
    values.push(data.gmailAppPassword ? await encryptSecret(env, data.gmailAppPassword) : null);
  }
  if (data.botToken !== undefined) {
    fields.push('bot_token = ?');
    values.push(data.botToken ? await encryptSecret(env, data.botToken) : null);
  }

  if (fields.length === 0) return { success: true, meta: { changes: 0 } };
  fields.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));
  values.push(storeId);
  return db.run(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, values);
}

// Decrypts a store's Telegram bot token (single shared bot per store).
export async function getStoreBotToken(env: Env, db: Db, storeId: number): Promise<string | null> {
  const row = await db.first<{ bot_token: string }>(`SELECT bot_token FROM stores WHERE id = ?`, [storeId]);
  if (!row?.bot_token) return null;
  return decryptSecret(env, row.bot_token);
}

// Decrypts a store's Gmail credentials used by the bridge for auto-validation.
export async function getStoreGmailCredentials(env: Env, db: Db, storeId: number): Promise<{ user: string; appPassword: string } | null> {
  const row = await db.first<{ gmail_user: string; gmail_app_password: string }>(
    `SELECT gmail_user, gmail_app_password FROM stores WHERE id = ?`,
    [storeId]
  );
  if (!row?.gmail_user || !row?.gmail_app_password) return null;
  const appPassword = await decryptSecret(env, row.gmail_app_password);
  return { user: row.gmail_user, appPassword };
}

// All stores that configured Gmail validation (active stores only).
// Used by the bridge to poll every vendor mailbox and route payments to
// the correct store.
export async function listStoresWithGmail(env: Env, db: Db): Promise<Array<{ store_id: number; gmail_user: string; gmail_app_password: string }>> {
  const rows = await db.all<{ id: number; gmail_user: string; gmail_app_password: string }>(
    `SELECT id, gmail_user, gmail_app_password FROM stores
     WHERE status = 'active' AND gmail_user IS NOT NULL AND gmail_app_password IS NOT NULL`
  );
  const out: Array<{ store_id: number; gmail_user: string; gmail_app_password: string }> = [];
  for (const row of rows) {
    if (!row.gmail_user || !row.gmail_app_password) continue;
    const appPassword = await decryptSecret(env, row.gmail_app_password);
    out.push({ store_id: row.id, gmail_user: row.gmail_user, gmail_app_password: appPassword });
  }
  return out;
}

// ============================================
// CLIENTS
// ============================================

export async function createClient(db: Db, data: {
  storeId: number;
  username: string;
  passwordHash: string;
  email?: string;
}) {
  return db.run(
    `INSERT INTO clients (store_id, username, password_hash, email) VALUES (?, ?, ?, ?)`,
    [data.storeId, data.username.toLowerCase(), data.passwordHash, data.email || null]
  );
}

export async function getClientByUsername(db: Db, storeId: number, username: string) {
  return db.first(
    `SELECT * FROM clients WHERE store_id = ? AND username = ?`,
    [storeId, username.toLowerCase()]
  );
}

export async function getClientById(db: Db, id: number) {
  return db.first(`SELECT * FROM clients WHERE id = ?`, [id]);
}

export async function getClientsByStore(db: Db, storeId: number) {
  return db.all(`SELECT * FROM clients WHERE store_id = ? ORDER BY created_at DESC`, [storeId]);
}

export async function updateClient(db: Db, id: number, data: Partial<{
  passwordHash: string;
  email: string;
  status: string;
}>) {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (data.passwordHash) { fields.push('password_hash = ?'); values.push(data.passwordHash); }
  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  
  if (fields.length === 0) return { success: true, meta: { changes: 0 } };
  
  values.push(id);
  return db.run(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function updateClientLogin(db: Db, id: number) {
  return db.run(
    `UPDATE clients SET last_login_at = ? WHERE id = ?`,
    [Math.floor(Date.now() / 1000), id]
  );
}

// ============================================
// ORDERS
// ============================================

export interface OrderInput {
  storeId: number;
  clientId: number;
  platformKey: string;
  accountId: number;
  priceUsd: number;
  costUsd: number;
  binancePaymentId?: number;
}

export async function createOrder(db: Db, data: OrderInput) {
  const profit = data.priceUsd - data.costUsd;
  return db.run(
    `INSERT INTO orders (store_id, client_id, platform_key, account_id, price_usd, cost_usd, profit_usd, binance_payment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.storeId, data.clientId, data.platformKey, data.accountId, data.priceUsd, data.costUsd, profit, data.binancePaymentId || null]
  );
}

export async function getOrdersByStore(db: Db, storeId: number, limit = 100) {
  return db.all(
    `SELECT o.*, c.username as client_username, p.name as platform_name
     FROM orders o
     JOIN clients c ON o.client_id = c.id
     JOIN platforms p ON o.platform_key = p.key
     WHERE o.store_id = ?
     ORDER BY o.created_at DESC LIMIT ?`,
    [storeId, limit]
  );
}

export async function getOrdersByClient(db: Db, clientId: number) {
  return db.all(
    `SELECT o.*, p.name as platform_name, p.icon as platform_icon
     FROM orders o
     JOIN platforms p ON o.platform_key = p.key
     WHERE o.client_id = ?
     ORDER BY o.created_at DESC`,
    [clientId]
  );
}

// ============================================
// BINANCE PAYMENTS
// ============================================

export interface BinancePaymentInput {
  storeId: number;
  clientId?: number;
  binanceUser: string;
  usdtAmount: number;
  expectedAmount?: number;
  rawEmail?: string;
}

export async function createBinancePayment(db: Db, data: BinancePaymentInput) {
  return db.run(
    `INSERT INTO binance_payments (store_id, client_id, binance_user, usdt_amount, expected_amount, raw_email)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.storeId, data.clientId || null, data.binanceUser, data.usdtAmount, data.expectedAmount || null, data.rawEmail || null]
  );
}

export async function getBinancePayment(db: Db, id: number) {
  return db.first(`SELECT * FROM binance_payments WHERE id = ?`, [id]);
}

export async function getPendingPayments(db: Db, storeId: number) {
  return db.all(
    `SELECT * FROM binance_payments WHERE store_id = ? AND status = 'pending' ORDER BY created_at ASC`,
    [storeId]
  );
}

export async function verifyBinancePayment(db: Db, id: number, clientId: number, status: 'verified' | 'failed') {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `UPDATE binance_payments SET status = ?, verified_at = ?, client_id = ? WHERE id = ?`,
    [status, now, clientId, id]
  );
}

// ============================================
// SESSIONS
// ============================================

export async function createSession(db: Db, data: {
  id: string; // jti
  storeId?: number; // 0 for superadmin/reseller, which aren't store-scoped
  userType: 'superadmin' | 'reseller' | 'client';
  userId: number;
  expiresAt: number;
}) {
  return db.run(
    `INSERT INTO sessions (id, store_id, user_type, user_id, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [data.id, data.storeId ?? null, data.userType, data.userId, data.expiresAt]
  );
}

export async function getSession(db: Db, id: string) {
  return db.first(
    `SELECT * FROM sessions WHERE id = ? AND revoked = 0 AND expires_at > ?`,
    [id, Math.floor(Date.now() / 1000)]
  );
}

export async function revokeSession(db: Db, id: string) {
  return db.run(`UPDATE sessions SET revoked = 1 WHERE id = ?`, [id]);
}

export async function revokeAllUserSessions(db: Db, userType: string, userId: number) {
  return db.run(`UPDATE sessions SET revoked = 1 WHERE user_type = ? AND user_id = ?`, [userType, userId]);
}

export async function cleanupExpiredSessions(db: Db) {
  return db.run(`DELETE FROM sessions WHERE expires_at < ? OR revoked = 1`, [Math.floor(Date.now() / 1000)]);
}

// ============================================
// RATE LIMITS
// ============================================

export async function checkRateLimit(db: Db, key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const existing = await db.first<{ count: number; window_start: number; blocked_until: number }>(
    `SELECT * FROM rate_limits WHERE key = ?`, [key]
  );
  
  if (existing) {
    if (existing.blocked_until && existing.blocked_until > now) {
      return { allowed: false, remaining: 0 };
    }
    
    if (existing.window_start < windowStart) {
      // New window
      await db.run(
        `UPDATE rate_limits SET count = 1, window_start = ?, blocked_until = 0 WHERE key = ?`,
        [now, key]
      );
      return { allowed: true, remaining: limit - 1 };
    }
    
    if (existing.count >= limit) {
      await db.run(
        `UPDATE rate_limits SET blocked_until = ? WHERE key = ?`,
        [now + windowMs, key]
      );
      return { allowed: false, remaining: 0 };
    }
    
    await db.run(
      `UPDATE rate_limits SET count = count + 1 WHERE key = ?`,
      [key]
    );
    return { allowed: true, remaining: limit - existing.count - 1 };
  } else {
    await db.run(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`,
      [key, now]
    );
    return { allowed: true, remaining: limit - 1 };
  }
}

// ============================================
// STATS
// ============================================

export async function getSuperAdminStats(db: Db) {
  const [resellers, stores, accounts, clients, orders] = await Promise.all([
    db.first(`SELECT COUNT(*) as c FROM resellers WHERE status = 'active'`),
    db.first(`SELECT COUNT(*) as c FROM stores WHERE status = 'active'`),
    db.first(`SELECT COUNT(*) as c FROM accounts WHERE sold = 0`),
    db.first(`SELECT COUNT(*) as c FROM clients`),
    db.first(`SELECT COUNT(*) as c FROM orders`),
  ]);
  
  return {
    total_resellers: resellers?.c ?? 0,
    total_stores: stores?.c ?? 0,
    total_accounts: accounts?.c ?? 0,
    total_clients: clients?.c ?? 0,
    total_orders: orders?.c ?? 0,
  };
}

export async function getStoreStats(db: Db, storeId: number) {
  const [accounts, clients, orders, revenue, profit] = await Promise.all([
    db.first(`SELECT COUNT(*) as c FROM accounts WHERE store_id = ? AND sold = 0`, [storeId]),
    db.first(`SELECT COUNT(*) as c FROM clients WHERE store_id = ?`, [storeId]),
    db.first(`SELECT COUNT(*) as c FROM orders WHERE store_id = ?`, [storeId]),
    db.first(`SELECT COALESCE(SUM(price_usd), 0) as total FROM orders WHERE store_id = ?`, [storeId]),
    db.first(`SELECT COALESCE(SUM(profit_usd), 0) as total FROM orders WHERE store_id = ?`, [storeId]),
  ]);
  
  return {
    stock_available: accounts?.c ?? 0,
    total_clients: clients?.c ?? 0,
    total_orders: orders?.c ?? 0,
    total_revenue: revenue?.total ?? 0,
    total_profit: profit?.total ?? 0,
  };
}

// ============================================
// SETTINGS
// ============================================

export async function getGlobalSetting(db: Db, key: string) {
  return db.first(`SELECT value FROM global_settings WHERE key = ?`, [key]);
}

export async function setGlobalSetting(db: Db, key: string, value: string) {
  return db.run(
    `INSERT INTO global_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// ============================================
// PROMOS AUTOMÁTICAS (chats de grupo por tienda)
// ============================================

export async function addStorePromoChat(db: Db, storeId: number, chatId: number, chatTitle?: string) {
  return db.run(
    `INSERT INTO store_promo_chats (store_id, chat_id, chat_title, is_active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(store_id, chat_id) DO UPDATE SET is_active = 1, chat_title = excluded.chat_title`,
    [storeId, chatId, chatTitle ?? null]
  );
}

export async function deactivateStorePromoChat(db: Db, storeId: number, chatId: number) {
  return db.run(
    `UPDATE store_promo_chats SET is_active = 0 WHERE store_id = ? AND chat_id = ?`,
    [storeId, chatId]
  );
}

export async function listStorePromoChats(db: Db, storeId: number) {
  return db.all(
    `SELECT * FROM store_promo_chats WHERE store_id = ? AND is_active = 1 ORDER BY created_at DESC`,
    [storeId]
  );
}

export async function markPromoChatSent(db: Db, storeId: number, chatId: number, sentKey: string) {
  return db.run(
    `UPDATE store_promo_chats SET last_sent_key = ? WHERE store_id = ? AND chat_id = ?`,
    [sentKey, storeId, chatId]
  );
}

export async function listAllPromoChats(db: Db) {
  return db.all(
    `SELECT spc.*, s.slug, s.promo_enabled, s.promo_timezone, s.bot_token
     FROM store_promo_chats spc
     JOIN stores s ON spc.store_id = s.id
     WHERE spc.is_active = 1 AND s.promo_enabled = 1 AND s.status = 'active'
     ORDER BY spc.store_id, spc.chat_id`
  );
}

export async function listPromoEnabledStores(db: Db) {
  return db.all(
    `SELECT id, slug, promo_enabled, promo_timezone, bot_token FROM stores WHERE status = 'active' AND promo_enabled = 1`
  );
}

export async function setStorePromoConfig(db: Db, storeId: number, enabled?: number, timezone?: number) {
  const fields: string[] = [];
  const values: any[] = [];
  if (enabled !== undefined) { fields.push('promo_enabled = ?'); values.push(enabled ? 1 : 0); }
  if (timezone !== undefined) { fields.push('promo_timezone = ?'); values.push(timezone); }
  if (fields.length === 0) return null;
  values.push(storeId);
  return db.run(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ============================================
// UPLOADS  (imágenes subidas → URL directa)
// ============================================

export async function saveUpload(db: Db, data: {
  id: string;
  storeId: number;
  mime: string;
  bytes: ArrayBuffer;
}) {
  return db.run(
    `INSERT INTO uploads (id, store_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?)`,
    [data.id, data.storeId, data.mime, data.bytes, Math.floor(Date.now() / 1000)]
  );
}

export async function getUpload(db: Db, id: string) {
  return db.first<{ id: string; store_id: number; mime: string; data: ArrayBuffer }>(
    `SELECT id, store_id, mime, data FROM uploads WHERE id = ?`,
    [id]
  );
}