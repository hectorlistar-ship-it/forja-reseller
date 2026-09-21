import 'dotenv/config';
import { verifyPayments, markEmailsSeen } from '../src/gmail.js';
import { parseBinanceEmail } from '../src/parser.js';
import { sendCallback, fetchMailboxes } from '../src/worker-client.js';

// One-shot run of the exact bridge cycle: fetch vendor mailboxes from the
// worker -> IMAP search -> parse -> worker callback -> mark seen.
const WORKER_CALLBACK_URL = process.env.WORKER_CALLBACK_URL!;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN!;

const mailboxes = await fetchMailboxes(WORKER_CALLBACK_URL, BRIDGE_TOKEN);
console.log('MAILBOXES:', mailboxes.length);
if (mailboxes.length === 0) {
  console.log('No vendor mailboxes configured yet');
  process.exit(0);
}

let totalPayments = 0;
for (const mailbox of mailboxes) {
  try {
    const payments = await verifyPayments(mailbox);
    totalPayments += payments.length;
    console.log(`FOUND (${mailbox.gmail_user}):`, payments.length);
    const seenUids: number[] = [];
    for (const p of payments) {
      const parsed = parseBinanceEmail(p.body);
      console.log('PARSED:', JSON.stringify(parsed));
      if (!parsed) { seenUids.push(p.uid); continue; }
      const res = await sendCallback(WORKER_CALLBACK_URL, BRIDGE_TOKEN, {
        store_id: String(p.storeId),
        client_id: p.clientId,
        binance_user: parsed.binanceUser,
        usdt_amount: parsed.amount,
        status: 'verified',
        raw_email: p.body,
      });
      console.log('CALLBACK:', JSON.stringify(res));
      if (res.ok) seenUids.push(p.uid);
    }
    if (seenUids.length > 0) {
      console.log('MARKING SEEN:', seenUids);
      await markEmailsSeen(mailbox, seenUids);
      console.log('DONE');
    }
  } catch (err) {
    console.error(`ERROR for mailbox ${mailbox.gmail_user}:`, err);
  }
}
console.log('TOTAL PAYMENTS:', totalPayments);
