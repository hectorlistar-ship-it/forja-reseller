import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;

export interface UnreadEmail {
  storeId: string;
  clientId: string;
  body: string;
}

export async function verifyPayments(): Promise<UnreadEmail[]> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    logger: false
  });

  await client.connect();

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Binance sends payment emails from several subdomains
      // (donotreply@directmail.binance.com, do-not-reply@ses.binance.com, ...),
      // so match the whole domain and filter by subject below.
      const uids = await client.search({ from: 'binance.com', seen: false }, { uid: true });
      if (uids === false) return [];

      const PAYMENT_SUBJECT = /pago recibido|payment received|pago completado|payment completed/i;

      const emails: UnreadEmail[] = [];
      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(uid, { source: true, uid: true, envelope: true });
          if (!msg || !msg.source) continue;

          const subject = msg.envelope?.subject || '';
          if (!PAYMENT_SUBJECT.test(subject)) {
            // Skip marketing / non-payment emails without marking them as read
            continue;
          }

          const parsed = await simpleParser(msg.source);
          const body = parsed.text || parsed.html || '';
          emails.push({ storeId: process.env.STORE_ID || 'default', clientId: 'default', body });
          await client.messageFlagsAdd(uid, ['\\Seen']);
        } catch (err) {
          console.error('[gmail] Error reading email uid', uid, ':', err);
        }
      }

      console.log(`[gmail] Found ${emails.length} unread Binance emails`);
      return emails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}