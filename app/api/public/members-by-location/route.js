import { supabaseAdmin } from '@/lib/supabaseServer';
import { withholdPhoto } from '@/lib/membership/photoVisibility';
import { ok, fail } from '@/lib/api';
import { ACTIVE_STATUSES } from '@/lib/membershipStats';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Members in one place, fetched ON DEMAND when a visitor opens a location.
 *
 * The statistics pages load aggregated counts only. This endpoint is what a
 * click asks for, so opening the page never downloads every member.
 *
 * PUBLIC-SAFE COLUMNS ONLY. Email, mobile, date of birth, CNIC, street
 * address, application answers and admin notes are not in this list, so they
 * cannot be returned by any query shape.
 *
 * Two filters are applied to every request and are not optional:
 *   status  — approved/active only, never pending, rejected or suspended
 *   deleted — soft-deleted members are excluded
 *
 * Every approved member is listed. `public_visible` is now an admin-only
 * override — a member is withheld from this list only if an admin has
 * explicitly hidden them — and the response still reports how many, so the
 * heading count and the number of cards always reconcile.
 */
const PUBLIC_FIELDS =
  'membership_id, full_name, gender, photo_url, photo_public, village, union_council, ' +
  'current_position, profession, profession_other, organization_name, ' +
  'education_level, current_city, current_state_province, current_country, current_country_code';

const MAX_PAGE = 24;

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const scope = p.get('scope') || '';          // village | union_council | city | province | country
  const value = (p.get('value') || '').trim();
  const parent = (p.get('parent') || '').trim();   // province, when scope is city
  const offset = Math.max(0, Number(p.get('offset')) || 0);
  const limit = Math.min(MAX_PAGE, Math.max(1, Number(p.get('limit')) || MAX_PAGE));

  if (!scope || !value) return fail('INVALID', 400, { message: 'A location is required.' });

  /* `select()` FIRST, then filters.
   *
   * supabase-js only exposes select/insert/update/delete on the object
   * `from()` returns — the filter methods live on what `select()` returns.
   * Calling `.in()` before `.select()` throws "q.in is not a function", which
   * surfaced as "Members are unavailable right now." on every drill-down. */
  const base = (cols, opts) => {
    let q = supabaseAdmin().from('membership_members')
      .select(cols, opts)
      .in('status', ACTIVE_STATUSES)
      .is('deleted_at', null);

    // `ilike` with no wildcards: an exact match that ignores case, so a member
    // who typed "hardass" still appears under "Hardass".
    switch (scope) {
      case 'village':       q = q.ilike('village', value); break;
      case 'union_council': q = q.ilike('union_council', value); break;
      case 'province':      q = q.ilike('current_state_province', value); break;
      case 'city':
        q = q.ilike('current_city', value);
        // A city name is only unique within its province — several countries
        // have a Hyderabad.
        if (parent) q = q.ilike('current_state_province', parent);
        break;
      case 'country':
        // Prefer the ISO code: stable, unlike the readable name.
        q = /^[A-Za-z]{2}$/.test(value)
          ? q.ilike('current_country_code', value)
          : q.ilike('current_country', value);
        break;
      default: return null;
    }
    return q;
  };

  if (!base('membership_id', { count: 'exact', head: true })) {
    return fail('INVALID', 400, { message: 'Unknown location type.' });
  }

  // Total approved members here, INCLUDING those with a private profile, so
  // the drawer's heading matches the number on the statistics card.
  const { count: total, error: countErr } =
    await base('membership_id', { count: 'exact', head: true });
  if (countErr) {
    return fail('READ_FAILED', 500, {
      message: 'Members are unavailable right now.', detail: countErr.message,
    });
  }

  const { data, count: listed, error } = await base(PUBLIC_FIELDS, { count: 'exact' })
    // Approved members are public by default; only an explicit admin hide
    // withholds someone.
    .not('public_visible', 'is', false)
    .order('full_name')
    .range(offset, offset + limit - 1);
  if (error) {
    return fail('READ_FAILED', 500, {
      message: 'Members are unavailable right now.', detail: error.message,
    });
  }

  // withholdPhoto drops photo_url entirely for a member who has turned
  // publication off — the URL must not reach the browser, since a public
  // storage address is the photograph.
  const members = (data || []).map(m => withholdPhoto({
    ...m,
    // The category, not the typed text, unless they chose "Other".
    profession: m.profession === 'Other' ? (m.profession_other || 'Other') : m.profession,
    profession_other: undefined,
  }));

  return ok({
    scope, value, parent,
    total: total || 0,
    listed: listed || 0,
    hidden: Math.max(0, (total || 0) - (listed || 0)),
    members,
    offset,
    hasMore: offset + members.length < (listed || 0),
  });
}
