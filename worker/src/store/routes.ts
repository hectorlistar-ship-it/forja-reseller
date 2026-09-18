import { Hono } from 'hono';
import type { Env } from '../config';
import { createDb } from '../db/client';
import * as queries from '../db/queries';
import { decryptAccountPassword } from '../db/queries';
import { createAuthMiddleware, requireClient } from '../auth';

const storeRoutes = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// All /api/store/* routes require a logged-in client.
const clientAuth = [createAuthMiddleware(), requireClient()];

// Get store catalog (authenticated client)
storeRoutes.get('/catalog', ...clientAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');

  const platforms = await db.all<any>(
    `SELECT sp.*, p.name, p.type, p.icon
     FROM store_platforms sp
     JOIN platforms p ON sp.platform_key = p.key
     WHERE sp.store_id = ? AND sp.is_active = 1 AND p.is_active = 1
     ORDER BY p.sort_order, p.name`,
    [user.storeId]
  );

  const inventory = await db.all<any>(
    `SELECT platform_key,
            SUM(CASE WHEN sold = 0 THEN 1 ELSE 0 END) as available
     FROM accounts
     WHERE store_id = ? AND sold = 0
     GROUP BY platform_key`,
    [user.storeId]
  );

  const catalog = platforms.map(p => {
    const inv = inventory.find(i => i.platform_key === p.platform_key);
    return {
      key: p.platform_key,
      name: p.name,
      type: p.type,
      icon: p.icon,
      price_usd: p.sale_price_usd,
      stock: inv?.available ?? 0,
    };
  }).filter(p => p.stock > 0);

  return c.json({ platforms: catalog });
});

// Buy flow - direct purchase (creates a pending Binance payment)
storeRoutes.post('/buy', ...clientAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = user.storeId!;

  const body = await c.req.json().catch(() => ({}));
  const { platform_key, binance_user } = body;

  if (!platform_key || !binance_user) {
    return c.json({ error: 'platform_key y binance_user requeridos' }, 400);
  }

  const platform = await db.first<any>(
    `SELECT sp.*, p.name
     FROM store_platforms sp
     JOIN platforms p ON sp.platform_key = p.key
     WHERE sp.store_id = ? AND sp.platform_key = ? AND sp.is_active = 1`,
    [storeId, platform_key]
  );

  if (!platform) {
    return c.json({ error: 'Plataforma no disponible' }, 404);
  }

  const available = await db.first<{ c: number }>(
    `SELECT COUNT(*) as c FROM accounts
     WHERE store_id = ? AND platform_key = ? AND sold = 0`,
    [storeId, platform_key]
  );

  if (!available || available.c === 0) {
    return c.json({ error: 'Sin stock disponible' }, 404);
  }

  const paymentResult = await db.run(
    `INSERT INTO binance_payments (store_id, client_id, binance_user, usdt_amount, expected_amount, platform_key, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [storeId, user.userId, binance_user, platform.sale_price_usd, platform.sale_price_usd, platform_key]
  );

  const paymentId = paymentResult.meta.last_row_id;

  const store = await db.first<{ wallet_binance: string; trc20_address: string; name: string }>(
    `SELECT wallet_binance, trc20_address, name FROM stores WHERE id = ?`,
    [storeId]
  );

  return c.json({
    payment_id: paymentId,
    platform: platform.platform_key,
    platform_name: platform.name,
    price_usd: platform.sale_price_usd,
    binance_wallet: store?.wallet_binance || 'CONFIGURAR_WALLET',
    trc20_address: store?.trc20_address || null,
    store_name: store?.name || null,
    binance_user,
    message: `Envía ${platform.sale_price_usd} USDT a la wallet y usa el botón "Verificar pago" cuando termines.`,
  });
});

// Verify payment
storeRoutes.post('/verify-payment', ...clientAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const storeId = user.storeId!;

  const body = await c.req.json().catch(() => ({}));
  const { payment_id } = body;

  if (!payment_id) {
    return c.json({ error: 'payment_id requerido' }, 400);
  }

  // Real verification happens asynchronously via the Binance bridge
  // (see /api/binance/callback). This endpoint just reports status.
  const payment = await db.first<any>(
    `SELECT * FROM binance_payments WHERE id = ? AND store_id = ?`,
    [payment_id, storeId]
  );

  if (!payment) {
    return c.json({ error: 'Pago no encontrado' }, 404);
  }

  return c.json({
    status: payment.status,
    message: payment.status === 'verified' ? 'Pago verificado' : 'Pendiente de verificación',
  });
});

// My purchases (includes the decrypted account credentials, since the
// storefront shows them inline instead of a separate details page)
storeRoutes.get('/my-purchases', ...clientAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');

  const rows = await db.all<any>(
    `SELECT o.*, p.name as platform_name, p.icon as platform_icon, a.email, a.password
     FROM orders o
     JOIN platforms p ON o.platform_key = p.key
     JOIN accounts a ON o.account_id = a.id
     WHERE o.client_id = ?
     ORDER BY o.created_at DESC`,
    [user.userId]
  );

  const orders = await Promise.all(rows.map(async (row) => ({
    ...row,
    password: await decryptAccountPassword(c.env, row.password),
  })));

  return c.json({ orders });
});

// Get account details for a purchase (decrypts the stored password)
storeRoutes.get('/purchase/:orderId', ...clientAuth, async (c) => {
  const db = createDb(c.env);
  const user = c.get('user');
  const orderId = Number(c.req.param('orderId'));

  const order = await db.first<any>(
    `SELECT o.*, p.name as platform_name, a.email, a.password
     FROM orders o
     JOIN platforms p ON o.platform_key = p.key
     JOIN accounts a ON o.account_id = a.id
     WHERE o.id = ? AND o.client_id = ?`,
    [orderId, user.userId]
  );

  if (!order) {
    return c.json({ error: 'Compra no encontrada' }, 404);
  }

  const password = await decryptAccountPassword(c.env, order.password);

  return c.json({
    platform: order.platform_key,
    platform_name: order.platform_name,
    email: order.email,
    password,
  });
});

export default storeRoutes;
