/**
 * The single source of the JWT signing secret.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * Four modules previously did:
 *
 *     const SECRET = process.env.JWT_SECRET || 'tnr_secret';
 *
 * The repository is public (github.com/tnrorg/mytnrorg), so that fallback was
 * a published signing key. If JWT_SECRET were ever unset on a deployment,
 * anyone could read the literal, mint a token claiming
 * { sub, username, role: 'super_admin' } and hold full admin access to every
 * member record — with no brute force, no login, and nothing in the audit log
 * to distinguish it from a real session.
 *
 * A missing secret must therefore stop the process, not silently substitute a
 * known one. Failing closed on boot is loud and recoverable; failing open is
 * silent and is not.
 *
 * Development keeps a warning rather than a crash so a fresh clone still runs,
 * but the value is random per process — tokens do not survive a restart, which
 * is correct for a machine that has not been configured.
 */
let cached = null;

export function jwtSecret() {
  if (cached) return cached;

  const fromEnv = process.env.JWT_SECRET;

  if (fromEnv && fromEnv.length >= 32) {
    cached = fromEnv;
    return cached;
  }

  if (process.env.NODE_ENV === 'production') {
    // Deliberately fatal. A production deployment without a real secret is not
    // a degraded service, it is an open door.
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. ' +
      'Set a long random value in the deployment environment. ' +
      'Refusing to sign tokens with a weak or absent secret.'
    );
  }

  if (fromEnv) {
    console.warn('[auth] JWT_SECRET is shorter than 32 characters — use a longer value.');
    cached = fromEnv;
    return cached;
  }

  // No secret in development: random per process, never a shared literal.
  console.warn('[auth] JWT_SECRET is not set. Using a random per-process secret; ' +
    'sessions will not survive a restart. Set JWT_SECRET in .env.local.');
  cached = require('crypto').randomBytes(48).toString('hex');
  return cached;
}
