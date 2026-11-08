import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { logMembershipAudit } from '@/lib/membership/core';
import { ROLE_KEYS } from '@/lib/membership/roles';
import { hashPassword } from '@/lib/membership/auth';
import { uploadDataUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
const STATUSES = ['approved', 'active', 'suspended', 'inactive', 'expired'];

// PATCH — status change, category, public visibility.
// Membership ID can never be altered here.
export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const ip = clientIp(req);

  const { data: m } = await sb.from('membership_members').select('*').eq('id', params.id).maybeSingle();
  if (!m) return fail('NOT_FOUND', 404, { message: 'Member not found.' });

  const patch = { updated_at: new Date().toISOString() };
  const notes = [];

  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return fail('BAD_STATUS', 400, { message: 'Unknown status.' });
    if (b.status !== m.status) {
      if (['suspended', 'inactive', 'expired'].includes(b.status) && !String(b.reason || '').trim())
        return fail('REASON_REQUIRED', 400, { message: 'A reason is required for this status change.' });
      patch.status = b.status;
      // Suspending also ends any active session immediately.
      if (b.status !== 'active' && b.status !== 'approved')
        patch.session_epoch = (m.session_epoch || 0) + 1;
      notes.push(`status ${m.status} → ${b.status}`);
    }
  }
  if (b.public_visible !== undefined && !!b.public_visible !== m.public_visible) {
    patch.public_visible = !!b.public_visible;
    notes.push(`public visibility ${patch.public_visible ? 'on' : 'off'}`);
  }
  if (b.category_id !== undefined && b.category_id !== m.category_id) {
    patch.category_id = b.category_id || null;
    notes.push('category changed');
  }
  // Village and Union Council are editable here so an admin can move a member
  // whose area was renamed or misspelled. Without this there was no way to
  // correct a stranded record short of editing the database directly.
  for (const f of ['village', 'union_council']) {
    if (b[f] === undefined) continue;
    const next = String(b[f] || '').trim() || null;
    if (next !== (m[f] || null)) {
      patch[f] = next;
      notes.push(`${f.replace('_', ' ')} ${m[f] || '—'} → ${next || '—'}`);
    }
  }
  if (b.role !== undefined && b.role !== m.role) {
    if (!ROLE_KEYS.includes(b.role)) return fail('BAD_ROLE', 400, { message: 'Unknown membership type.' });
    patch.role = b.role;
    notes.push(`membership type ${m.role || 'general'} → ${b.role}`);
  }

  /* ── Full name ──
     Plain correction of a typo or a married name. Audited like everything
     else, because a name change on a membership record is how an impostor
     would make a stolen account look like their own. */
  if (b.full_name !== undefined) {
    const next = String(b.full_name).trim().replace(/\s+/g, ' ');
    if (!next) return fail('NAME_REQUIRED', 400, { message: 'A name is required.' });
    if (next.length > 120) return fail('NAME_TOO_LONG', 400, { message: 'Keep the name under 120 characters.' });
    if (next !== m.full_name) {
      patch.full_name = next;
      notes.push(`name "${m.full_name}" → "${next}"`);
    }
  }

  /* ── Email ──
     THE SIGN-IN IDENTIFIER, so this is an account-takeover surface and is
     treated as one: normalised, checked for collisions against both the
     member roll AND pending applications, and recorded with the old address
     so the change can be traced back.

     `email_normalized` is what the uniqueness and the login lookup actually
     use — writing `email` alone would leave the member signing in with their
     OLD address and the new one showing on screen, which is the worst of
     both. */
  if (b.email !== undefined) {
    const raw = String(b.email).trim();
    const next = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next))
      return fail('BAD_EMAIL', 400, { message: 'That does not look like an email address.' });

    if (next !== (m.email_normalized || String(m.email || '').toLowerCase())) {
      const { data: clash } = await sb.from('membership_members')
        .select('id, membership_id').eq('email_normalized', next).neq('id', m.id).maybeSingle();
      if (clash) return fail('EMAIL_TAKEN', 409, {
        message: `That email already belongs to member ${clash.membership_id}.` });

      const { data: pending } = await sb.from('membership_applications')
        .select('id').eq('email_normalized', next).maybeSingle();
      if (pending) return fail('EMAIL_PENDING', 409, {
        message: 'That email is on a pending membership application.' });

      patch.email = raw;
      patch.email_normalized = next;
      notes.push(`email ${m.email} → ${raw}`);
    }
  }

  /* ── Password ──
     Set directly by an admin, at the organisation's request, for members who
     cannot be reached by email at all.

     THE PASSWORD ITSELF NEVER LEAVES THIS BLOCK. It is hashed immediately,
     never written to the audit note, never echoed in the response, and never
     logged. What is recorded is only THAT an admin set it, and which admin.

     `session_epoch` is bumped with it, exactly as a suspension does above.
     Without that, anyone already signed in as this member — including whoever
     the member was locked out by — keeps their session and the reset
     achieves nothing. */
  if (b.new_password !== undefined) {
    const pw = String(b.new_password);
    if (pw.length < 8) return fail('WEAK_PASSWORD', 400, {
      message: 'Use at least 8 characters.' });
    if (pw.length > 200) return fail('BAD_PASSWORD', 400, { message: 'That password is too long.' });

    patch.password_hash = await hashPassword(pw);
    patch.session_epoch = (m.session_epoch || 0) + 1;
    /* Any outstanding invite or reset link is now meaningless and must not
       remain usable — otherwise the old link could undo this password. */
    patch.invite_token = null;
    patch.invite_expires_at = null;
    notes.push('password set by admin; signed out of all devices');
  }

  /* Profile photo.
   *
   * There was previously no way for an admin to set this at all. `photo_url`
   * was written once at approval, copied from the application, and after that
   * only the member could change it from their own portal — so a member who
   * applied without a photo, or with a bad one, could not be corrected. The
   * Leadership tab has its own photo field on `leadership_profiles`, which
   * looks like the same thing and is not: editing there never touches the
   * member's directory card, which is exactly how two members ended up
   * "updated" while the directory kept showing the original.
   *
   * Same validation as the member's own upload in /api/member/profile —
   * an admin path should not be the lenient one. */
  if (b.photo_data) {
    const head = String(b.photo_data).slice(0, 40);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(head))
      return fail('BAD_PHOTO', 400, { message: 'Photo must be a JPG, PNG or WEBP image.' });
    // Base64 inflates by about a third; Vercel rejects request bodies over
    // 4.5 MB before this code ever runs, so the check has to sit under that.
    if (String(b.photo_data).length * 0.75 > 4 * 1024 * 1024)
      return fail('PHOTO_TOO_BIG', 400, { message: 'Photo must be smaller than 4 MB.' });
    try {
      const url = await uploadDataUrl(b.photo_data, 'members');
      if (url) {
        patch.photo_url = url;
        notes.push('photo replaced');
      }
    } catch {
      return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the photo. Please try again.' });
    }
  } else if (b.photo_url === null && m.photo_url) {
    // Explicit removal — the member reverts to the placeholder icon.
    patch.photo_url = null;
    notes.push('photo removed');
  }

  if (!notes.length) return ok({ updated: false });

  const { error } = await sb.from('membership_members').update(patch).eq('id', m.id);
  if (error) return fail('UPDATE_FAILED', 500, { message: 'Could not update the member.', detail: error.message });

  if (patch.status) {
    await sb.from('membership_status_history').insert({
      member_id: m.id, from_status: m.status, to_status: patch.status,
      reason: b.reason || null, changed_by: admin.username,
    });
    await sb.from('membership_notifications').insert({
      member_id: m.id,
      title: `Membership ${patch.status}`,
      body: b.reason || `Your membership status is now ${patch.status}.`,
      category: 'membership',
    }).then(() => {}, () => {});
  }

  await logMembershipAudit({
    admin_name: admin.username, action: 'MEMBER_UPDATED', target_type: 'member',
    target_id: m.membership_id, previous_value: { status: m.status, public_visible: m.public_visible },
    new_value: patch, reason: b.reason || null, ip,
  });

  return ok({ updated: true, changes: notes });
}

