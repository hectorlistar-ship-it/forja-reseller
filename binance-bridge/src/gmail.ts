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
      const uids = await client.search({ from: 'noreply@binance.com', seen: false }, { uid: true });
      if (uids === false) return [];

      const emails: UnreadEmail[] = [];
      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(uid, { source: true, uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const body = parsed.text || parsed.html || '';
          emails.push({ storeId: 'default', clientId: 'default', body });
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