import 'dotenv/config';
import { ImapFlow } from 'imapflow';

// Remove \Seen flag from UID 34483 so the bridge can reprocess it.
const uid = 34483;
const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  logger: false,
  socketTimeout: 30000,
});
await client.connect();
try {
  const lock = await client.getMailboxLock('INBOX');
  try {
    await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
    console.log('UID', uid, '\\Seen removed successfully');
  } finally {
    lock.release();
  }
} finally {
  await client.logout();
}
