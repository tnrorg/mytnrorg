import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, readJson } from '@/lib/api';
import { normalizeEmail } from '@/lib/membership/core';
import { makeInviteToken, inviteExpiry, canLogin } from '@/lib/membership/auth';
import { sendPasswordReset } from '@/lib/membership/emails';
import { logMembershipAudit } from '@/lib/membership/core';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const b = await readJson(req);
  const email = normalizeEmail(b.email);
  const sb = supabaseAdmin();
  const { data: rows } = await sb.from('membership_members')
    .select('*').eq('email_normalized', email).is('deleted_at', null).limit(1);
  const m = rows && rows[0];

  // Always answer the same way — never reveal whether an account exists.
  const GENERIC = ok({ sent: true,
    message: 'If an account exists for that email, a password reset link has been sent.' });

  // The reply is always identical, but the REASON is recorded so an admin can
  // tell "no such account" from "SMTP is down" — previously both looked the
  // same from every angle, including the server logs.
  if (!m || !canLogin(m.status)) {
    await logMembershipAudit({
      admin_name: 'system', action: 'PASSWORD_RESET_SKIPPED', target_type: 'member',
      target_id: email,
      reason: !m ? 'No account for that email' : `Account status is ${m.status}`,
    }).catch(() => {});
    return GENERIC;
  }

  const token = makeInviteToken();
  await sb.from('membership_members').update({
    invite_token: token, invite_expires_at: inviteExpiry(), invite_sent_at: new Date().toISOString(),
  }).eq('id', m.id);
  try {
    await sendPasswordReset(m, token);
    await logMembershipAudit({
      admin_name: 'system', action: 'PASSWORD_RESET_SENT', target_type: 'member',
      target_id: m.membership_id, reason: null,
    }).catch(() => {});
  } catch (e) {
    // Swallowing this silently is what made a broken mail server invisible.
    // The applicant still sees the same generic reply — telling them the
    // address exists would defeat the point — but the failure is now recorded.
    console.error('[forgot-password] email failed for', m.membership_id, e?.message);
    await logMembershipAudit({
      admin_name: 'system', action: 'PASSWORD_RESET_FAILED', target_type: 'member',
      target_id: m.membership_id, reason: `Email send failed: ${e?.message || 'unknown error'}`,
    }).catch(() => {});
  }
  return GENERIC;
}
