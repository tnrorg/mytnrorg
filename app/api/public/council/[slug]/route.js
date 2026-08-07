import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail } from '@/lib/api';
import { CV_TABLES, MAP, skillNames } from '@/lib/cvToProfile';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Full professional profile for one Advisory Council member.
//
// Two privacy rules are enforced here rather than in the UI, so they hold even
// if someone calls the endpoint directly:
//   1. Email and mobile are only included when the member has switched the
//      matching visibility flag on. Otherwise the keys are absent entirely —
//      no "hidden" placeholder that hints a value exists.
//   2. Child records are only returned once an admin has approved them.
const CHILD_TABLES = [
  ['education',      'council_education',      'sort_order,start_year'],
  ['experience',     'council_experience',     'sort_order,start_year'],
  ['publications',   'council_publications',   'sort_order,year'],
  ['certifications', 'council_certifications', 'sort_order,issue_date'],
  ['awards',         'council_awards',         'sort_order,year'],
  ['projects',       'council_projects',       'sort_order,start_year'],
  ['gallery',        'council_gallery',        'sort_order,taken_on'],
];

export async function GET(_req, { params }) {
  const sb = supabaseAdmin();

  // Any published leadership profile, not just the Advisory Council: an
  // Executive Committee member who fills in the same portal form was getting
  // "profile not available" on their own public link.
  const { data: p, error } = await sb.from('leadership_profiles')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .maybeSingle();

  if (error) return fail('LOOKUP_FAILED', 500, { message: 'Profile unavailable.' });
  if (!p) return fail('NOT_FOUND', 404, { message: 'This profile is not available.' });

  // Build the public shape explicitly. An allow-list means a column added to
  // the table later cannot leak onto the public profile by accident.
  const profile = {
    slug: p.slug, body: p.body, name: p.name, designation: p.designation,
    qualification: p.qualification, field: p.field, affiliation: p.affiliation,
    profession: p.profession, organisation: p.organisation, country: p.country,
    tagline: p.tagline, intro: p.intro, bio: p.bio, summary: p.summary,
    expertise: p.expertise || [], skills: p.skills || [],
    research_areas: p.research_areas || [], duties: p.duties || [],
    photo_url: p.photo_url, verified: !!p.verified,
    accepts_guidance: !!p.accepts_guidance,
    cv_url: p.cv_approved ? p.cv_url : null,
  };
  if (p.show_email && p.email) profile.email = p.email;
  if (p.show_mobile && p.mobile) profile.mobile = p.mobile;

  // Child tables also arrive with the portal migration. A missing table must
  // degrade to an empty section, not a broken profile page.
  const sections = {};
  await Promise.all(CHILD_TABLES.map(async ([key, table, order]) => {
    const [primary, secondary] = order.split(',');
    let q = sb.from(table).select('*').eq('profile_id', p.id).eq('approved', true)
      .order(primary, { ascending: true });
    if (secondary) q = q.order(secondary, { ascending: false });
    const { data, error } = await q;
    sections[key] = error ? [] : (data || []).map(({ profile_id, approved, ...rest }) => rest);
  }));

  // ── Fill the gaps from the member's own CV Builder ───────────────────────
  // A section only falls back when the admin has curated nothing for it, so a
  // curated history is never replaced by a raw CV entry.
  //
  // `member_id` only exists once migration_leadership_member_link.sql has run,
  // and the admin assign flow silently skips it on an un-migrated database —
  // so a profile can be linked in every practical sense while the column is
  // still null. Fall back to matching on email, which is unique per member.
  let memberId = p.member_id || null;
  if (!memberId && p.email) {
    const { data: m } = await sb.from('membership_members')
      .select('id').ilike('email', p.email).is('deleted_at', null).maybeSingle();
    memberId = m?.id || null;
  }

  if (memberId) {
    const cv = {};
    await Promise.all(CV_TABLES.map(async ([key, table]) => {
      const { data, error } = await sb.from(table).select('*')
        .eq('member_id', memberId).order('sort_order');
      cv[key] = error ? [] : (data || []);
    }));

    for (const [key] of CV_TABLES) {
      if (key === 'skills') continue;                 // merged into the tag cloud
      if ((sections[key] || []).length) continue;     // curated entries win
      sections[key] = (cv[key] || []).map(MAP[key]);
    }

    // Skills and languages have no curated equivalent, so they are additive.
    profile.skills = [...new Set([...(profile.skills || []), ...skillNames(cv.skills)])];
  }

  // `linked` says whether the profile was matched to a member account. When the
  // CV sections look empty on the public page this is the first thing to check
  // — false means the profile is not connected to any member record, so there
  // was no CV to pull, which is very different from "the CV is empty".
  return ok({ profile, sections, linked: !!memberId });
}
