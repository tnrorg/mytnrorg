import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyMemberToken } from '@/lib/membership/auth';
import { clientIp } from '@/lib/audit';
import { jwtSecret } from '@/lib/jwtSecret';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

/* Like / unlike a published opinion.
 *
 * Returns the TOTAL and the caller's own state — never a name. Who liked a
 * piece is attached only in /api/member/opinions, behind a check that the
 * caller wrote it. A count says how a piece landed; a list says what a
 * particular person endorsed, and that is the author's to see, not the
 * public's.
 */

/** Current like total for an opinion. Zero if the table is not there yet. */
async function totalFor(sb, opinionId) {
  const { count } = await sb.from('opinion_likes')
    .select('id', { count: 'exact', head: true }).eq('opinion_id', opinionId);
  return count || 0;
}

// Hashed with the app secret so neither a browser key nor an address is stored
// in a form that could be recognised again from outside the database.
const digest = (v) => crypto.createHmac('sha256', jwtSecret()).update(String(v)).digest('hex');

// A signed-out visitor may register this many likes an hour from one address.
// High enough that a family sharing a connection is never stopped, low enough
// that a script cannot manufacture a popular article.
const ANON_HOURLY_CAP = 30;

/** The member behind this request, or null. Never fails the request. */
function memberOf(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const claim = token && verifyMemberToken(token);
  return claim?.sub || null;
}

export async function POST(req) {
  const b = await readJson(req);
  const slug = String(b?.slug || '').trim();
  const wantLiked = b?.liked !== false;             // default: like
  if (!slug) return fail('INVALID', 400, { message: 'Missing article.' });

  const sb = supabaseAdmin();

  // Published pieces only. A draft's existence is not discoverable here.
  const { data: op } = await sb.from('opinions')
    .select('id').eq('slug', slug).eq('status', 'published').maybeSingle();
  if (!op) return fail('NOT_FOUND', 404, { message: 'Article not found.' });

  const memberId = memberOf(req);
  const anonRaw = String(b?.key || '').trim();
  // A signed-out caller must present a browser key. Without one there is no
  // way to stop the same visitor liking repeatedly, or to let them undo it.
  if (!memberId && anonRaw.length < 8)
    return fail('INVALID', 400, { message: 'Could not identify this browser.' });

  const ident = memberId
    ? { member_id: memberId, anon_key: null }
    : { member_id: null, anon_key: digest(anonRaw) };

  const match = (q) => memberId
    ? q.eq('opinion_id', op.id).eq('member_id', memberId)
    : q.eq('opinion_id', op.id).eq('anon_key', ident.anon_key);

  if (!wantLiked) {
    await match(sb.from('opinion_likes').delete());
    return ok({ liked: false, likes: await totalFor(sb, op.id) });
  }

  // Rate limit applies to anonymous likes only — a member is already one
  // identifiable person, and the unique index stops them counting twice.
  const ipHash = clientIp(req) ? digest(clientIp(req)) : null;
  if (!memberId && ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb.from('opinion_likes')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash).gte('created_at', since);
    if ((count || 0) >= ANON_HOURLY_CAP)
      return fail('RATE_LIMIT', 429, {
        message: 'That is a lot of likes at once. Try again a little later.',
      });
  }

  /* Insert, and treat a duplicate as success.
   *
   * Two taps in quick succession, or a retry after a dropped connection, both
   * land here. The unique index is what actually guarantees one like per
   * person; 23505 means it did its job, and the caller's state is "liked"
   * either way — which is what they asked for. */
  const { error } = await sb.from('opinion_likes')
    .insert({ opinion_id: op.id, ...ident, ip_hash: ipHash });
  if (error && error.code !== '23505') {
    return fail('LIKE_FAILED', 500, {
      message: error.message?.includes('opinion_likes')
        ? 'Likes are not set up yet. Run migration_opinion_likes.sql in Supabase.'
        : 'Could not save that. Please try again.',
      detail: error.message,
    });
  }

  return ok({ liked: true, likes: await totalFor(sb, op.id) });
}

/** The total, and whether the caller is one of them. Never who the others are. */
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const slug = String(p.get('slug') || '').trim();
  const anonRaw = String(p.get('key') || '').trim();
  if (!slug) return ok({ liked: false, likes: 0 });

  const sb = supabaseAdmin();
  const { data: op } = await sb.from('opinions')
    .select('id').eq('slug', slug).eq('status', 'published').maybeSingle();
  if (!op) return ok({ liked: false, likes: 0 });

  const likes = await totalFor(sb, op.id);

  // No identity to check against — an anonymous caller with no browser key
  // still gets the total, they just cannot be told they liked it.
  const memberId = memberOf(req);
  if (!memberId && anonRaw.length < 8) return ok({ liked: false, likes });

  let q = sb.from('opinion_likes').select('id').eq('opinion_id', op.id).limit(1);
  q = memberId ? q.eq('member_id', memberId) : q.eq('anon_key', digest(anonRaw));

  // A missing table means likes are not migrated yet. An unliked heart is the
  // right answer for the reader; it is not their problem.
  const { data } = await q;
  return ok({ liked: !!(data && data.length), likes });
}
