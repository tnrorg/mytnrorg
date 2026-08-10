import crypto from 'crypto';
import { jwtSecret } from './jwtSecret';

/* Time-based one-time passwords (RFC 6238) for admin sign-in.
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN A DEPENDENCY
 * TOTP is HMAC-SHA1 plus a documented truncation — about forty lines, fully
 * specified, and testable against the vectors published in the RFC itself
 * (see `selfTest()` at the bottom, exercised by scripts/test-totp.js). That is
 * a different proposition from writing a cipher. Given the project is already
 * carrying one dependency with unfixable advisories, not adding another to
 * implement a published table lookup is the better trade.
 *
 * WHAT AN ATTACKER GETS FROM THE DATABASE
 * Nothing usable. The shared secret is the whole of the second factor — a
 * plaintext `totp_secret` column would mean a database leak silently defeats
 * 2FA for every admin, and nobody would know to re-enrol. So secrets are
 * sealed with AES-256-GCM under a key derived from JWT_SECRET, which lives in
 * the deployment environment and never in Postgres. Compromising the database
 * alone is not enough; an attacker needs the environment as well.
 */

// ── base32, RFC 4648 ────────────────────────────────────────────────────────
// Authenticator apps speak base32, not hex — the alphabet avoids characters a
// human retypes wrongly (no 0/O, no 1/I).
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  // Padding and spacing are stripped: apps display the key in groups of four
  // and people paste it back with the spaces still in.
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ── the algorithm ───────────────────────────────────────────────────────────
export const STEP_SECONDS = 30;
const DIGITS = 6;

export function currentStep(atMs = Date.now()) {
  return Math.floor(atMs / 1000 / STEP_SECONDS);
}

/** The code for one specific time step. `secret` is a Buffer of raw bytes. */
export function codeForStep(secret, step) {
  // Counter is a big-endian 64-bit integer. Node has no portable 64-bit int
  // write for values this size in older runtimes, so the halves are written
  // separately — `step` never exceeds 2^53 for any date this software will see.
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  counter.writeUInt32BE(step >>> 0, 4);

  const hmac = crypto.createHmac('sha1', secret).update(counter).digest();

  // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte picks
  // where in the digest to read from, so the code depends on the whole hash.
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Verify a code, allowing for clock drift.
 *
 * `window: 1` accepts the previous, current and next step — 90 seconds total.
 * That is the usual setting: phone clocks drift, and a code typed at second 29
 * would otherwise fail through no fault of the person typing it. Widening it
 * further would start to matter: each extra step is another valid code an
 * attacker gets to guess against.
 *
 * `after` is the last step this account already consumed. A code is refused if
 * it is not strictly newer, which is what stops the same six digits being
 * replayed inside their own validity window — by someone reading over a
 * shoulder, or by anything that captured the request.
 *
 * Returns the accepted step number, or null.
 */
export function verifyCode(secret, code, { window = 1, atMs = Date.now(), after = 0 } = {}) {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== DIGITS) return null;

  const now = currentStep(atMs);
  for (let d = -window; d <= window; d++) {
    const step = now + d;
    if (step <= after) continue;              // already used — replay
    const expected = codeForStep(secret, step);
    // Constant-time: a fast reject on the first differing digit would leak,
    // over enough attempts, how much of a guess was right.
    const a = Buffer.from(expected), b = Buffer.from(clean);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return step;
  }
  return null;
}

// ── enrolment ───────────────────────────────────────────────────────────────
/** A fresh 20-byte secret, base32 encoded — the length RFC 4226 recommends. */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/**
 * The `otpauth://` URI an authenticator app reads from a QR code.
 * `issuer` shows as the account heading in the app, so it should say TNR
 * rather than the hostname — an admin with several codes needs to tell them
 * apart at a glance.
 */
export function otpauthUri({ secret, account, issuer = 'TNR Digital Community Platform' }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  // URLSearchParams encodes a space as "+", which is correct for form bodies
  // and wrong here — several authenticator apps show the plus sign literally,
  // so the account reads "TNR+Digital+Community+Platform".
  return `otpauth://totp/${label}?${params.toString().replace(/\+/g, '%20')}`;
}

// ── secret encryption at rest ───────────────────────────────────────────────
// HKDF gives a distinct 32-byte key for this one purpose, so the TOTP key and
// the JWT signing key are not the same value used twice. Rotating JWT_SECRET
// therefore invalidates enrolled secrets — deliberate, and documented in the
// migration: everyone re-enrols, which is the correct outcome after a rotation.
function encKey() {
  return Buffer.from(
    crypto.hkdfSync('sha256', Buffer.from(jwtSecret()), Buffer.from('tnr-totp-salt-v1'),
      Buffer.from('admin-totp-secret'), 32)
  );
}

export function sealSecret(plainBase32) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plainBase32), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

export function openSecret(sealed) {
  try {
    const [v, iv, tag, ct] = String(sealed || '').split('.');
    if (v !== 'v1' || !iv || !tag || !ct) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch {
    // Wrong key or tampered ciphertext. Callers treat null as "2FA not usable"
    // rather than "2FA passed" — see requireTotpOk in the login route.
    return null;
  }
}

/** Raw secret bytes for an admin row, or null if it cannot be opened. */
export function secretBytes(sealed) {
  const b32 = openSecret(sealed);
  return b32 ? base32Decode(b32) : null;
}

// ── backup codes ────────────────────────────────────────────────────────────
// Ten single-use codes, shown once at enrolment. These are the answer to "my
// phone is gone", and they are the reason 2FA does not become a support
// burden. Stored as HMACs: the database never holds a usable code.
export function generateBackupCodes(n = 10) {
  const codes = [];
  for (let i = 0; i < n; i++) {
    // 5 bytes → 8 base32 characters, shown as XXXX-XXXX. ~40 bits: far beyond
    // guessing when every attempt is rate limited and logged.
    codes.push(base32Encode(crypto.randomBytes(5)).slice(0, 8));
  }
  return codes;
}

export function formatBackupCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function hashBackupCode(code) {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  return crypto.createHmac('sha256', encKey()).update(clean).digest('hex');
}

/**
 * Consume one backup code. Returns the remaining hashes, or null on no match.
 * Single use is the point: a code that stayed valid would be a password that
 * never expires, written on paper.
 */
export function consumeBackupCode(code, hashes) {
  const target = hashBackupCode(code);
  const list = Array.isArray(hashes) ? hashes : [];
  let found = false;
  const remaining = [];
  for (const h of list) {
    if (!found && h && h.length === target.length &&
        crypto.timingSafeEqual(Buffer.from(h), Buffer.from(target))) {
      found = true;                            // drop exactly one match
      continue;
    }
    remaining.push(h);
  }
  return found ? remaining : null;
}

// ── RFC 6238 conformance ────────────────────────────────────────────────────
/* The vectors from RFC 6238 Appendix B, SHA-1 rows. The RFC prints 8 digits;
 * these compare the low 6, which is what a 6-digit token is. If this fails,
 * every authenticator app on earth will disagree with this file. */
export function selfTest() {
  const secret = Buffer.from('12345678901234567890', 'ascii');
  const vectors = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ];
  const failures = [];
  for (const [seconds, expected] of vectors) {
    const got = codeForStep(secret, Math.floor(seconds / STEP_SECONDS));
    if (got !== expected) failures.push({ seconds, expected, got });
  }
  return { pass: failures.length === 0, failures };
}
