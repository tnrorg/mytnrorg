import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { ACTIVE_STATUSES } from '@/lib/membershipStats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Public directory — every approved/active member. Contact details, CNIC,
// address, DOB and application answers are never selected, so they cannot leak
// through this endpoint regardless of who is listed.
// A member is withheld only if an admin has explicitly hidden them.
const PUBLIC_FIELDS =
  'membership_id, full_name, photo_url, village, union_council, current_position, ' +
  'profession, profession_other, organization_name, current_country, current_country_code, ' +
  'education_level, contribution_areas, category_id';

export async function GET(req) {
  const url = new URL(req.url);
  const p = (k) => (url.searchParams.get(k) || '').trim();
  const search = p('search'), uc = p('union_council'), profession = p('profession');
  const village = p('village'), education = p('education'), category = p('category');
  const contribution = p('contribution');

  let q = supabaseAdmin().from('membership_members')
    .select(PUBLIC_FIELDS)
    // Not `.eq('public_visible', true)`.
    //
    // Approved members are public by default. The column survives as an ADMIN
    // override for the rare case where someone must be removed from the public
    // site, so it is checked as "not explicitly hidden" — a member with the
    // flag unset or true is listed, only an explicit false is withheld.
    .not('public_visible', 'is', false)
    .in('status', ACTIVE_STATUSES)
    .is('deleted_at', null)
    .order('full_name')
    .limit(1000);

  if (uc) q = q.eq('union_council', uc);
  if (profession) q = q.eq('current_position', profession);
  if (village) q = q.eq('village', village);
  if (education) q = q.eq('education_level', education);
  if (contribution) q = q.contains('contribution_areas', [contribution]);
  if (search) q = q.or(
    `full_name.ilike.%${search}%,village.ilike.%${search}%,current_position.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return ok({ members: [], total: 0, error: 'Directory unavailable' });
  let rows = data || [];

  const { data: cats } = await supabaseAdmin().from('membership_categories').select('id, name');
  const cmap = Object.fromEntries((cats || []).map(c => [c.id, c.name]));

  let members = rows.map(({ category_id, profession_other, ...m }) => ({
    ...m,
    category: cmap[category_id] || null,
    profession: m.profession === 'Other' ? (profession_other || 'Other') : m.profession,
  }));
  if (category) members = members.filter(m => m.category === category);

  // Filter options come from the whole public roster, not the filtered result,
  // so the dropdowns do not collapse as the visitor narrows their search.
  const { data: allRows } = await supabaseAdmin().from('membership_members')
    .select(PUBLIC_FIELDS)
    .not('public_visible', 'is', false)
    .in('status', ACTIVE_STATUSES)
    .is('deleted_at', null)
    .limit(2000);
  const all = (allRows || []).map(({ category_id, ...m }) => ({ ...m, category: cmap[category_id] || null }));

  const uniq = (fn) => [...new Set(all.flatMap(fn).filter(Boolean))].sort();
  return ok({
    members,
    total: members.length,
    directoryTotal: all.length,
    union_councils: uniq(m => [m.union_council]),
    professions:    uniq(m => [m.current_position]),
    villages:       uniq(m => [m.village]),
    educations:     uniq(m => [m.education_level]),
    categories:     uniq(m => [m.category]),
    contributions:  uniq(m => m.contribution_areas || []),
  });
}
