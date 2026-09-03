import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail } from '@/lib/api';
import { ACTIVE_STATUSES } from '@/lib/membershipStats';
import { CV_TABLES, MAP, skillNames } from '@/lib/cvToProfile';
import { roleLabel } from '@/lib/membership/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* The full public profile for one member.
 *
 * Returns the SAME `{ profile, sections }` shape as the Advisory Council
 * endpoint, so /members/[id] can render with the same components the council
 * pages use. Every member gets a real profile page rather than a summary card;
 * keeping two different shapes would have meant maintaining two profile pages.
 *
 * PRIVACY — the column lists below are the whole guarantee:
 *   • Core: an allow-list. Email, mobile, WhatsApp, date of birth, CNIC,
 *     application answers and admin notes are not named, so they cannot be
 *     returned.
 *   • member_profiles: only the fields a member wrote FOR publication. Its
 *     `address` and `whatsapp` columns are deliberately excluded — a member
 *     filled those in for TNR's records, not for the open web.
 */
const CORE_FIELDS =
  'id, membership_id, full_name, photo_url, photo_public, gender, village, union_council, role, ' +
  'current_position, profession, profession_other, organization_name, ' +
  'education_level, field_of_study, contribution_areas, category_id, ' +
  'current_city, current_state_province, current_country, current_country_code';

// Note what is absent: address, whatsapp, city (the core row already has it).
const PROFILE_FIELDS =
  'headline, summary, country, linkedin_url, portfolio_url, github_url, ' +
  'tnr_contributions, awards';

export async function GET(_req, props) {
  const params = await props.params;
  const sb = supabaseAdmin();

  const { data: m, error } = await sb.from('membership_members')
    .select(CORE_FIELDS)
    .eq('membership_id', params.id)
    .not('public_visible', 'is', false)
    .in('status', ACTIVE_STATUSES)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return fail('LOOKUP_FAILED', 500, { message: 'Profile unavailable' });
  if (!m) return fail('NOT_FOUND', 404, { message: 'This profile is not available.' });

  const [{ data: prof }, { data: cat }] = await Promise.all([
    sb.from('member_profiles').select(PROFILE_FIELDS).eq('member_id', m.id).maybeSingle(),
    m.category_id
      ? sb.from('membership_categories').select('name').eq('id', m.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // The member's own CV Builder entries — the same tables their portal writes.
  const cv = {};
  await Promise.all(CV_TABLES.map(async ([key, table]) => {
    const { data, error: e } = await sb.from(table).select('*')
      .eq('member_id', m.id).order('sort_order');
    cv[key] = e ? [] : (data || []);
  }));

  const sections = {};
  for (const [key] of CV_TABLES) {
    if (key === 'skills') continue;              // merged into the tag cloud
    sections[key] = (cv[key] || []).map(MAP[key]);
  }
  // The council page renders these two; a general member has no curated
  // equivalent, so they are empty rather than missing.
  sections.publications = [];
  sections.awards = [];
  sections.gallery = [];

  const profession = m.profession === 'Other'
    ? (m.profession_other || 'Other') : m.profession;

  const profile = {
    slug: m.membership_id,
    membership_id: m.membership_id,
    name: m.full_name,
    // Role reads as a title on the profile — "Advisory Council Member" rather
    // than a bare "advisory".
    designation: roleLabel(m.role),
    role: m.role,
    profession: profession || m.current_position || null,
    current_position: m.current_position,
    organisation: m.organization_name,
    qualification: m.education_level,
    field: m.field_of_study,
    village: m.village,
    union_council: m.union_council,
    current_city: m.current_city,
    current_state_province: m.current_state_province,
    country: m.current_country || prof?.country || null,
    current_country_code: m.current_country_code,
    category: cat?.name || null,
    tagline: prof?.headline || null,
    intro: prof?.summary || null,
    bio: prof?.summary || null,
    tnr_contributions: prof?.tnr_contributions || null,
    awards_text: prof?.awards || null,
    links: {
      linkedin: prof?.linkedin_url || null,
      portfolio: prof?.portfolio_url || null,
      github: prof?.github_url || null,
    },
    expertise: m.contribution_areas || [],
    skills: skillNames(cv.skills),
    research_areas: [],
    duties: [],
    // Dropped entirely when the member has turned publication off.
    ...(m.photo_public === false ? { photo_hidden: true } : { photo_url: m.photo_url }),
    gender: m.gender || null,
    verified: true,
  };

  return ok({ profile, sections });
}
