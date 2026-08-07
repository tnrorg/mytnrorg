import { ok } from '@/lib/api';
import { COUNTRIES, PRIORITY_CODES } from '@/lib/geo/countries';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;          // this data changes about once a decade

/* Countries, states and cities for the Current Address fields.
 *
 * The dataset lives SERVER-side. `country-state-city` is several megabytes —
 * importing it into the page would put all of it into the browser bundle, and
 * most applicants are on mobile data. This route sends back only the list
 * actually being shown, which is a few kilobytes.
 *
 * If the package is not installed the route still answers: countries come from
 * the bundled ISO list, and states/cities return `{ list: [], free: true }`,
 * which the form reads as "let them type it". A missing dependency must not be
 * able to block a membership application.
 */
function dataset() {
  try {
    // Required at call time, not imported: a missing package would otherwise
    // fail the whole route at module load, including the country list.
    // eslint-disable-next-line global-require
    return require('country-state-city');
  } catch {
    return null;
  }
}

const byName = (a, b) => a.name.localeCompare(b.name);

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const type = p.get('type') || 'countries';
  const country = (p.get('country') || '').toUpperCase();
  const state = p.get('state') || '';
  const csc = dataset();

  if (type === 'countries') {
    // Priority countries first, then everything else alphabetically.
    const priority = PRIORITY_CODES
      .map(c => COUNTRIES.find(x => x.code === c)).filter(Boolean);
    const rest = COUNTRIES.filter(c => !PRIORITY_CODES.includes(c.code)).sort(byName);
    return ok({ list: [...priority, ...rest], free: false });
  }

  if (type === 'states') {
    if (!country) return ok({ list: [], free: false });
    if (!csc) return ok({ list: [], free: true });
    const list = (csc.State.getStatesOfCountry(country) || [])
      .map(s => ({ code: s.isoCode, name: s.name })).sort(byName);
    // Some countries genuinely have no sub-divisions in the dataset (Singapore,
    // Vatican City). Free text rather than an empty dropdown they cannot pass.
    return ok({ list, free: list.length === 0 });
  }

  if (type === 'cities') {
    if (!country || !state) return ok({ list: [], free: false });
    if (!csc) return ok({ list: [], free: true });
    const list = [...new Set(
      (csc.City.getCitiesOfState(country, state) || []).map(c => c.name)
    )].sort((a, b) => a.localeCompare(b)).map(name => ({ code: name, name }));
    return ok({ list, free: list.length === 0 });
  }

  return ok({ list: [], free: false });
}
