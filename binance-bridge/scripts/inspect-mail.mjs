import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  logger: false,
});

try {
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const msgs = await client.search({ or: [{ from: 'binance.com' }, { from: 'binance' }] }, { uid: true });
    console.log('MATCH from binance*:', JSON.stringify(msgs));
    const searchResults = [];
    searchResults.push({ label: 'ALL UNSEEN (any sender)', value: await client.search({ seen: false }, { uid: true }) });
    console.log('ALL UNSEEN:', JSON.stringify(searchResults[0].value));

    // Fallback: inspect the last 10 messages in inbox regardless of sender
    const last = await client.fetch('1:*', { uid: true, envelope: true, flags: true, internalDate: true }, { uid: false });
    const recent = [];
    for await (const m of last) { recent.push(m); }
    const top = recent.slice(-10);
    console.log('LAST 10 MESSAGES (any sender):');
    for (const m of top) {
      const from = m.envelope ? `${m.envelope.from?.[0]?.address}` : '?';
      const subj = m.envelope ? m.envelope.subject : '?';
      console.log(`  uid=${m.uid} seen=${m.flags?.has('\\Seen')} date=${m.internalDate?.toISOString()} from=${from} subj=${subj}`);
    }
  } finally { lock.release(); }
} finally { await client.logout(); }