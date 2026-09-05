import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { generateSecret, otpauthUri, sealSecret } from '@/lib/totp';
import { qrDataUri } from '@/lib/qrSvg';

export const dynamic = 'force-dynamic';

/* Begin enrolment: mint a secret, store it sealed, hand back the otpauth URI.
 *
 * The secret is written with `totp_enabled` left false. Enrolment is not
 * finished until the admin proves they can produce a code from it — see
 * /confirm. Enabling on issue would lock out anyone whose scan silently
 * failed, which is the classic way to make an admin panel unreachable.
 */
export async function POST(req) {
  const { admin: claims, res } = await requireAdmin(req);
  if (res) return res;

  const sb = supabaseAdmin();
  const { data: admin, error } = await sb.from('admin_users')
    .select('id, username, totp_enabled').eq('id', claims.sub).maybeSingle();

  if (error || !admin) return fail('NOT_FOUND', 404, { message: 'Account not found.' });

  /* Refuse to re-issue over a working enrolment.
   *
   * Otherwise anyone holding a live admin session — including a stolen one —
   * could quietly swap the second factor to a device they own, and the real
   * admin would only find out at their next sign-in. Replacing an active
   * enrolment goes through /disable first, which asks for the password. */
  if (admin.totp_enabled) {
    return fail('ALREADY_ENABLED', 409, {
      message: 'Two-factor authentication is already active. Turn it off first to enrol a new device.',
    });
  }

  const secret = generateSecret();
  const { error: saveErr } = await sb.from('admin_users')
    .update({ totp_secret_enc: sealSecret(secret), totp_last_step: 0 })
    .eq('id', admin.id);

  if (saveErr) {
    console.error('[2fa setup] save failed:', saveErr.message);
    return fail('SAVE_FAILED', 500, {
      message: 'Could not start setup. The 2FA migration may not have been run yet.',
    });
  }

  const uri = otpauthUri({ secret, account: admin.username });

  return ok({
    secret,                                    // shown once, for manual entry
    uri,
    // Rendered here rather than in the browser so the QR is identical for
    // everyone, and rendered on OUR server rather than an image service so the
    // secret inside the URI is never sent to a third party. See lib/qrSvg.js.
    qr: qrDataUri(uri, { size: 220 }),
    issuer: 'TNR Digital Community Platform',
    account: admin.username,
  });
}
