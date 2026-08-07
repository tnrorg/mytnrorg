import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { makeInviteToken, inviteExpiry, canLogin } from '@/lib/membership/auth';
import { sendApprovalInvite } from '@/lib/membership/emails';
import { logMembershipAudit } from '@/lib/membership/core';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { data: m } = await sb.from('membership_members').select('*').eq('id', params.id).maybeSingle();
  if (!m) return fail('NOT_FOUND', 404, { message: 'Member not found.' });
  if (!canLogin(m.status)) return fail('BLOCKED', 400, { message: 'This membership is not active.' });

  const token = makeInviteToken();
  await sb.from('membership_members').update({
    invite_token: token, invite_expires_at: inviteExpiry(), invite_sent_at: new Date().toISOString(),
  }).eq('id', m.id);

  try { await sendApprovalInvite(m, token); }
  catch (e) { return fail('EMAIL_FAILED', 502, { message: 'Could not send the email.', detail: e.message }); }

  await logMembershipAudit({
    admin_name: admin.username, action: 'INVITE_RESENT',
    target_type: 'member', target_id: m.membership_id, ip: clientIp(req),
  });
  return ok({ sent: true });
}
