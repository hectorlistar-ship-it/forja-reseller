import { Hono } from 'hono';
import type { Env } from '../config';
import { createDb } from '../db/client';
import * as queries from '../db/queries';
import { extractToken } from '../auth';

export const binanceRoutes = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Callback from bridge (protected by BRIDGE_TOKEN)
binanceRoutes.post('/callback', async (c) => {
  const bridgeToken = extractToken(c.req.header('Authorization'));
  const expectedToken = c.env.BRIDGE_TOKEN;
  
  if (!bridgeToken || bridgeToken !== expectedToken) {
    return c.json({ error: 'Token de bridge inválido' }, 401);
  }
  
  const db = createDb(c.env);
  const body = await c.req.json();
  
  const { store_id, client_id, binance_user, usdt_amount, status, raw_email } = body;

  if (!binance_user || !usdt_amount || status !== 'verified') {
    return c.json({ error: 'Datos incompletos o estado no verificado' }, 400);
  }

  // Find the pending payment matching this binance_user + amount.
  // The bridge only knows the Gmail inbox, not which store the payment belongs
  // to, so match globally; if a numeric store_id is provided, prefer it.
  const storeIdNum = Number(store_id);
  let payment: any = null;
  if (Number.isInteger(storeIdNum) && storeIdNum > 0) {
    payment = await db.first(
      `SELECT * FROM binance_payments
       WHERE store_id = ? AND LOWER(binance_user) = LOWER(?) AND ABS(usdt_amount - ?) < 0.01 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [storeIdNum, binance_user, usdt_amount]
    );
  }
  if (!payment) {
    payment = await db.first(
      `SELECT * FROM binance_payments
       WHERE LOWER(binance_user) = LOWER(?) AND ABS(usdt_amount - ?) < 0.01 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [binance_user, usdt_amount]
    );
  }

  if (!payment) {
    // No matching pending payment - log for manual review
    console.log('[binance] No matching pending payment:', { store_id, binance_user, usdt_amount });
    return c.json({ message: 'Pago verificado pero sin orden pendiente coincidente', ok: true });
  }
  
  // Verify amount matches expected
  if (payment.expected_amount && Math.abs(payment.expected_amount - usdt_amount) > 0.01) {
    console.warn('[binance] Amount mismatch:', { expected: payment.expected_amount, received: usdt_amount });
    // Still process but log warning
  }
  
  // Determine client_id
  let clientId = payment.client_id;
  if (!clientId) {
    // Try to find client by binance_user in this store
    const client = await db.first(
      `SELECT id FROM clients WHERE store_id = ? AND username = ?`,
      [payment.store_id, binance_user]
    );
    if (client) {
      clientId = client.id;
    }
  }
  
  // Update payment as verified
  await queries.verifyBinancePayment(db, payment.id, clientId || 0, 'verified');
  
  if (!payment.platform_key) {
    console.error('[binance] Pending payment has no platform_key:', payment.id);
    return c.json({ message: 'Pago verificado pero la orden no especifica plataforma', ok: true });
  }

  // Now find available account and complete order
  const account = await db.first(
    `SELECT * FROM accounts 
     WHERE store_id = ? AND platform_key = ? AND sold = 0
     ORDER BY created_at ASC LIMIT 1`,
    [payment.store_id, payment.platform_key]
  );
  
  if (!account) {
    console.error('[binance] No account available for verified payment:', payment.id);
    return c.json({ message: 'Pago verificado pero sin stock disponible', ok: true });
  }
  
  // Get platform config
  const platform = await db.first(
    `SELECT sp.sale_price_usd, sp.cost_price_usd, p.name
     FROM store_platforms sp
     JOIN platforms p ON sp.platform_key = p.key
     WHERE sp.store_id = ? AND sp.platform_key = ?`,
    [payment.store_id, payment.platform_key]
  );
  
  if (!platform) {
    console.error('[binance] Platform not found for payment:', payment.id);
    return c.json({ message: 'Pago verificado pero error de configuración', ok: true });
  }
  
  // Determine client_id for order
  let orderClientId = clientId;
  if (!orderClientId) {
    // Create anonymous client or find by binance_user
    const anonClient = await db.first(
      `SELECT id FROM clients WHERE store_id = ? AND username = ?`,
      [payment.store_id, binance_user]
    );
    if (anonClient) {
      orderClientId = anonClient.id;
    } else {
      // Create client record
      const passwordHash = await import('../auth').then(m => m.hashPassword(binance_user + Date.now()));
      const result = await db.run(
        `INSERT INTO clients (store_id, username, password_hash) VALUES (?, ?, ?)`,
        [payment.store_id, binance_user, passwordHash]
      );
      orderClientId = result.meta.last_row_id;
    }
  }
  
  // Claim the account atomically: `AND sold = 0` means only one concurrent
  // callback can win this UPDATE, closing the race where two payments
  // could otherwise be assigned the same account.
  const now = Math.floor(Date.now() / 1000);
  const priceUsd = platform.sale_price_usd;
  const costUsd = platform.cost_price_usd || 0;
  const profit = priceUsd - costUsd;

  const claim = await db.run(
    `UPDATE accounts SET sold = 1, sold_at = ?, client_id = ? WHERE id = ? AND sold = 0`,
    [now, orderClientId, account.id]
  );
  if (!claim.meta.changes) {
    console.error('[binance] Account was already claimed by another payment:', account.id);
    return c.json({ message: 'Pago verificado pero la cuenta ya fue asignada, revisar manualmente', ok: true });
  }

  const orderResult = await db.run(
    `INSERT INTO orders (store_id, client_id, platform_key, account_id, price_usd, cost_usd, profit_usd, binance_payment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [payment.store_id, orderClientId, account.platform_key, account.id, priceUsd, costUsd, profit, payment.id]
  );
  await db.run(`UPDATE accounts SET order_id = ? WHERE id = ?`, [orderResult.meta.last_row_id, account.id]);
  
  // Notify via Telegram (async, don't wait)
  notifyTelegram(c.env, {
    store_id: payment.store_id,
    platform: account.platform_key,
    platform_name: platform.name,
    client: binance_user,
    amount: priceUsd,
    account_email: account.email,
  }).catch(console.error);
  
  return c.json({ ok: true, message: 'Orden completada', order_id: orderResult.meta.last_row_id });
});

// Helper to send Telegram notification
async function notifyTelegram(env: any, data: {
  store_id: number;
  platform: string;
  platform_name: string;
  client: string;
  amount: number;
  account_email: string;
}) {
  try {
    // Get store info for Telegram chat_id
    // In production, store chat_id in store config
    const chatId = env.TELEGRAM_ADMIN_CHAT_ID; // Set in secrets
    if (!chatId) return;
    
    const text = `✅ *Nueva venta*\n\n` +
      `Tienda: ${data.store_id}\n` +
      `Plataforma: ${data.platform_name} (${data.platform})\n` +
      `Cliente: @${data.client}\n` +
      `Monto: $${data.amount} USDT\n` +
      `Cuenta: ${data.account_email}`;
    
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[notifyTelegram] error:', err);
  }
}