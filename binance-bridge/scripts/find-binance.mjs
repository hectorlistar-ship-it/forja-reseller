import 'dotenv/config';
import { ImapFlow } from 'imapflow';

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
    const range = '34424,34440,34442,34457,34464,34472,34474,34475,34479,34483';
    const msgs = await client.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true });
    for await (const m of msgs) {
      console.log(`UID=${m.uid} seen=${m.flags?.has('\\Seen')} date=${m.internalDate?.toISOString()} from=${m.envelope?.from?.[0]?.address || '?'} name=${m.envelope?.from?.[0]?.name || '?'} subj=${m.envelope?.subject}`);
    }
  } finally { lock.release(); }
} finally { await client.logout(); }