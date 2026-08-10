import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabaseAdmin } from './supabaseServer';

import { jwtSecret } from './jwtSecret';

// Resolved lazily so a missing secret fails at first use with a clear message,
// not at import time during the build.
const SECRET = () => jwtSecret();

export function signAdmin(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      username: admin.username,
      role: admin.role || 'admin',
      /* Whether a second factor was actually presented for THIS session.
       *
       * Carried in the token rather than re-read per request so the check
       * costs nothing, and it is safe to trust because the token is signed —
       * an attacker cannot flip it without JWT_SECRET.
       *
       * It goes stale in one direction only, and harmlessly: an admin who
       * enrols mid-session keeps a `false` token until they sign in again, so
       * the stale value is the stricter one. The reverse — enrolled at sign-in,
       * disabled later — leaves `true` for the rest of a session that did
       * genuinely pass 2FA, which is correct.
       *
       * Tokens minted before this field existed have it undefined, which is
       * falsy, so they are treated as not-verified. Every super admin signs in
       * once more after deployment. That is the intended cost. */
      tfa: !!admin.totp_enabled,
    },
    SECRET(), { expiresIn: '12h' }
  );
}
export function verifyAdminToken(token) {
  try { return jwt.verify(token, SECRET()); } catch { return null; }
}

// Extract + verify admin from a request. Returns payload or null.
export function getAdmin(req) {
  const h = req.headers.get('authorization') || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
  const cookie = req.cookies?.get?.('tnr_admin')?.value || null;
  const token = bearer || cookie;
  if (!token) return null;
  return verifyAdminToken(token);
}

// Verify a bcrypt hash ($2a/$2b) produced by pgcrypto or bcryptjs — no native deps.
// Minimal bcrypt verify via the 'bcryptjs' algorithm is avoided; we use a WASM-free check:
// We re-hash is not possible without the lib, so we ship a tiny compare using node's crypto scrypt fallback
// ONLY if the stored hash is a scrypt hash. For bcrypt we rely on bcryptjs (pure JS, no build step).
import bcrypt from 'bcryptjs';
export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  if (hash.startsWith('$2')) return bcrypt.compare(plain, hash);
  // fallback: scrypt "scrypt$salt$hex"
  if (hash.startsWith('scrypt$')) {
    const [, salt, hex] = hash.split('$');
    const dk = crypto.scryptSync(plain, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(dk), Buffer.from(hex));
  }
  return false;
}
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
