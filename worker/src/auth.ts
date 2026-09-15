import { SignJWT, jwtVerify } from 'jose';
import type { Env } from './config';

export interface JWTPayload {
  sub: string;           // user id
  type: 'superadmin' | 'reseller' | 'client';
  storeId?: number;      // for client
  resellerId?: number;   // for client
  iat: number;
  exp: number;
  jti: string;           // unique token id for revocation
}

export interface UserContext {
  userId: number;
  type: 'superadmin' | 'reseller' | 'client';
  storeId?: number;
  resellerId?: number;
}

const TOKEN_EXPIRY = '1h';
const REFRESH_EXPIRY = '30d';

function getSecretKey(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function createToken(
  env: Env,
  payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>,
  expiresIn: string = TOKEN_EXPIRY
): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresIn)
    .setJti(jti)
    .sign(getSecretKey(env));

  return { token, jti };
}

export async function verifyToken(env: Env, token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(env));
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function createAccessToken(env: Env, user: UserContext): Promise<{ token: string; jti: string }> {
  return createToken(env, {
    sub: String(user.userId),
    type: user.type,
    storeId: user.storeId,
    resellerId: user.resellerId,
  });
}

export async function createRefreshToken(env: Env, user: UserContext): Promise<{ token: string; jti: string }> {
  return createToken(env, {
    sub: String(user.userId),
    type: user.type,
    storeId: user.storeId,
    resellerId: user.resellerId,
  }, REFRESH_EXPIRY);
}

// ============================================
// Password hashing (PBKDF2 + salt via Web Crypto)
// ============================================

const PBKDF2_ITERATIONS = 100_000;

function bufferToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
}

// Stored format: pbkdf2$<iterations>$<saltHex>$<hashHex>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufferToHex(salt)}$${bufferToHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }
  const [, , saltHex, hashHex] = parts;
  const salt = hexToBuffer(saltHex);
  const bits = await deriveBits(password, salt);
  const computedHex = bufferToHex(bits);
  if (computedHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

// Generate secure random token
export function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Extract token from Authorization header
export function extractToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// ============================================
// Middleware factories.
// IMPORTANT: these take NO env argument - env is read from c.env at
// request time, inside the returned closure. Calling them as
// `createAuthMiddleware(c.env)` at module scope (outside a request
// handler) is what used to crash the whole Worker on load, because
// `c` doesn't exist there.
// ============================================

export function createAuthMiddleware() {
  return async (c: any, next: any) => {
    const token = extractToken(c.req.header('Authorization'));
    if (!token) {
      return c.json({ error: 'Token requerido' }, 401);
    }

    const payload = await verifyToken(c.env, token);
    if (!payload) {
      return c.json({ error: 'Token inválido o expirado' }, 401);
    }

    if (payload.type !== 'client') {
      // superadmin/reseller sessions are tracked for revocation;
      // clients rely on short-lived access tokens instead (high volume).
      const session = await c.env.DB
        .prepare(`SELECT revoked FROM sessions WHERE id = ?`)
        .bind(payload.jti)
        .first();
      if (session && session.revoked) {
        return c.json({ error: 'Sesión revocada' }, 401);
      }
    }

    c.set('user', {
      userId: Number(payload.sub),
      type: payload.type,
      storeId: payload.storeId,
      resellerId: payload.resellerId,
      jti: payload.jti,
    });

    await next();
  };
}

export function requireSuperAdmin() {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user || user.type !== 'superadmin') {
      return c.json({ error: 'Se requiere SuperAdmin' }, 403);
    }
    await next();
  };
}

export function requireReseller() {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user || (user.type !== 'reseller' && user.type !== 'superadmin')) {
      return c.json({ error: 'Se requiere Reseller' }, 403);
    }
    await next();
  };
}

export function requireClient() {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user || user.type !== 'client') {
      return c.json({ error: 'Se requiere cliente autenticado' }, 403);
    }
    await next();
  };
}

// Optional auth - doesn't fail if no token
export function optionalAuth() {
  return async (c: any, next: any) => {
    const token = extractToken(c.req.header('Authorization'));
    if (token) {
      const payload = await verifyToken(c.env, token);
      if (payload) {
        c.set('user', {
          userId: Number(payload.sub),
          type: payload.type,
          storeId: payload.storeId,
          resellerId: payload.resellerId,
          jti: payload.jti,
        });
      }
    }
    await next();
  };
}
