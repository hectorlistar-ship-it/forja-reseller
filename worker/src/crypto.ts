import type { Env } from './config';

// Encrypts/decrypts account credentials (the streaming account passwords
// stored in the `accounts` table) at rest, using AES-GCM with a key
// provided via the ENCRYPTION_KEY secret (32 random bytes, base64-encoded).
//
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// then: wrangler secret put ENCRYPTION_KEY

let cachedKey: CryptoKey | null = null;
let cachedKeyRaw: string | null = null;

async function getKey(env: Env): Promise<CryptoKey> {
  const raw = env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY no está configurada (wrangler secret put ENCRYPTION_KEY)');
  }
  if (cachedKey && cachedKeyRaw === raw) return cachedKey;

  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser 32 bytes en base64 (256 bits)');
  }
  cachedKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  cachedKeyRaw = raw;
  return cachedKey;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Stored format: "enc:v1:<ivBase64>:<ciphertextBase64>"
const PREFIX = 'enc:v1:';

export async function encryptSecret(env: Env, plaintext: string): Promise<string> {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return `${PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(cipherBuf))}`;
}

export async function decryptSecret(env: Env, stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) {
    // Not encrypted (e.g. data inserted before this feature existed) -
    // return as-is instead of throwing, so old rows don't break delivery.
    return stored;
  }
  const rest = stored.slice(PREFIX.length);
  const [ivB64, cipherB64] = rest.split(':');
  const key = await getKey(env);
  const iv = fromBase64(ivB64);
  const cipherBuf = fromBase64(cipherB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}
