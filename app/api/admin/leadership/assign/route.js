import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

// Same rule the manual create path uses, so slugs stay consistent.
const slugify = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Promote an EXISTING member to a leadership body.
//
// This is the normal path: the person already applied and was approved, so
// their name, photo, village, education and profession are already on record.
// Retyping all of that into a blank profile invites typos and a second source
// of truth — here the profile is seeded from the member record and the two are
// linked, so the member can then complete it from their own portal.

const BODY_ROLE = { advisory: 'advisory', executive: 'cec' };

// GET ?q=  — find an approved member by membership ID, email or name.
export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return ok({ members: [] });

  const { data, error } = await supabaseAdmin().from('membership_members')
    .select('id, membership_id, full_name, email, photo_url, village, union_council, ' +
            'education_level, field_of_study, current_position, role, leadership_profile_id')
    .in('status', ['approved', 'active'])
    .is('deleted_at', null)
    .or(`membership_id.ilike.%${q}%,email.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(10);
  if (error) return fail('SEARCH_FAILED', 500, { message: error.message });
  return ok({ members: data || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const body = b.body === 'executive' ? 'executive' : 'advisory';
  const identifier = String(b.identifier || '').trim();
  if (!identifier) return fail('INVALID', 400, { message: 'Enter a Membership ID or email.' });

  const sb = supabaseAdmin();
  const { data: matches } = await sb.from('membership_members')
    .select('*')
    .in('status', ['approved', 'active'])
    .is('deleted_at', null)
    .or(`membership_id.eq.${identifier},email.eq.${identifier.toLowerCase()}`)
    .limit(2);

  const member = (matches || [])[0];
  if (!member) return fail('NOT_FOUND', 404, {
    message: 'No approved member found with that Membership ID or email.' });

  // Already assigned? Update the existing profile rather than creating a second.
  if (member.leadership_profile_id) {
    const { data: existing } = await sb.from('leadership_profiles')
      .select('id, body, slug').eq('id', member.leadership_profile_id).maybeSingle();
    if (existing) {
      const patch = { body, designation: b.designation || null, active: true,
                      verified: true, updated_at: new Date().toISOString() };
      let { error: upErr } = await sb.from('leadership_profiles')
        .update({ ...patch, member_id: member.id }).eq('id', existing.id);
      if (upErr && /member_id/.test(upErr.message || '')) {
        await sb.from('leadership_profiles').update(patch).eq('id', existing.id);
      }
      await sb.from('membership_members')
        .update({ role: BODY_ROLE[body] }).eq('id', member.id);
      await logAudit({ action: 'LEADERSHIP_REASSIGNED', actor: admin.username,
        details: `${member.membership_id} → ${body}`, ip: clientIp(req) });
      return ok({ profile: existing, moved: true });
    }
  }

  // Seed the profile from the member's own record.
  let slug = slugify(member.full_name || member.membership_id);
  const { data: clash } = await sb.from('leadership_profiles')
    .select('id').eq('body', body).eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug}-${member.membership_id.toLowerCase()}`;

  // `member_id` arrives with migration_leadership_member_link.sql. On a
  // database where that has not been run yet the insert would fail outright,
  // so the column is added separately and retried without it — the assignment
  // still succeeds, just without the cascade link until the migration runs.
  const baseRow = {
    body, slug,
    name: member.full_name,
    designation: b.designation || null,
    qualification: member.education_level || null,
    field: member.field_of_study || null,
    profession: member.current_position || null,
    photo_url: member.photo_url || null,
    email: member.email || null,
    mobile: member.mobile || null,
    // Contact stays private until the member or an admin publishes it.
    show_email: false, show_mobile: false,
    // Assigning from an approved member record IS the verification: an admin
    // has confirmed a real, approved member into a leadership body.
    verified: true,
    active: true,
    sort_order: Number(b.sort_order) || 0,
  };

  let { data: profile, error } = await sb.from('leadership_profiles')
    .insert({ ...baseRow, member_id: member.id }).select().maybeSingle();
  if (error && /member_id/.test(error.message || '')) {
    ({ data: profile, error } = await sb.from('leadership_profiles')
      .insert(baseRow).select().maybeSingle());
  }
  if (error) return fail('ASSIGN_FAILED', 500, { message: error.message });

  await sb.from('membership_members')
    .update({ role: BODY_ROLE[body], leadership_profile_id: profile.id })
    .eq('id', member.id);

  await logAudit({ action: 'LEADERSHIP_ASSIGNED', actor: admin.username,
    details: `${member.membership_id} (${member.full_name}) → ${body}`, ip: clientIp(req) });

  return ok({ profile, member: { membership_id: member.membership_id, full_name: member.full_name } });
}