// DELETE — permanently remove a member.
//
// Deliberately a HARD delete, not a soft one. `email_normalized` carries a
// unique constraint, so a soft-deleted row would keep the address reserved and
// the person could never register again — which is the whole point of this
// action. All 20 child tables are ON DELETE CASCADE, so their rows go with it.
//
// Their previous applications are removed too. The apply route blocks a new
// submission while an application is pending_review / under_review /
// correction_requested / approved, so leaving the old one behind would block
// re-registration just as effectively as the member row did.
export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const ip = clientIp(req);

  const { data: m } = await sb.from('membership_members').select('*').eq('id', params.id).maybeSingle();
  if (!m) return fail('NOT_FOUND', 404, { message: 'Member not found.' });

  const url = new URL(req.url);
  const confirm = url.searchParams.get('confirm');
  if (confirm !== m.membership_id)
    return fail('CONFIRM_REQUIRED', 400, {
      message: 'Type the Membership ID to confirm permanent deletion.' });

  // Audit BEFORE the row disappears — afterwards there is nothing to record.
  await logMembershipAudit({
    admin_name: admin.username, action: 'MEMBER_DELETED', target_type: 'member',
    target_id: m.membership_id,
    previous_value: {
      membership_id: m.membership_id, full_name: m.full_name,
      email: m.email, status: m.status, village: m.village,
    },
    new_value: null, reason: url.searchParams.get('reason') || null, ip,
  });

  // ── Everything that does NOT cascade automatically ──────────────────────
  // The 23 portal tables (CVs, cover letters, certificates, documents,
  // education, experience, skills, notifications, tickets, volunteering,
  // events, saved opportunities …) are ON DELETE CASCADE from
  // membership_members, so they go when the row goes.
  //
  // These three are keyed differently and must be removed by hand:

  // 1. Public leadership profile — a separate table, and deleting it also
  //    cascades its education, experience, publications, certifications,
  //    awards, projects and gallery rows.
  if (m.leadership_profile_id) {
    await sb.from('leadership_profiles').delete().eq('id', m.leadership_profile_id);
  }
  await sb.from('leadership_profiles').delete().eq('member_id', m.id);

  // 2. Guidance requests they SENT. Keyed by membership_id as plain text, so
  //    there is no foreign key to cascade — without this their name and the
  //    body of their message would stay in council members' inboxes.
  await sb.from('council_guidance_requests').delete().eq('membership_id', m.membership_id);

  // 3. Applications — frees the email and mobile for a fresh registration.
  await sb.from('membership_applications').delete().eq('email_normalized', m.email_normalized);
  if (m.mobile_normalized) {
    await sb.from('membership_applications').delete().eq('mobile_normalized', m.mobile_normalized);
  }

  const { error } = await sb.from('membership_members').delete().eq('id', m.id);
  if (error) return fail('DELETE_FAILED', 500, {
    message: 'Could not delete the member.', detail: error.message });

  return ok({
    deleted: true,
    membership_id: m.membership_id,
    message: `${m.full_name} has been permanently deleted. ${m.email} can now register again.`,
  });
}
