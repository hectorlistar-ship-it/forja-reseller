import 'dotenv/config';
import { verifyPayments, markEmailsSeen } from '../src/gmail.js';
import { parseBinanceEmail } from '../src/parser.js';
import { sendCallback } from '../src/worker-client.js';

// One-shot run of the exact bridge cycle: IMAP search -> parse -> worker callback.
const payments = await verifyPayments();
console.log('FOUND:', payments.length);
const seenUids: number[] = [];
for (const p of payments) {
  const parsed = parseBinanceEmail(p.body);
  console.log('PARSED:', JSON.stringify(parsed));
  if (!parsed) { seenUids.push(p.uid); continue; }
  const res = await sendCallback(
    process.env.WORKER_CALLBACK_URL!,
    process.env.BRIDGE_TOKEN!,
    {
      store_id: p.storeId,
      client_id: p.clientId,
      binance_user: parsed.binanceUser,
      usdt_amount: parsed.amount,
      status: 'verified',
      raw_email: p.body,
    }
  );
  console.log('CALLBACK:', JSON.stringify(res));
  if (res.ok) seenUids.push(p.uid);
}
if (seenUids.length > 0) {
  console.log('MARKING SEEN:', seenUids);
  await markEmailsSeen(seenUids);
  console.log('DONE');
}
