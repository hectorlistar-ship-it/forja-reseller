import { Hono } from 'hono';
import type { Env } from '../config';
import { createDb } from '../db/client';
import * as queries from '../db/queries';
import { decryptSecret } from '../crypto';

export const botRoutes = new Hono<{ Bindings: Env; Variables: { user: any } }>();

const WORKER_URL = 'https://forja-reseller.hectorlistar.workers.dev';
const STORE_FRONTEND_URL = 'https://reseller-store.pages.dev';

const EMOJI: Record<string, string> = {
  netflix: '🍿',
  hbo: '📺',
  disney: '✨',
  vix: '📺',
  spotify: '🎵',
  youtube: '▶️',
};

// Resolves which bot token + store handles an update. A vendor that configured
// his own bot token uses his store; otherwise the owner's store/bot is used.
async function resolveBot(c: any) {
  const db = createDb(c.env);
  const requestedStoreId = Number(c.req.param('storeId'));
  let store = Number.isInteger(requestedStoreId) && requestedStoreId > 0
    ? await queries.getStoreById(db, requestedStoreId)
    : await queries.getDefaultStore(db);

  if (!store) store = await queries.getDefaultStore(db);
  if (!store) return { botToken: null as string | null, store: null as any, db };

  let botToken: string | null = null;
  if (store.bot_token) {
    botToken = await decryptSecret(c.env, store.bot_token);
  } else {
    botToken = c.env.TELEGRAM_BOT_TOKEN || null;
  }
  return { botToken, store, db };
}

// Telegram webhook (per-store, e.g. /api/bot/webhook/1)
botRoutes.post('/webhook/:storeId', async (c) => {
  const { botToken, store } = await resolveBot(c);
  const update = await c.req.json();
  if (!botToken || !store) return c.json({ ok: true });

  // inline keyboard handling
  if (update.callback_query) {
    const data = update.callback_query.data;
    const cbChatId = update.callback_query.message.chat.id;
    const cid = update.callback_query.id;
    if (data === 'catalogo') {
      await sendCatalog(c.env, botToken, store, cbChatId);
      await answerCallback(botToken, cid, 'Abriendo catálogo… 🛒');
    } else if (isPromoCallback(data)) {
      await handlePromoCallback(c, botToken, store, cbChatId, data);
      await answerCallback(botToken, cid, 'Publicando promo… 🔥');
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
        [{ text: '🛍️ Comprar', url: CMD_URL(c.env, store.slug, '') }],
      ],
    };
    const msg =
      `🎉 ¡Hola${firstName ? ' ' + firstName : ''}! Bienvenido a *${c.env.BUSINESS_NAME}* 🚀\n\n` +
      `Somos tu tienda de cuentas *Premium* con entrega inmediata.\n\n` +
      `👑 Streamings, música y más al mejor precio.\n` +
      `⚡ Activación al instante.\n` +
      `🛡️ Garantía por tu compra.\n\n` +
      `Pulsa el botón para ver lo que tenemos disponible 👇`;

    await sendTelegramMessage(botToken, chatId, msg, { parse_mode: 'Markdown', reply_markup: JSON.stringify(keyboard) });
    return c.json({ ok: true });
  }

  if (text === '/catalogo' || text === '/catalogo@') {
    await sendCatalog(c.env, botToken, store, chatId);
    return c.json({ ok: true });
  }

  if (text.startsWith('/comprar ')) {
    const platformKey = text.replace('/comprar ', '').trim().toLowerCase();
    await handlePurchase(c, botToken, store, chatId, userId, username, platformKey);
    return c.json({ ok: true });
  }

  if (text === '/miscompras') {
    // TODO: implement per-store
    await sendTelegramMessage(botToken, chatId, 'Función en desarrollo.');
    return c.json({ ok: true });
  }

  if (text === '/ayuda') {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🛒 Ver catálogo', callback_data: 'catalogo' }],
      ],
    };
    await sendTelegramMessage(botToken, chatId,
      `Comandos disponibles:\n` +
      `🏷️ /catalogo - Ver catálogo\n` +
      `🛍️ /comprar <plataforma> - Comprar cuenta\n` +
      `🔥 /promo <plataforma> - Publicar promo del servicio en el grupo\n` +
      `📦 /miscompras - Ver tus compras\n` +
      `❓ /ayuda - Esta ayuda`,
      { reply_markup: JSON.stringify(keyboard) }
    );
    return c.json({ ok: true });
  }

  if (text.startsWith('/promo')) {
    const target = text.replace('/promo', '').trim().toLowerCase();
    // Solo funciona en grupos donde el bot esté agregado
    const chatType = message.chat.type;
    if (chatType !== 'group' && chatType !== 'supergroup') {
      await sendTelegramMessage(botToken, chatId, 'ℹ️ Este comando solo funciona dentro de un grupo donde agregues el bot y seas administrador.');
      return c.json({ ok: true });
    }
    // El vendedor (admin del grupo) es quien puede publicar
    const member = await getChatMember(botToken, chatId, userId);
    if (member !== 'administrator' && member !== 'creator') {
      await sendTelegramMessage(botToken, chatId, '⛔ Solo los administradores del grupo pueden publicar promos (usa /promo para que el bot la muestre).');
      return c.json({ ok: true });
    }
    await handlePromo(c, botToken, store, chatId, target);
    return c.json({ ok: true });
  }

  // Default response
  await sendTelegramMessage(botToken, chatId, 'No entiendo ese comando. Escribe /ayuda para ver comandos.');
  return c.json({ ok: true });
});

