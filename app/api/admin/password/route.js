import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { hashPassword, verifyPassword, signAdmin } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* An admin changing THEIR OWN password.
 *
 * WHY THIS EXISTS SEPARATELY FROM ADMIN ACCOUNTS
 *
 * Until now the only way to change an admin password was for a super admin to
 * type a new one into the Admin Accounts screen. That means the super admin
 * then knows it. A credential a second person has typed is not a credential —
 * and it puts an office bearer in the position of having to ask someone else
 * for permission to secure their own account.
 *
 * So: your own password, changed by you, and nobody else sees it.
 *
 * THREE THINGS THIS DOES THAT THE SUPER-ADMIN PATH DOES NOT:
 *
 *   1. It requires the CURRENT password. Otherwise anyone who found an
 *      unlocked laptop could take the account permanently, and the real owner
 *      would be the one locked out.
 *
 *   2. It bumps session_epoch, which signs out every other device instantly.
 *      This is the point of the whole feature: "someone else may have my
 *      password" has to be an action, not a worry. Without it a stolen session
 *      keeps working for its full twelve hours after the password changes.
 *
 *   3. It returns a FRESH TOKEN, so the admin doing the change stays signed in
 *      on this device. Revoking everything including yourself, and then
 *      throwing the person out mid-task, teaches people not to change their
 *      password.
 */
const MIN = 10;

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;

  const b = await readJson(req);
  const current = String(b?.current_password || '');
  const next = String(b?.new_password || '');

  if (!current || !next) {
    return fail('INVALID', 400, { message: 'Enter your current password and the new one.' });
  }

  /* TEN characters, not eight.
   *
   * Eight is the floor the Admin Accounts screen uses, and it is too low for
   * an account that can read every member record. Length is the only property
   * that reliably resists guessing, and this is a handful of people typing it
   * a few times a year — the cost of four more characters is nil. */
  if (next.length < MIN) {
    return fail('WEAK_PASSWORD', 400, {
      message: `Use at least ${MIN} characters. A short phrase you can remember beats a short jumble.`,
    });
  }
  if (next === current) {
    return fail('SAME_PASSWORD', 400, { message: 'That is your current password.' });
  }

  const sb = supabaseAdmin();
  const { data: row, error } = await sb.from('admin_users')
    .select('id, username, full_name, role, password_hash, session_epoch, totp_enabled, scopes')
    .eq('id', admin.sub).maybeSingle();

  if (error || !row) {
    return fail('NOT_FOUND', 404, { message: 'Could not load your account.' });
  }

  /* Verify the CURRENT password against the stored hash.
   *
   * Not against anything in the token: a token proves who signed in twelve
   * hours ago, not who is at the keyboard now. */
  const good = await verifyPassword(current, row.password_hash);
  if (!good) {
    await logAudit({
      action: 'ADMIN_PASSWORD_CHANGE_FAILED', actor: row.username,
      details: 'current password did not match', ip: clientIp(req),
    });
    return fail('WRONG_PASSWORD', 403, { message: 'That is not your current password.' });
  }

  const epoch = Number(row.session_epoch ?? 0) + 1;

  const { error: upErr } = await sb.from('admin_users').update({
    password_hash: await hashPassword(next),
    session_epoch: epoch,
    password_changed_at: new Date().toISOString(),
  }).eq('id', row.id);

  if (upErr) {
    /* The epoch column arrives in migration_admin_password.sql. Say so rather
     * than reporting a generic failure — and do NOT fall back to changing the
     * password without the bump, because that would report "other devices
     * signed out" while leaving them all signed in. */
    const missing = /session_epoch|password_changed_at/.test(upErr.message || '');
    return fail('WRITE_FAILED', 500, {
      message: missing
        ? 'Your password was not changed — the database is not ready for this yet.'
        : 'Your password could not be changed.',
      detail: missing
        ? 'Administrator: run supabase/migration_admin_password.sql.'
        : String(upErr.message || '').slice(0, 160),
    });
  }

  await logAudit({
    action: 'ADMIN_PASSWORD_CHANGED', actor: row.username,
    details: 'self-service; all other sessions revoked', ip: clientIp(req),
  });

  /* A new token carrying the new epoch, so THIS device survives.
   *
   * Minted from the row we just read, with the epoch we just wrote — not from
   * the old claims, which would hand back a token the guard is about to
   * reject. */
  const token = signAdmin({ ...row, session_epoch: epoch });

  return ok({
    token,
    message: 'Password changed. Every other device has been signed out.',
  });
}
