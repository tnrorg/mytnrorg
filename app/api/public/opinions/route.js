import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Published opinions, for the public listing and article pages.
 *
 * PUBLISHED COLUMNS ONLY. The draft columns are never selected here, so a
 * piece being edited cannot leak its unapproved text through this endpoint —
 * the restriction is in the query shape, not in a filter someone could forget.
 *
 * `status = 'published'` is applied to every request and is not optional.
 */
/* Totals are public. IDENTITIES ARE NOT.
 *
 * `views` and the like count ship with every piece. What never leaves this
 * endpoint is WHO — no viewer list, and no liker names. Those are attached
 * only in /api/member/opinions, behind a check that the caller wrote the
 * piece.
 *
 * The distinction is the whole design: a number tells a reader how a piece
 * landed, a name tells them what a particular person read and endorsed. */
const PUBLIC_FIELDS =
  'id, slug, published_title, published_summary, published_body, published_cover, ' +
  'published_at, views, member_id';

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const slug = (p.get('slug') || '').trim();

  const sb = supabaseAdmin();
  let q = sb.from('opinions')
    .select(PUBLIC_FIELDS)
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('published_at', { ascending: false });

  if (slug) q = q.eq('slug', slug).limit(1);
  else q = q.limit(60);

  const { data, error } = await q;
  // An empty list is a valid answer — a site with no opinions yet is not an
  // error, and the page says so plainly.
  if (error) return ok({ opinions: [] });

  /* Author byline, read live rather than copied onto the row.
   *
   * Only the fields a byline needs. A member who has hidden their photo keeps
   * it hidden here: photo_public is honoured exactly as in the directory,
   * because publishing an opinion is not consent to publish a face. */
  const ids = [...new Set((data || []).map(o => o.member_id))];
  let authors = {};
  if (ids.length) {
    const { data: mem } = await sb.from('membership_members')
      .select('id, full_name, membership_id, photo_url, photo_public, gender, role, current_position')
      .in('id', ids).is('deleted_at', null);
    authors = Object.fromEntries((mem || []).map(m => [m.id, {
      full_name: m.full_name,
      membership_id: m.membership_id,
      photo_url: m.photo_public === false ? null : (m.photo_url || null),
      gender: m.gender,
      role: m.role,
      current_position: m.current_position,
    }]));
  }

  /* Like TOTALS, counted here. No member_id leaves this function.
   *
   * One query for the whole page rather than one per article — a list of
   * twenty pieces would otherwise be twenty round trips.
   *
   * `member_id` is selected because grouping needs the rows, but it is only
   * ever turned into a number below. If the likes migration has not been run
   * the query fails and every piece shows zero, which is honest and does not
   * take the page down with it. */
  const likeCount = {};
  const commentCount = {};
  if (data?.length) {
    const ids = data.map(o => o.id);

    const { data: likeRows } = await sb.from('opinion_likes')
      .select('opinion_id').in('opinion_id', ids);
    for (const l of (likeRows || []))
      likeCount[l.opinion_id] = (likeCount[l.opinion_id] || 0) + 1;

    /* Comment totals. Replies count too — a thread of ten is a thread of ten,
     * whether or not they were answers to each other.
     *
     * Removed comments are excluded, so a moderated thread shows the number a
     * reader will actually find when they open it. Only the id column is
     * selected: no name, no text. */
    const { data: cRows } = await sb.from('opinion_comments')
      .select('opinion_id').in('opinion_id', ids).is('deleted_at', null);
    for (const c of (cRows || []))
      commentCount[c.opinion_id] = (commentCount[c.opinion_id] || 0) + 1;
  }

  const opinions = (data || []).map(({ member_id, ...o }) => ({
    ...o,
    likes: likeCount[o.id] || 0,
    comments: commentCount[o.id] || 0,
    author: authors[member_id] || null,
  }));

  return ok({ opinions });
}
