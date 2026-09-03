import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { logMembershipAudit } from '@/lib/membership/core';
import { ROLE_KEYS } from '@/lib/membership/roles';
import { uploadDataUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
const STATUSES = ['approved', 'active', 'suspended', 'inactive', 'expired'];

// PATCH — status change, category, public visibility.
// Membership ID can never be altered here.
export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
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
  const { admin, res } = requireAdmin(req);if (res) return res;
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
