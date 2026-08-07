import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { logMembershipAudit, normalizeEmail, normalizeMobile } from '@/lib/membership/core';
import { SENSITIVE_FIELDS } from '@/lib/membership/profile';

export const dynamic = 'force-dynamic';

// PATCH { action: 'approve' | 'reject', admin_note }
// Approving APPLIES the change to membership_members; rejecting changes nothing.
export async function PATCH(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const ip = clientIp(req);

  const { data: rq } = await sb.from('profile_update_requests').select('*').eq('id', params.id).maybeSingle();
  if (!rq) return fail('NOT_FOUND', 404, { message: 'Request not found.' });
  if (rq.status !== 'pending') return fail('ALREADY', 409, { message: 'This request has already been reviewed.' });
  if (!SENSITIVE_FIELDS.includes(rq.field))
    return fail('BAD_FIELD', 400, { message: 'This field is not approvable.' });

  const now = new Date().toISOString();

  if (b.action === 'approve') {
    const patch = { [rq.field]: rq.requested_value, updated_at: now };
    // Keep normalized duplicate-check columns in step.
    if (rq.field === 'email')  patch.email_normalized  = normalizeEmail(rq.requested_value);
    if (rq.field === 'mobile') patch.mobile_normalized = normalizeMobile(rq.requested_value);

    const { error } = await sb.from('membership_members').update(patch).eq('id', rq.member_id);
    if (error) return fail('APPLY_FAILED', 500, { message: 'Could not apply the change.', detail: error.message });

    await sb.from('profile_update_requests').update({
      status: 'approved', reviewed_by: admin.username, reviewed_at: now, admin_note: b.admin_note || null,
    }).eq('id', rq.id);

    await sb.from('membership_notifications').insert({
      member_id: rq.member_id, title: 'Profile change approved',
      body: `Your requested change to ${rq.field.replace(/_/g, ' ')} has been approved.`,
      link: '/member/profile', category: 'profile',
    }).then(() => {}, () => {});

    await logMembershipAudit({
      admin_name: admin.username, action: 'PROFILE_CHANGE_APPROVED', target_type: 'member',
      target_id: rq.member_id, previous_value: { [rq.field]: rq.current_value },
      new_value: { [rq.field]: rq.requested_value }, ip,
    });
    return ok({ approved: true });
  }

  if (b.action === 'reject') {
    await sb.from('profile_update_requests').update({
      status: 'rejected', reviewed_by: admin.username, reviewed_at: now, admin_note: b.admin_note || null,
    }).eq('id', rq.id);

    await sb.from('membership_notifications').insert({
      member_id: rq.member_id, title: 'Profile change not approved',
      body: b.admin_note || `Your requested change to ${rq.field.replace(/_/g, ' ')} was not approved.`,
      link: '/member/profile', category: 'profile',
    }).then(() => {}, () => {});

    await logMembershipAudit({
      admin_name: admin.username, action: 'PROFILE_CHANGE_REJECTED', target_type: 'member',
      target_id: rq.member_id, new_value: { field: rq.field }, reason: b.admin_note || null, ip,
    });
    return ok({ rejected: true });
  }

  return fail('BAD_ACTION', 400, { message: 'Unknown action.' });
}
