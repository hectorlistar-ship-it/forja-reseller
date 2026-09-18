import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { MailBox } from './worker-client.js';

export interface UnreadEmail {
  storeId: number;
  clientId: string;
  uid: number;
  body: string;
}

// Exact Binance sender addresses. Gmail resolves exact FROM lookups via its
// index in milliseconds; a substring/domain FROM search hangs for minutes on
// large mailboxes, so never search by partial domain here.
const BINANCE_SENDERS = [
  'donotreply@directmail.binance.com',
  'do-not-reply@ses.binance.com',
  'do_not_reply@smailer2.binance.com',
  'noreply@binance.com',
  'do-not-reply@binance.com',
];

const PAYMENT_SUBJECT = /pago recibido|payment received|pago completado|payment completed/i;
const BINANCE_DOMAIN = /@[^@]*binance\.com$/i;

// Only look at recent mail: pending orders are always fresh, and bounding by
// date keeps the candidate set small (big unread backlogs make Gmail crawl).
const SINCE_DAYS = 14;

async function openInbox(mailbox: MailBox): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: mailbox.gmail_user, pass: mailbox.gmail_app_password },
    logger: false,
    // Fail fast instead of hanging forever on slow Gmail responses
    socketTimeout: 90000,
  });
  await client.connect();
  return client;
}

export async function verifyPayments(mailbox: MailBox): Promise<UnreadEmail[]> {
  const client = await openInbox(mailbox);

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // One exact-sender search per known address (fast, indexed).
      // Run them in parallel and union the UIDs.
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 3600 * 1000);
      const searches = BINANCE_SENDERS.map((from) =>
        client
          .search({ from, seen: false, since }, { uid: true })
          .then((found) => (Array.isArray(found) ? found : ([] as number[])))
          .catch((err) => {
            console.error('[gmail] Search failed for sender', from, ':', err);
            return [] as number[];
          })
      );
      const uidSet = new Set<number>((await Promise.all(searches)).flat());
      const uids = [...uidSet];
      if (uids.length === 0) {
        console.log(`[gmail] ${mailbox.gmail_user}: 0 unread Binance emails`);
        return [];
      }
      console.log(`[gmail] ${mailbox.gmail_user}: ${uids.length} unread candidates, fetching envelopes...`);

      // Batch envelope fetch (ONE round trip per chunk) instead of one
      // fetchOne per UID — mailboxes with hundreds of unread Binance
      // marketing emails would otherwise take many minutes.
      const candidateUids: number[] = [];
      const CHUNK = 200;
      for (let i = 0; i < uids.length; i += CHUNK) {
        const range = uids.slice(i, i + CHUNK).join(',');
        const msgs = await client.fetch(range, { envelope: true, uid: true }, { uid: true });
        for await (const m of msgs) {
          if (!m.envelope || m.uid === undefined) continue;
          const subject = m.envelope.subject || '';
          const fromAddr = m.envelope.from?.[0]?.address || '';
          if (!PAYMENT_SUBJECT.test(subject)) continue;
          if (!BINANCE_DOMAIN.test(fromAddr)) continue;
          candidateUids.push(m.uid);
        }
      }

      const emails: UnreadEmail[] = [];
      for (const uid of candidateUids) {
        try {
          // NOTE: pass { uid: true } so fetchOne treats the value as a
          // UID, not a sequence number.
          const msg = await client.fetchOne(uid, { source: true }, { uid: true });
          if (!msg || !msg.source) continue;

          const parsed = await simpleParser(msg.source);
          const body = parsed.text || parsed.html || '';
          emails.push({ storeId: mailbox.store_id, clientId: 'default', uid, body });
          // Do NOT mark \Seen here — let the caller mark it only after the
          // worker callback succeeds, so the email is retried on failure.
        } catch (err) {
          console.error('[gmail] Error reading email uid', uid, ':', err);
        }
      }

      console.log(`[gmail] ${mailbox.gmail_user}: Found ${emails.length} unread Binance emails`);
      return emails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

/**
 * Mark UIDs as read (\Seen) inside a single IMAP session.
 * Call this only after a successful worker callback to avoid losing emails.
 */
export async function markEmailsSeen(mailbox: MailBox, uids: number[]): Promise<void> {
  if (uids.length === 0) return;
  const client = await openInbox(mailbox);
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for (const uid of uids) {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}