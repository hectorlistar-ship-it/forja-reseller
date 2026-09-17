import 'dotenv/config';
import express from 'express';
import { verifyPayments, markEmailsSeen } from './gmail.js';
import { parseBinanceEmail } from './parser.js';
import { sendCallback } from './worker-client.js';

const app = express();
app.use(express.json());

const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN!;
const WORKER_CALLBACK_URL = process.env.WORKER_CALLBACK_URL!;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 120000; // 2 min

// Auth middleware
function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== BRIDGE_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Health check
app.get('/v1/models', (_req, res) => {
  res.json({ object: 'list', data: [{ id: 'binance-bridge', object: 'model' }] });
});

// Health check for UptimeRobot
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'binance-bridge', timestamp: Date.now() });
});

// Manual trigger verification
app.post('/v1/binance/verify', auth, async (req, res) => {
  try {
    const result = await verifyPayments();
    res.json({ checked: result.length, payments: result });
  } catch (err) {
    console.error('[verify] error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Start polling
let isPolling = false;
async function pollLoop() {
  if (isPolling) return;
  isPolling = true;
  try {
    const payments = await verifyPayments();
    const seenUids: number[] = [];
    for (const p of payments) {
      const parsed = parseBinanceEmail(p.body);
      if (!parsed) {
        // Unparseable — mark as seen so we don't reprocess it
        seenUids.push(p.uid);
        continue;
      }
      const res = await sendCallback(WORKER_CALLBACK_URL, BRIDGE_TOKEN, {
        store_id: p.storeId,
        client_id: p.clientId,
        binance_user: parsed.binanceUser,
        usdt_amount: parsed.amount,
        status: 'verified',
        raw_email: p.body
      });
      if (res.ok) seenUids.push(p.uid);
    }
    // Mark emails as read only after all callbacks finished
    if (seenUids.length > 0) {
      await markEmailsSeen(seenUids).catch((err) =>
        console.error('[poll] Error marking emails as read:', err)
      );
    }
  } catch (err) {
    console.error('[poll] error:', err);
  } finally {
    isPolling = false;
    setTimeout(pollLoop, POLL_INTERVAL_MS);
  }
}

// Start server
const PORT = Number(process.env.PORT) || 3456;
app.listen(PORT, () => {
  console.log(`[binance-bridge] listening on port ${PORT}`);
  console.log(`[binance-bridge] polling every ${POLL_INTERVAL_MS / 1000}s`);
  // Initial run after 10s
  setTimeout(pollLoop, 10000);
});