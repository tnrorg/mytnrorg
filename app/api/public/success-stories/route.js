import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { PUBLIC_STATUS, KIND_KEYS } from '@/lib/successStories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* TNR Success Stories — the public feed.
 *
 * REACHABLE BY ANYONE ON THE INTERNET, WITH NO CREDENTIALS. Everything below
 * follows from that.
 *
 *   • status is pinned to 'published'. Not defaulted, not taken from the query
 *     string — pinned. A `status` parameter here would publish the rejection
 *     pile to anyone who typed ?status=rejected, which is the cruellest
 *     possible bug this feature could have.
 *
 *   • review_note, reviewed_by and member_id are never returned. The note is
 *     written to the member, the reviewer's name is internal, and the member
 *     id is a key into every other table.
 *
 *   • The author fields are named one by one. A select('*') on
 *     membership_members would publish CNIC, mobile number, email and date of
 *     birth to the open internet — and would do it the moment somebody added
 *     a column, with nobody having decided to.
 */

/* Exactly what a card shows — plus member_id, which is used to join and then
 * deleted from every row before the response is built. Fetching it here and
 * dropping it is one query; fetching it in a second query to "keep it off the
 * select" would be two round trips for no gain, since either way the server
 * decides what leaves. */
const STORY_FIELDS =
  'id, member_id, kind, title, organisation, description, achieved_on, image_url, featured, published_at';
const AUTHOR_FIELDS = 'id, full_name, photo_url, union_council, role';

export async function GET(req) {
  const sb = supabaseAdmin();
  const url = new URL(req.url);

  const kind = url.searchParams.get('kind');
  /* Clamped at BOTH ends.
   *
   * Capping only the top left `?limit=-3` to reach the database untouched,
   * where a negative row limit is not a smaller page but an error — so one
   * character in a URL turned the public page blank for everyone who followed
   * that link. Math.max first, Math.min second, and a non-numeric value falls
   * back to the default rather than to NaN. */
  const asked = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 120) : 60;

  let q = sb.from('success_stories')
    .select(STORY_FIELDS)
    .eq('status', PUBLIC_STATUS)            // pinned — see the note above
    .order('featured', { ascending: false })
    .order('achieved_on', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  /* Only a real category may filter. An unknown value returns everything
   * rather than nothing, because a visitor following a stale link should see
   * the page, not an empty one that looks broken. */
  if (KIND_KEYS.includes(kind)) q = q.eq('kind', kind);

  const { data, error } = await q;

  /* A missing table means the migration has not run. The public page shows an
   * empty state for that, not a database error — a visitor can do nothing with
   * "relation does not exist", and the admin screen is where it is reported. */
  if (error) return ok({ stories: [], counts: {} });

  const rows = data || [];

  /* Authors in ONE query for the whole page, not one per card. */
  const authors = {};
  const ids = [...new Set(rows.map(r => r.member_id).filter(Boolean))];
  if (ids.length) {
    const { data: ms } = await sb.from('membership_members')
      .select(AUTHOR_FIELDS).in('id', ids).is('deleted_at', null);
    const byMember = Object.fromEntries((ms || []).map(m => [m.id, m]));
    for (const r of rows) {
      const m = byMember[r.member_id];
      /* Name, photo and Union Council — the three things the card shows. Not
       * the email, not the mobile, not the id. */
      authors[r.id] = m
        ? {
            name: m.full_name,
            photo: m.photo_url || null,
            union_council: m.union_council || '',
            role: m.role || null,
          }
        : null;
    }
  }

  /* member_id is stripped from every row before the response is assembled. It
   * is a key into membership_members, meeting_attendance, votes and every
   * other table in the platform, and it has no business on a public page. */
  const stories = rows.map(({ member_id, ...rest }) => rest);   // eslint-disable-line no-unused-vars

  /* Counts per category, for the filter chips. Computed from the published set
   * only, so a chip never advertises a category whose stories are all still
   * waiting for review. */
  const counts = {};
  for (const s of stories) counts[s.kind] = (counts[s.kind] || 0) + 1;

  return ok({ stories, authors, counts, total: stories.length });
}
