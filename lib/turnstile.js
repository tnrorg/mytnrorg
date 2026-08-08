/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Works regardless of where the site's DNS points; it is a script tag plus this
 * check, not a network-level product. That is why it suits a Vercel-hosted site
 * whose domain is not proxied through Cloudflare.
 *
 * Disabled cleanly when the keys are absent, so a deployment without them
 * behaves exactly as before rather than locking everyone out of sign-in.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * @returns {{ ok: boolean, reason?: string }}
 */
export async function verifyTurnstile(token, ip) {
  if (!turnstileEnabled()) return { ok: true };          // not configured — skip
  if (!token) return { ok: false, reason: 'Please complete the security check.' };

  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: String(token),
    });
    if (ip) body.set('remoteip', ip);

    // A 10s ceiling: if Cloudflare is slow or unreachable, sign-in should not
    // hang. See the failure decision below.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const data = await res.json();
    if (data.success) return { ok: true };

    const codes = data['error-codes'] || [];
    // These two mean the widget's token was stale or already used — telling the
    // user to try again is accurate and actionable.
    if (codes.includes('timeout-or-duplicate'))
      return { ok: false, reason: 'The security check expired. Please try again.' };

    return { ok: false, reason: 'Security check failed. Please reload the page and try again.' };
  } catch {
    // Fail OPEN on a network error. Turnstile is a bot filter layered on top of
    // the password check and the rate limiter — neither of which is bypassed
    // here. Locking every member out because Cloudflare had an outage would be
    // a worse failure than letting a bot reach the password prompt.
    return { ok: true };
  }
}
