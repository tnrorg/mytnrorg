import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { hasLeadershipProfile, bodyForRole } from '@/lib/membership/roles';
import { uploadDataUrl } from '@/lib/storage';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// A council or executive member editing their own public profile from the
// portal. Deliberately narrow: they can write their own biography and
// visibility, but NOT their designation, verified badge or active state —
// those stay with the admin, so nobody can promote themselves in the UI.
const SELF_EDITABLE = [
  'qualification', 'field', 'affiliation', 'summary', 'profession',
  'organisation', 'country', 'tagline', 'intro', 'bio', 'email', 'mobile', 'cv_url',
];
const SELF_TOGGLES = ['show_email', 'show_mobile', 'accepts_guidance'];
const SELF_ARRAYS = ['expertise', 'skills', 'research_areas'];

const toArray = (v) => Array.isArray(v)
  ? v.map(x => String(x).trim()).filter(Boolean)
  : String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

async function resolveProfile(member) {
  const sb = supabaseAdmin();
  if (member.leadership_profile_id) {
    const { data } = await sb.from('leadership_profiles')
      .select('*').eq('id', member.leadership_profile_id).maybeSingle();
    if (data) return data;
  }
  // Fall back to matching on email, so an admin-created profile links itself
  // the first time that person signs in.
  const { data } = await sb.from('leadership_profiles')
    .select('*').eq('email', member.email).maybeSingle();
  return data || null;
}

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  if (!hasLeadershipProfile(member.role))
    return fail('NOT_APPLICABLE', 403, { message: 'Your membership type does not have a public leadership profile.' });

  const profile = await resolveProfile(member);
  if (!profile)
    return ok({ profile: null, message: 'No leadership profile has been created for you yet.' });

  return ok({ profile, editable: SELF_EDITABLE, toggles: SELF_TOGGLES, arrays: SELF_ARRAYS });
}

export async function PATCH(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  if (!hasLeadershipProfile(member.role))
    return fail('NOT_APPLICABLE', 403, { message: 'Your membership type does not have a public leadership profile.' });

  const profile = await resolveProfile(member);
  if (!profile) return fail('NOT_FOUND', 404, { message: 'No leadership profile has been created for you yet.' });
  if (bodyForRole(member.role) !== profile.body)
    return fail('MISMATCH', 403, { message: 'This profile does not belong to your membership type.' });

  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };
  for (const f of SELF_EDITABLE) if (f in b) patch[f] = b[f] || null;
  for (const f of SELF_TOGGLES) if (f in b) patch[f] = b[f] === true;
  for (const f of SELF_ARRAYS) if (f in b) patch[f] = toArray(b[f]);
  if (b.photo_data) {
    try { patch.photo_url = await uploadDataUrl(b.photo_data, 'leadership'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Photo upload failed: ' + e.message }); }
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.from('leadership_profiles')
    .update(patch).eq('id', profile.id).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message });

  // Remember the link so the email fallback is only ever needed once.
  if (!member.leadership_profile_id) {
    await sb.from('membership_members')
      .update({ leadership_profile_id: profile.id }).eq('id', member.id);
  }
  return ok({ profile: data });
}
