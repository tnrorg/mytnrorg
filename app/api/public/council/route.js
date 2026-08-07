import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Roster for the council listing and homepage section. Card-level fields only —
// biography, contact details and child records live behind the detail route.
export async function GET(req) {
  const url = new URL(req.url);
  const p = (k) => (url.searchParams.get(k) || '').trim();
  const q = p('q').toLowerCase();
  const country = p('country'), profession = p('profession'), expertise = p('expertise');

  // The portal columns (profession, country, verified …) only exist once
  // migration_council_portal.sql has been run. Selecting them on an un-migrated
  // database errors, which would silently empty the whole council section — so
  // fall back to the base columns instead of showing nothing.
  const FULL = 'slug,name,designation,qualification,field,affiliation,profession,' +
    'organisation,country,tagline,intro,expertise,research_areas,photo_url,verified,sort_order';
  const BASE = 'slug,name,designation,qualification,field,affiliation,expertise,photo_url,sort_order';

  try {
    const sb = supabaseAdmin();
    const run = (cols) => sb.from('leadership_profiles').select(cols)
      .eq('body', 'advisory').eq('active', true).order('sort_order').order('name');

    let { data, error } = await run(FULL);
    if (error) ({ data, error } = await run(BASE));
    if (error) return ok({ members: [], filters: {}, degraded: true });

    let members = data || [];
    const all = members;

    if (country)    members = members.filter(m => m.country === country);
    if (profession) members = members.filter(m => m.profession === profession);
    if (expertise)  members = members.filter(m => (m.expertise || []).includes(expertise));
    if (q) members = members.filter(m => [
      m.name, m.designation, m.profession, m.organisation, m.affiliation,
      m.country, m.qualification, m.field,
      ...(m.expertise || []), ...(m.research_areas || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(q));

    // Filter options come from the full roster so the dropdowns do not collapse
    // as the visitor narrows their search.
    const uniq = (fn) => [...new Set(all.flatMap(fn).filter(Boolean))].sort();
    return ok({
      members,
      total: members.length,
      filters: {
        countries:   uniq(m => [m.country]),
        professions: uniq(m => [m.profession]),
        expertise:   uniq(m => m.expertise || []),
        research:    uniq(m => m.research_areas || []),
      },
    });
  } catch {
    return ok({ members: [], filters: {} });
  }
}
