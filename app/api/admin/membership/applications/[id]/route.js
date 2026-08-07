import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ROLE_KEYS } from '@/lib/membership/roles';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { generateMembershipId, logMembershipAudit } from '@/lib/membership/core';
import { makeInviteToken, inviteExpiry } from '@/lib/membership/auth';
import { sendApprovalInvite, sendRejection } from '@/lib/membership/emails';

export const dynamic = 'force-dynamic';

// PATCH — approve / reject / request correction / add notes.
// Approval is the ONLY path that creates a member and a Membership ID.
export async function PATCH(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const id = params.id;
  const b = await readJson(req);
  const action = b.action;
  const ip = clientIp(req);

  const { data: app } = await sb.from('membership_applications').select('*').eq('id', id).maybeSingle();
  if (!app) return fail('NOT_FOUND', 404, { message: 'Application not found.' });

  const audit = (act, extra = {}) => logMembershipAudit({
    admin_name: admin.username, action: act, target_type: 'application',
    target_id: app.reference_no, previous_value: { status: app.status },
    reason: b.reason || null, ip, ...extra,
  });

  // ── Internal notes only ──
  if (action === 'notes') {
    await sb.from('membership_applications').update({ admin_notes: b.admin_notes || null, updated_at: new Date().toISOString() }).eq('id', id);
    await audit('APPLICATION_NOTE_UPDATED');
    return ok({ updated: true });
  }

  // ── Approve → create member + Membership ID (transactional-ish, guarded) ──
  if (action === 'approve') {
    if (app.status === 'approved') return fail('ALREADY', 409, { message: 'This application is already approved.' });

    // guard: never create a second member for the same email
    const { data: exists } = await sb.from('membership_members')
      .select('id, membership_id').eq('email_normalized', app.email_normalized).is('deleted_at', null).limit(1);
    if (exists && exists.length)
      return fail('DUPLICATE', 409, { message: `A member already exists for this email (${exists[0].membership_id}).` });

    // The membership number IS the reference the applicant was given on
    // submission — reused, not regenerated. Issuing a second number here would
    // mean someone is quoted TNR-MN-0019 when they apply and carries
    // TNR-MN-0027 as a member, which makes every support enquiry a lookup.
    //
    // A number is only generated if the application somehow has no reference,
    // which can happen for rows created before the single series, or if the
    // reference update failed at submission.
    const membership_id = /^TNR-MN-\d+$/.test(app.reference_no || '')
      ? app.reference_no
      : await generateMembershipId();
    const inviteTok = makeInviteToken();
    const now = new Date().toISOString();
    const { data: member, error: insErr } = await sb.from('membership_members').insert({
      membership_id, application_id: app.id,
      first_name: app.first_name, last_name: app.last_name, gender: app.gender,
      photo_url: app.photo_url, email: app.email, email_normalized: app.email_normalized,
      date_of_birth: app.date_of_birth,
      mobile: app.mobile, mobile_normalized: app.mobile_normalized,
      village: app.village, union_council: app.union_council,
      // Carried across so the member record is complete without re-typing.
      // `?? null` rather than `||`: these columns only exist after
      // migration_address_organization.sql, and an older application row
      // simply has no value for them.
      current_country: app.current_country ?? null,
      current_country_code: app.current_country_code ?? null,
      current_state_province: app.current_state_province ?? null,
      current_state_code: app.current_state_code ?? null,
      current_city: app.current_city ?? null,
      organization_name: app.organization_name ?? null,
      profession: app.profession ?? null,
      profession_other: app.profession_other ?? null,
      education_level: app.education_level, field_of_study: app.field_of_study,
      current_position: app.current_position, contribution_areas: app.contribution_areas,
      whatsapp_opt_in: app.whatsapp_opt_in,
      category_id: b.category_id || null,
      // The admin confirms the role at approval. It defaults to whatever the
      // applicant asked for, but the admin can override — that is the control
      // that stops anyone self-appointing to a leadership body.
      role: ROLE_KEYS.includes(b.role) ? b.role : (ROLE_KEYS.includes(app.applied_role) ? app.applied_role : 'general'),
      status: 'active', approved_by: admin.username, approved_at: now, issued_at: now,
      invite_token: inviteTok, invite_expires_at: inviteExpiry(), invite_sent_at: now,
    }).select('*').single();
    if (insErr) return fail('APPROVE_FAILED', 500, { message: 'Could not create the member record.', detail: insErr.message });

    await sb.from('membership_applications').update({
      status: 'approved', member_id: member.id, reviewed_by: admin.username,
      reviewed_at: now, admin_message: b.message || null, updated_at: now,
    }).eq('id', id);

    await sb.from('membership_status_history').insert({
      member_id: member.id, application_id: app.id, from_status: app.status,
      to_status: 'approved', reason: b.reason || 'Approved by admin', changed_by: admin.username,
    });
    await audit('APPLICATION_APPROVED', { new_value: { membership_id: member.membership_id } });

    // Password-setup invitation (not an OTP). Failure to email must not undo approval.
    let invited = true;
    try { await sendApprovalInvite(member, inviteTok); }
    catch (e) { invited = false; await audit('INVITE_EMAIL_FAILED', { reason: e.message }); }

    return ok({ approved: true, membership_id: member.membership_id, invited });
  }

  // ── Reject / correction / withdraw ──
  const map = { reject: 'rejected', correction: 'correction_requested', review: 'under_review' };
  const to = map[action];
  if (!to) return fail('BAD_ACTION', 400, { message: 'Unknown action.' });
  if (action === 'reject' && !String(b.reason || '').trim())
    return fail('REASON_REQUIRED', 400, { message: 'A reason is required when rejecting an application.' });

  const now = new Date().toISOString();
  await sb.from('membership_applications').update({
    status: to, reviewed_by: admin.username, reviewed_at: now,
    admin_message: b.message || b.reason || null, updated_at: now,
  }).eq('id', id);
  await sb.from('membership_status_history').insert({
    application_id: app.id, from_status: app.status, to_status: to,
    reason: b.reason || null, changed_by: admin.username,
  });
  await audit(`APPLICATION_${to.toUpperCase()}`, { new_value: { status: to } });
  if (action === 'reject') { try { await sendRejection(app, b.reason); } catch {} }

  return ok({ updated: true, status: to });
}
