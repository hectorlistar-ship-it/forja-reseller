import { Hono } from 'hono';
import type { Env } from '../config';
import { createDb } from '../db/client';
import * as queries from '../db/queries';

export const botRoutes = new Hono<{ Bindings: Env; Variables: { user: any } }>();

const WORKER_URL = 'https://forja-reseller.hectorlistar.workers.dev';

const EMOJI: Record<string, string> = {
  netflix: '🍿',
  hbo: '📺',
  disney: '✨',
  vix: '📺',
  spotify: '🎵',
  youtube: '▶️',
};

// Telegram webhook
botRoutes.post('/telegram', async (c) => {
  const db = createDb(c.env);
  const update = await c.req.json();

  // inline keyboard handling
  if (update.callback_query) {
    const data = update.callback_query.data;
    const cbChatId = update.callback_query.message.chat.id;
    const cid = update.callback_query.id;
    if (data === 'catalogo') {
      await sendCatalog(c.env, cbChatId);
      await answerCallback(c.env, cid, 'Abriendo catálogo… 🛒');
    }
    return c.json({ ok: true });
  }

  // Basic webhook handling - in production use proper Telegram bot library
  const message = update.message;
  if (!message || !message.text) {
    return c.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userId = message.from?.id;
  const username = message.from?.username;
  const firstName = message.from?.first_name || '';

  // Simple command handling
  if (text === '/start') {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🛒 Ver catálogo disponible', callback_data: 'catalogo' }],
        [{ text: '🛍️ Comprar', url: CMD_URL(c.env, 'default', '') }],
      ],
    };
    const msg =
      `🎉 ¡Hola${firstName ? ' ' + firstName : ''}! Bienvenido a *${c.env.BUSINESS_NAME}* 🚀\n\n` +
      `Somos tu tienda de cuentas *Premium* con entrega inmediata.\n\n` +
      `👑 Streamings, música y más al mejor precio.\n` +
      `⚡ Activación al instante.\n` +
      `🛡️ Garantía por tu compra.\n\n` +
      `Pulsa el botón para ver lo que tenemos disponible 👇`;

    await sendTelegramMessage(c.env, chatId, msg, { parse_mode: 'Markdown', reply_markup: JSON.stringify(keyboard) });
    return c.json({ ok: true });
  }

  if (text === '/catalogo' || text === '/catalogo@') {
    await sendCatalog(c.env, chatId);
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
    const keyboard = {
      inline_keyboard: [
        [{ text: '🛒 Ver catálogo', callback_data: 'catalogo' }],
      ],
    };
    await sendTelegramMessage(c.env, chatId,
      `Comandos disponibles:\n` +
      `🏷️ /catalogo - Ver catálogo\n` +
      `🛍️ /comprar <plataforma> - Comprar cuenta\n` +
      `📦 /miscompras - Ver tus compras\n` +
      `❓ /ayuda - Esta ayuda`,
      { reply_markup: JSON.stringify(keyboard) }
    );
    return c.json({ ok: true });
  }

  // Default response
  await sendTelegramMessage(c.env, chatId, 'No entiendo ese comando. Escribe /ayuda para ver comandos.');
  return c.json({ ok: true });
});

function CMD_URL(env: any, slug: string, _platform: string) {
  const storeUrl = env.STORE_URL || 'https://reseller-store.pages.dev';
  return `${storeUrl}/tienda/${slug}`;
}

async function sendCatalog(env: any, chatId: number) {
  const db = createDb(env);
  const store = await db.first(`SELECT * FROM stores WHERE status = 'active' LIMIT 1`);

  if (!store) {
    await sendTelegramMessage(env, chatId, 'No hay tiendas disponibles.');
    return;
  }

  const platforms = await getStorePlatforms(env, store.id);
  if (platforms.length === 0) {
    await sendTelegramMessage(env, chatId, 'No hay stock disponible.');
    return;
  }

  const storeUrl = env.STORE_URL || 'https://reseller-store.pages.dev';
  const storeLink = `${storeUrl}/tienda/${store.slug}`;
  const bannerUrl = `${WORKER_URL}/banner-catalogo.png`;

  // caption con título, intro y lista
  let caption = `🍿 *¡CUENTAS PREMIUM DISPONIBLES!* 🎧\n\n`;
  caption += `Pago con *USDT*, entrega inmediata y 100% garantizado.\n\n`;

  const buttons: any[] = [];
  for (const p of platforms) {
    const emo = EMOJI[p.platform_key] || '📦';
    if (p.stock > 0) {
      caption += `${emo} *${p.name}* — $${p.sale_price_usd} USDT · ${p.stock} disp.\n`;
      buttons.push([{ text: `${emo} ${p.name} — $${p.sale_price_usd} USDT`, url: storeLink }]);
    }
  }

  caption += `\n🔥 *Activación rápida y garantizada.*\n`;
  caption += `\nPulsa el botón de tu plataforma para comprar 👇`;

  buttons.push([{ text: '🛒 COMPRAR AHORA', url: storeLink }]);

  // si la foto falla, envía el texto plano
  const res = await sendTelegramPhoto(env, chatId, bannerUrl, caption, {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ inline_keyboard: buttons }),
  });
  if (!res) {
    await sendTelegramMessage(env, chatId, caption, { parse_mode: 'Markdown' });
  }
}

async function sendTelegramMessage(env: any, chatId: number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
  return res.ok;
}

async function answerCallback(env: any, callbackQueryId: string, text: string) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
  return res.ok;
}

async function sendTelegramPhoto(env: any, chatId: number, photoUrl: string, caption: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, ...options }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
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
  const db = createDb(c.env);
  const store = await db.first(`SELECT * FROM stores WHERE status = 'active' LIMIT 1`);
  if (!store) {
    await sendTelegramMessage(c.env, chatId, 'No hay tiendas disponibles.');
    return;
  }
  const storeUrl = c.env.STORE_URL || 'https://reseller-store.pages.dev';
  const storeLink = `${storeUrl}/tienda/${store.slug}`;

  const platform = await db.first(`SELECT * FROM platforms WHERE lower(key) = lower(?)`, [platformKey]);
  const emo = EMOJI[platform?.key] || '📦';

  if (!platform) {
    const keyboard = { inline_keyboard: [[{ text: '🛒 Ver catálogo', callback_data: 'catalogo' }]] };
    await sendTelegramMessage(c.env, chatId,
      `❌ No encontré *${platformKey}*.\n\nEscribe el nombre tal como aparece en el catálogo, por ejemplo:\n/comprar netflix`,
      { parse_mode: 'Markdown', reply_markup: JSON.stringify(keyboard) }
    );
    return;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: `🛒 COMPRAR ${platform.name.toUpperCase()} por $${platform.sale_price_usd} USDT`, url: storeLink }],
    ],
  };

  await sendTelegramMessage(c.env, chatId,
    `${emo} *¡Buenísima elección!*\n\n` +
    `Cuenta *${platform.name}* disponible al instante.\n` +
    `💰 Precio: *$${platform.sale_price_usd} USDT*\n\n` +
    `💳 Pago con USDT (red TRC20) y recibes tu cuenta al momento.\n` +
    `⚡ Entrega automática, sin esperas.\n\n` +
    `Pulsa el botón para completar tu compra 👇`,
    { parse_mode: 'Markdown', reply_markup: JSON.stringify(keyboard) }
  );
  console.log(`[bot] purchase initiated by @${username || userId} for ${platformKey}`);
}