function CMD_URL(env: any, slug: string, _platform: string) {
  const storeUrl = env.STORE_URL || STORE_FRONTEND_URL;
  return `${storeUrl}/tienda/${slug}`;
}

async function sendCatalog(env: any, botToken: string, store: any, chatId: number) {
  const db = createDb(env);
  const platforms = await getStorePlatforms(db, store.id);
  if (platforms.length === 0) {
    await sendTelegramMessage(botToken, chatId, 'No hay stock disponible.');
    return;
  }

  const storeUrl = env.STORE_URL || STORE_FRONTEND_URL;
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
  const res = await sendTelegramPhoto(botToken, chatId, bannerUrl, caption, {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({ inline_keyboard: buttons }),
  });
  if (!res) {
    await sendTelegramMessage(botToken, chatId, caption, { parse_mode: 'Markdown' });
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string, options: any = {}) {
  if (!botToken || !chatId) return false;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
  return res.ok;
}

async function answerCallback(botToken: string, callbackQueryId: string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
  return res.ok;
}

async function getChatMember(botToken: string, chatId: number, userId: number): Promise<string | null> {
  if (!botToken || !chatId || !userId) return null;
  const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = await res.json() as any;
    return data?.ok === true ? data.result.status : null;
  } catch {
    return null;
  }
}

