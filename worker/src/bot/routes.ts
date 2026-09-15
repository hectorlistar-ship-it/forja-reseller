import { Hono } from 'hono';
import type { Env } from '../config';
import { createDb } from '../db/client';
import * as queries from '../db/queries';

export const botRoutes = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Telegram webhook
botRoutes.post('/telegram', async (c) => {
  const db = createDb(c.env);
  const update = await c.req.json();
  
  // Basic webhook handling - in production use proper Telegram bot library
  const message = update.message;
  if (!message || !message.text) {
    return c.json({ ok: true });
  }
  
  const chatId = message.chat.id;
  const text = message.text.trim();
  const userId = message.from?.id;
  const username = message.from?.username;
  
  // Simple command handling
  if (text === '/start') {
    await sendTelegramMessage(c.env, chatId, 
      `¡Hola! Soy el bot de ${c.env.BUSINESS_NAME}.\n\n` +
      `Puedo ayudarte con:\n` +
      `• Consultar catálogo disponible\n` +
      `• Ver tus compras\n` +
      `• Soporte\n\n` +
      `Escribe /catalogo para ver qué hay disponible.`
    );
    return c.json({ ok: true });
  }
  
  if (text === '/catalogo' || text === '/catalogo@') {
    // Get default store (first active)
    const db = createDb(c.env);
    const store = await db.first(`SELECT * FROM stores WHERE status = 'active' LIMIT 1`);
    
    if (!store) {
      await sendTelegramMessage(c.env, chatId, 'No hay tiendas disponibles.');
      return c.json({ ok: true });
    }
    
    const platforms = await getStorePlatforms(c.env, store.id);
    if (platforms.length === 0) {
      await sendTelegramMessage(c.env, chatId, 'No hay stock disponible.');
      return c.json({ ok: true });
    }
    
    let msg = '📦 *Catálogo disponible:*\n\n';
    for (const p of platforms) {
      msg += `• ${p.name} - $${p.sale_price_usd} USDT`;
      if (p.stock > 0) msg += ` (${p.stock} disponibles)`;
      else msg += ' (sin stock)';
      msg += '\n';
    }
    msg += '\nEscribe /comprar <plataforma> para comprar.';
    
    await sendTelegramMessage(c.env, chatId, msg, { parse_mode: 'Markdown' });
    return c.json({ ok: true });
  }
  
  if (text.startsWith('/comprar ')) {
    const platformKey = text.replace('/comprar ', '').trim().toLowerCase();
    await handlePurchase(c, chatId, userId, username, platformKey);
    return c.json({ ok: true });
  }
  
  if (text === '/miscompras') {
    // TODO: implement
    await sendTelegramMessage(c.env, chatId, 'Función en desarrollo.');
    return c.json({ ok: true });
  }
  
  if (text === '/ayuda') {
    await sendTelegramMessage(c.env, chatId,
      `Comandos disponibles:\n` +
      `/start - Iniciar\n` +
      `/catalogo - Ver catálogo\n` +
      `/comprar <plataforma> - Comprar cuenta\n` +
      `/miscompras - Ver tus compras\n` +
      `/ayuda - Esta ayuda`
    );
    return c.json({ ok: true });
  }
  
  // Default response
  await sendTelegramMessage(c.env, chatId, 'No entiendo ese comando. Escribe /ayuda para ver comandos.');
  return c.json({ ok: true });
});

async function sendTelegramMessage(env: any, chatId: number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
}

async function getStorePlatforms(env: any, storeId: number) {
  const db = createDb(env);
  const platforms = await queries.getStorePlatforms(db, storeId);
  const inventory = await queries.getInventorySummary(db, storeId);
  return platforms.map((p: any) => {
    const inv = inventory.find((i: any) => i.platform_key === p.platform_key);
    return { ...p, stock: inv?.available ?? 0 };
  });
}

async function handlePurchase(c: any, chatId: number, userId: number, username: string | undefined, platformKey: string) {
  // Simplified - would integrate with store API
  await sendTelegramMessage(c.env, chatId, 
    `Para comprar ${platformKey}, ve a la tienda web:\n` +
    `https://reseller.tudominio.pages.dev/tienda/tu-tienda\n\n` +
    `Allí verás el stock en tiempo real y podrás pagar con USDT.`
  );
}

