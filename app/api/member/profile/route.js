import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { SECTIONS, PROFILE_FIELDS, SENSITIVE_FIELDS, SELF_EDITABLE_CORE, FORBIDDEN_FIELDS, pick } from '@/lib/membership/profile';
import { uploadDataUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// GET — the member's complete profile (own data only).
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();

  const [{ data: profile }, ...sections] = await Promise.all([
    sb.from('member_profiles').select('*').eq('member_id', member.id).maybeSingle(),
    ...Object.values(SECTIONS).map(s =>
      sb.from(s.table).select('*').eq('member_id', member.id).order('sort_order').order('created_at')),
  ]);

  const out = {};
  Object.keys(SECTIONS).forEach((k, i) => { out[k] = sections[i].data || []; });

  const { data: pending } = await sb.from('profile_update_requests')
    .select('field, requested_value, status, created_at')
    .eq('member_id', member.id).eq('status', 'pending');

  const { password_hash, invite_token, invite_expires_at, session_epoch, ...core } = member;
  return ok({ core, profile: profile || {}, ...out, pending_requests: pending || [] });
}

// PATCH — update free-to-edit fields; sensitive fields become approval requests.
export async function PATCH(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);

  // 1. Reject any attempt at forbidden fields outright.
  for (const f of FORBIDDEN_FIELDS) {
    if (b[f] !== undefined)
      return fail('FORBIDDEN_FIELD', 403, { message: 'You cannot change your membership status or ID.' });
  }

  // 2. Profile photo — members may change their own picture directly.
  let photoUrl = null;
  if (b.photo_data) {
    const head = String(b.photo_data).slice(0, 40);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(head))
      return fail('BAD_PHOTO', 400, { message: 'Photo must be a JPG, PNG or WEBP image.' });
    if ((String(b.photo_data).length) * 0.75 > 4 * 1024 * 1024)
      return fail('PHOTO_TOO_BIG', 400, { message: 'Photo must be smaller than 4 MB.' });
    try {
      const url = await uploadDataUrl(b.photo_data, 'members');
      if (url) {
        photoUrl = url;
        await sb.from('membership_members')
          .update({ photo_url: url, updated_at: new Date().toISOString() }).eq('id', member.id);
      }
    } catch (e) {
      return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the photo. Please try again.' });
    }
  }

  // 2a. Core details the member owns — name, mobile, village, union council.
  //     Written immediately so the public profile reflects the change at once.
  const core = pick(b, SELF_EDITABLE_CORE);
  // `field_of_study` is no longer asked for directly — the profession replaced
  // it — but the Fields of Study chart, the leadership profile and the
  // completion score all still read that column. Kept in step here for the
  // same reason the application route fills it.
  if ('profession' in core) {
    core.field_of_study = core.profession === 'Other'
      ? (String(b.profession_other || '').trim() || null)
      : (core.profession || null);
  }
  if (Object.keys(core).length) {
    core.updated_at = new Date().toISOString();
    const { error } = await sb.from('membership_members').update(core).eq('id', member.id);
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save your details.', detail: error.message });
  }

  // 2b. Free profile fields — written immediately.
  const patch = pick(b, PROFILE_FIELDS);
  if (Object.keys(patch).length) {
    patch.member_id = member.id;
    patch.updated_at = new Date().toISOString();
    const { error } = await sb.from('member_profiles').upsert(patch, { onConflict: 'member_id' });
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save your profile.', detail: error.message });
  }

  // 2c. Keep the public leadership profile in step.
  //     The council and executive cards read leadership_profiles, not
  //     membership_members — without this, a council member updating their
  //     photo here would still show the old picture on the public site.
  if (member.leadership_profile_id) {
    const mirror = {};
    if (photoUrl) mirror.photo_url = photoUrl;
    if (core.first_name || core.last_name) {
      mirror.name = [core.first_name ?? member.first_name,
                     core.last_name ?? member.last_name].filter(Boolean).join(' ');
    }
    if (Object.keys(mirror).length) {
      mirror.updated_at = new Date().toISOString();
      await sb.from('leadership_profiles')
        .update(mirror).eq('id', member.leadership_profile_id);
    }
  }

  // 3. Sensitive fields — queued for admin approval, never written now.
  const requests = [];
  for (const f of SENSITIVE_FIELDS) {
    if (b[f] === undefined) continue;
    const requested = String(b[f] ?? '').trim();
    const current = String(member[f] ?? '');
    if (!requested || requested === current) continue;

    const { data: dupe } = await sb.from('profile_update_requests')
      .select('id').eq('member_id', member.id).eq('field', f).eq('status', 'pending').limit(1);
    if (dupe && dupe.length) continue;      // already awaiting review

    requests.push({ member_id: member.id, field: f, current_value: current,
      requested_value: requested, reason: b.change_reason || null });
  }
  if (requests.length) await sb.from('profile_update_requests').insert(requests);

  return ok({
    saved: true,
    pending_approval: requests.map(r => r.field),
    message: requests.length
      ? 'Profile updated. Your email change needs committee approval before it takes effect.'
      : 'Profile updated. Your public profile has been refreshed.',
  });
}
