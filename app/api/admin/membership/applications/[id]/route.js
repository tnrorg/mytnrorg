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
      // Carried across at approval. Without this the typed words are left
      // behind on the application row and the approved member shows the bare
      // option label instead of what they wrote.
      gender_self_described: app.gender_self_described ?? null,
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
      /* Membership type at approval.
       *
       * Defaults to `general`, NEVER to what the applicant asked for.
       *
       * It used to fall back to `applied_role`, so an admin who simply pressed
       * Approve granted whatever the person had selected — and people who
       * ticked "Advisory Council" on the form appeared publicly as advisers.
       * The override existed but did nothing unless the admin remembered to
       * use it, which is the wrong way round for a privilege.
       *
       * A leadership role now requires the admin to send it explicitly. The
       * applicant's request is still recorded on the application, so the
       * committee can see what was asked for and grant it deliberately.
       */
      role: ROLE_KEYS.includes(b.role) ? b.role : 'general',
      /* Referral source travels with the applicant.
       *
       * Kept on the member record rather than left behind on the application:
       * the question "where do our members come from?" is about members. Left
       * only on applications it could be asked of everyone who applied — which
       * includes those who were rejected and excludes everyone who joined. */
      heard_about: app.heard_about ?? null,
      heard_about_detail: app.heard_about_detail ?? null,
      referred_by_name: app.referred_by_name ?? null,
      // Identity documents stay in the private bucket; only the paths move.
      cnic_number: app.cnic_number ?? null,
      cnic_front_path: app.cnic_front_path ?? null,
      cnic_back_path: app.cnic_back_path ?? null,
      // The applicant chose their password on the form, so it carries straight
      // over and they can sign in the moment they are approved.
      password_hash: app.password_hash ?? null,
      status: 'active', approved_by: admin.username, approved_at: now, issued_at: now,
      // An invite token is still issued, but only as a recovery path for
      // applications submitted before passwords were collected. When a hash
      // came across, the welcome email carries no set-password link.
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
