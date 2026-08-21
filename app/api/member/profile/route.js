import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { SECTIONS, PROFILE_FIELDS, SENSITIVE_FIELDS, SELF_EDITABLE_CORE, FORBIDDEN_FIELDS, pick } from '@/lib/membership/profile';
import { uploadDataUrl } from '@/lib/storage';
import { ageFrom, MIN_AGE, MAX_AGE } from '@/lib/membership/validateApplication';
import { toNameCase } from '@/lib/membership/nameCase';

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

  // 2a. Core details the member owns outright — date of birth, profession,
  //     organisation and current address. Written immediately.
  //     Name, mobile, village and union council are NOT here any more; they go
  //     through approval in step 3.
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

  /* Date of birth, held to the same limits as the application form.
   *
   * Checked HERE and not only in the date picker: `min`/`max` on an input are
   * a convenience, not a rule, and this endpoint can be called directly. A
   * member correcting a typo is the case this exists for; changing it to an
   * age outside TNR's membership is not.
   *
   * Age is derived from the date on every read, so there is no separate `age`
   * column to keep in step. */
  if ('date_of_birth' in core) {
    const dob = String(core.date_of_birth || '').trim();
    if (!dob) {
      // Clearing it is not an edit anyone needs, and an empty birthday breaks
      // the age statistics silently.
      return fail('INVALID', 400, { message: 'Enter your date of birth.' });
    }
    const age = ageFrom(dob);
    if (age === null || Number.isNaN(age)) {
      return fail('INVALID', 400, { message: 'Enter a valid date of birth.' });
    }
    if (age < MIN_AGE || age > MAX_AGE) {
      return fail('INVALID', 400, {
        message: `TNR membership is for ages ${MIN_AGE}–${MAX_AGE}. Contact the committee if this is wrong.`,
      });
    }
    core.date_of_birth = dob;
    core.age = age;
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
    /* Only the photo mirrors from here now.
     *
     * A name change no longer lands in `core` — it becomes a request — so the
     * leadership card is updated when that request is APPROVED, in
     * app/api/admin/membership/update-requests/[id]/route.js. Mirroring an
     * unapproved name here would publish it on the public council page while
     * the committee was still deciding. */
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
    /* Names are tidied BEFORE the request is stored.
     *
     * So the committee reviews the value that will actually be saved, and an
     * approval cannot quietly introduce "shabbir hussain" into a directory
     * where every other row is properly cased. */
    const requested = (f === 'first_name' || f === 'last_name')
      ? toNameCase(b[f])
      : String(b[f] ?? '').trim();
    const current = String(member[f] ?? '');
    if (!requested || requested === current) continue;

    const { data: dupe } = await sb.from('profile_update_requests')
      .select('id').eq('member_id', member.id).eq('field', f).eq('status', 'pending').limit(1);
    if (dupe && dupe.length) continue;      // already awaiting review

    requests.push({ member_id: member.id, field: f, current_value: current,
      requested_value: requested, reason: b.change_reason || null });
  }
  if (requests.length) await sb.from('profile_update_requests').insert(requests);

  /* Name the fields that are waiting, rather than saying "your email change".
   *
   * Several fields can now be queued at once, and a member told the wrong one
   * needs approval will keep re-saving the field they actually changed. */
  const LABELS = {
    first_name: 'first name', last_name: 'last name', email: 'email address',
    mobile: 'mobile number', village: 'village', union_council: 'union council',
    category_id: 'membership category',
  };
  const waiting = requests.map(r => LABELS[r.field] || r.field.replace(/_/g, ' '));
  const list = waiting.length > 1
    ? `${waiting.slice(0, -1).join(', ')} and ${waiting[waiting.length - 1]}`
    : waiting[0];

  return ok({
    saved: true,
    pending_approval: requests.map(r => r.field),
    message: waiting.length
      ? `Saved. Your change to ${list} has been sent to the committee for approval — `
        + 'it will appear once they have reviewed it.'
      : 'Profile updated. Your public profile has been refreshed.',
  });
}
