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
    const msgs = await client.fetch('34483', { source: true, uid: true, envelope: true }, { uid: true });
    let m = null;
    for await (const x of msgs) { m = x; break; }
    if (!m || !m.source) { console.log('NO SOURCE'); }
    const parsed = await simpleParser(m.source);
    console.log('=== SUBJECT ===');
    console.log(parsed.subject);
    console.log('=== FROM ===');
    console.log(JSON.stringify(parsed.from?.value));
    console.log('=== TEXT (raw) ===');
    console.log(parsed.text || '(no text)');
    if (parsed.html) {
      console.log('=== HTML (stripped length) ===', parsed.html.length);
    }
  } finally { lock.release(); }
} finally { await client.logout(); }