async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string, caption: string, options: any = {}) {
  if (!botToken || !chatId) return false;
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
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

async function getStorePlatforms(db: any, storeId: number) {
  const platforms = await queries.getStorePlatforms(db, storeId);
  const inventory = await queries.getInventorySummary(db, storeId);
  return platforms.map((p: any) => {
    const inv = inventory.find((i: any) => i.platform_key === p.platform_key);
    return { ...p, stock: inv?.available ?? 0 };
  });
}

// Publica la tarjeta de promo de un servicio en el grupo: imagen (botón verde
// horneado) + descripción con precio real + botón real de compra directa.
async function handlePromo(c: any, botToken: string, store: any, chatId: number, platformKey: string) {
  const db = createDb(c.env);
  const platforms: any[] = await getStorePlatforms(db, store.id);
  const storeUrl = c.env.STORE_URL || STORE_FRONTEND_URL;
  const storeLink = `${storeUrl}/tienda/${store.slug}`;

  if (platformKey) {
    const p: any = platforms.find((x: any) => x.platform_key === platformKey || x.name?.toLowerCase() === platformKey);
    if (!p) {
      await sendTelegramMessage(botToken, chatId,
        `❌ No encontré *${platformKey}* en tu catálogo.\n\nUsa /promo con uno de estos:\n${platforms.map((x: any) => `• ${x.name}`).join('\n')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    await sendPromoCard(c, botToken, store, chatId, p, storeLink);
    return;
  }

  // Sin argumento: listar plataformas disponibles
  const buttons = platforms.filter((p: any) => p.stock > 0).map((p: any) => ({
    callback_data: `promo:${p.platform_key}`,
    text: `${EMOJI[p.platform_key] || '📦'} ${p.name} — $${p.sale_price_usd} USDT`,
  }));
  if (buttons.length === 0) {
    await sendTelegramMessage(botToken, chatId, 'No tienes servicios con stock para promocionar.');
    return;
  }
  await sendTelegramMessage(botToken, chatId, 'Elige qué servicio publicar en el grupo: 👇', {
    reply_markup: JSON.stringify({ inline_keyboard: buttons }),
  });
}

// Callback_data para promos elegidas desde el teclado inline
function isPromoCallback(data: string): boolean {
  return data.startsWith('promo:');
}

async function handlePromoCallback(c: any, botToken: string, store: any, chatId: number, data: string) {
  const platformKey = data.replace('promo:', '').trim().toLowerCase();
  const db = createDb(c.env);
  const platforms: any[] = await getStorePlatforms(db, store.id);
  const storeUrl = c.env.STORE_URL || STORE_FRONTEND_URL;
  const storeLink = `${storeUrl}/tienda/${store.slug}`;
  const p: any = platforms.find((x: any) => x.platform_key === platformKey);
  if (!p) return;
  await sendPromoCard(c, botToken, store, chatId, p, storeLink);
}

async function sendPromoCard(c: any, botToken: string, store: any, chatId: number, platform: any, storeLink: string) {
  const key = platform.platform_key;
  const emo = EMOJI[key] || '📦';
  const imageKey = platform.promo_image_url
    ? platform.promo_image_url
    : `${WORKER_URL}/promo-${key}.png`;

  const caption =
    `${emo} *${platform.name}* al mejor precio\n\n` +
    `💰 Precio: *$${platform.sale_price_usd} USDT*\n` +
    `📦 Disponibles: *${platform.stock}*\n\n` +
    `⚡ Entrega inmediata y garantizada.\n` +
    `💳 Pagas con USDT y recibes tu cuenta al instante.\n\n` +
    `Pulsa el botón para comprar 👇`;

  const keyboard = {
    inline_keyboard: [
      [{ text: `🛒 COMPRAR ${platform.name.toUpperCase()} — $${platform.sale_price_usd} USDT`, url: storeLink }],
    ],
  };

  const ok = await sendTelegramPhoto(botToken, chatId, imageKey, caption, {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify(keyboard),
  });
  if (!ok && platform.promo_image_url) {
    // El vendedor puso una URL externa rota → ofrecer reenviar con imagen propia
    await sendTelegramMessage(botToken, chatId, `No pude cargar tu imagen personalizada para ${platform.name}. Verifica la URL en tu panel.`);
  }
  console.log(`[bot] promo sent for ${key} in chat ${chatId}`);
}

async function handlePurchase(c: any, botToken: string, store: any, chatId: number, userId: number, username: string | undefined, platformKey: string) {
  const db = createDb(c.env);
  const storeUrl = c.env.STORE_URL || STORE_FRONTEND_URL;
  const storeLink = `${storeUrl}/tienda/${store.slug}`;

  const platform = await db.first(`SELECT * FROM platforms WHERE lower(key) = lower(?)`, [platformKey]);
  const emo = EMOJI[platform?.key] || '📦';

  if (!platform) {
    const keyboard = { inline_keyboard: [[{ text: '🛒 Ver catálogo', callback_data: 'catalogo' }]] };
    await sendTelegramMessage(botToken, chatId,
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

  await sendTelegramMessage(botToken, chatId,
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