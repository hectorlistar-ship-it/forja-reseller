import { createDb } from './db/client';
import * as queries from './db/queries';
import { decryptSecret } from './crypto';
import { sendAllPromos } from './bot/routes';

// Horarios de publicación diaria (hora local de la tienda):
const SLOT_1 = { h: 8, m: 30 };
const SLOT_2 = { h: 14, m: 0 };

function slotKeyFor(now: Date, tzOffsetMin: number): { key: string; slot: string } {
  // Convierte la hora actual a la zona horaria de la tienda
  const local = new Date(now.getTime() + tzOffsetMin * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const yyyymmdd = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;

  if (hh === '08' && mm === '30') return { key: `${yyyymmdd}:0830`, slot: '0830' };
  if (hh === '14' && mm === '00') return { key: `${yyyymmdd}:1400`, slot: '1400' };
  return { key: '', slot: '' };
}

// Ejecutado por el cron de Cloudflare (cada 5 min). Publica promos en los chats
// de cada tienda activa a las 08:30 y 14:00 hora local de la tienda, una vez por slot.
export async function runPromoScheduler(env: any) {
  const db = createDb(env);
  const now = new Date();

  try {
    const rows: any[] = await queries.listAllPromoChats(db);
    if (rows.length === 0) return { sent: 0 };

    let sent = 0;
    // agrupar por tienda (el chat puede repetirse si hay varios; usamos set)
    const seen = new Set<string>();
    for (const row of rows) {
      const tz = Number(row.promo_timezone ?? -180);
      const { key } = slotKeyFor(now, tz);
      if (!key) continue; // no es hora de ningun slot

      const dedup = `${row.store_id}:${row.chat_id}:${key}`;
      if (seen.has(dedup)) continue;
      if (row.last_sent_key === key) continue; // ya publicado este slot
      seen.add(dedup);

      // resolver el token del bot del vendedor (o el dueño como fallback)
      let botToken: string | null = null;
      if (row.bot_token) {
        botToken = await decryptSecret(env, row.bot_token).catch(() => null);
      }
      if (!botToken) botToken = env.TELEGRAM_BOT_TOKEN || null;
      if (!botToken) continue;

      const store = { id: row.store_id, slug: row.slug };
      const count = await sendAllPromos(env, botToken, store, row.chat_id).catch((e: any) => {
        console.error('[promo-scheduler] error enviando a', row.chat_id, e);
        return 0;
      });
      if (count > 0) {
        await queries.markPromoChatSent(db, row.store_id, row.chat_id, key);
      }
      sent += count;
    }
    console.log(`[promo-scheduler] ${sent} promos publicadas en ${now.toISOString()}`);
    return { sent, at: now.toISOString() };
  } catch (e) {
    console.error('[promo-scheduler] error cron:', e);
    return { sent: 0, error: String(e) };
  }
}

export async function scheduled(event: any, env: any, ctx: any) {
  if (event.cron) {
    ctx.waitUntil(runPromoScheduler(env));
  }
}