import { supabaseAdmin } from './supabaseServer';

/**
 * Brute-force protection for sign-in endpoints.
 *
 * State lives in Postgres, not memory: every Vercel request may hit a different
 * serverless instance, so an in-process counter resets constantly and protects
 * nothing.
 *
 * Two keys are tracked per attempt — the account being targeted and the calling
 * IP. Locking on the account alone lets one attacker spray a hundred accounts
 * from one machine; locking on IP alone lets a shared village connection lock
 * out everyone behind it. Both, with different thresholds, covers each case
 * without the other's failure mode.
 */
const RULES = {
  user: { max: 5, lockMinutes: 15 },   // one account under attack
  ip:   { max: 20, lockMinutes: 15 },  // one machine spraying many accounts
};
const WINDOW_MINUTES = 15;

const keyFor = (kind, value) => `${kind}:${String(value || '').toLowerCase().trim()}`;

/**
 * Call BEFORE checking the password.
 * @returns {{ blocked: boolean, retryAfter?: number }} seconds remaining
 */
export async function checkLoginAllowed(scope, { username, ip }) {
  const ids = [
    username ? keyFor('user', username) : null,
    ip ? keyFor('ip', ip) : null,
  ].filter(Boolean);
  if (!ids.length) return { blocked: false };

  try {
    const { data, error } = await supabaseAdmin()
      .from('login_attempts')
      .select('identifier, locked_until')
      .eq('scope', scope)
      .in('identifier', ids);

    // Fail OPEN. If the table is missing or the database hiccups, a locked-out
    // admin who cannot reach their own panel is worse than the attack this
    // prevents — the password check still has to pass either way.
    if (error) return { blocked: false };

    const now = Date.now();
    let until = 0;
    for (const r of data || []) {
      const t = r.locked_until ? new Date(r.locked_until).getTime() : 0;
      if (t > now && t > until) until = t;
    }
    if (until) return { blocked: true, retryAfter: Math.ceil((until - now) / 1000) };
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

/** Call after a REJECTED password. Increments both counters, locks on threshold. */
export async function recordLoginFailure(scope, { username, ip }) {
  const targets = [
    username ? ['user', keyFor('user', username)] : null,
    ip ? ['ip', keyFor('ip', ip)] : null,
  ].filter(Boolean);

  const sb = supabaseAdmin();
  const now = new Date();

  for (const [kind, identifier] of targets) {
    const rule = RULES[kind];
    try {
      const { data: row } = await sb.from('login_attempts')
        .select('fails, first_fail, locked_until')
        .eq('scope', scope).eq('identifier', identifier).maybeSingle();

      // Counting resets once the window has elapsed, so five typos spread over
      // a week never accumulate into a lockout.
      const windowOpen = row?.first_fail &&
        (now - new Date(row.first_fail)) < WINDOW_MINUTES * 60_000;

      const fails = (windowOpen ? (row.fails || 0) : 0) + 1;
      const locked_until = fails >= rule.max
        ? new Date(now.getTime() + rule.lockMinutes * 60_000).toISOString()
        : null;

      await sb.from('login_attempts').upsert({
        scope, identifier, fails,
        first_fail: windowOpen ? row.first_fail : now.toISOString(),
        locked_until,
        updated_at: now.toISOString(),
      }, { onConflict: 'scope,identifier' });
    } catch { /* protection is best-effort; never block a login on its failure */ }
  }
}

/** Call after a SUCCESSFUL sign-in — clears that account's counter. */
export async function clearLoginFailures(scope, { username, ip }) {
  const ids = [
    username ? keyFor('user', username) : null,
    ip ? keyFor('ip', ip) : null,
  ].filter(Boolean);
  if (!ids.length) return;
  try {
    await supabaseAdmin().from('login_attempts')
      .delete().eq('scope', scope).in('identifier', ids);
  } catch { /* best effort */ }
}

/**
 * Generic per-IP throttle for endpoints that are expensive or abusable but are
 * not sign-in: password-reset requests, public form submissions, the AI ask
 * endpoint.
 *
 * Reuses the login_attempts table rather than adding another — same shape,
 * same pruning, and one place to look when investigating abuse.
 *
 * @returns {{ blocked: boolean, retryAfter?: number }}
 */
export async function throttle(scope, ip, { max = 5, windowMinutes = 15, lockMinutes = 15 } = {}) {
  if (!ip) return { blocked: false };
  const identifier = `ip:${String(ip).toLowerCase().trim()}`;
  const sb = supabaseAdmin();
  const now = new Date();

  try {
    const { data: row, error } = await sb.from('login_attempts')
      .select('fails, first_fail, locked_until')
      .eq('scope', scope).eq('identifier', identifier).maybeSingle();
    if (error) return { blocked: false };          // fail open — see checkLoginAllowed

    const lockedUntil = row?.locked_until ? new Date(row.locked_until).getTime() : 0;
    if (lockedUntil > now.getTime())
      return { blocked: true, retryAfter: Math.ceil((lockedUntil - now.getTime()) / 1000) };

    const windowOpen = row?.first_fail &&
      (now - new Date(row.first_fail)) < windowMinutes * 60_000;
    const fails = (windowOpen ? (row.fails || 0) : 0) + 1;

    await sb.from('login_attempts').upsert({
      scope, identifier, fails,
      first_fail: windowOpen ? row.first_fail : now.toISOString(),
      locked_until: fails >= max
        ? new Date(now.getTime() + lockMinutes * 60_000).toISOString()
        : null,
      updated_at: now.toISOString(),
    }, { onConflict: 'scope,identifier' });

    if (fails >= max)
      return { blocked: true, retryAfter: lockMinutes * 60 };
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

/** Human wording for the lockout response. */
export function lockoutMessage(retryAfter = 0) {
  const mins = Math.max(1, Math.ceil(retryAfter / 60));
  return `Too many failed sign-in attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}
