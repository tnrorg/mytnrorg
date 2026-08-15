import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyMemberToken } from '@/lib/membership/auth';
import { getAdmin } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/api';
import { cleanComment, validateComment, withinEditWindow, EDIT_WINDOW_MINUTES } from '@/lib/opinionComments';
import { notifyMember, excerpt, NOTIFY } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/* Comments on a published opinion.
 *
 *   GET    — anyone. Live comments, oldest first.
 *   POST   — signed-in members only.
 *   DELETE — the comment's author, the author of the piece, or any admin.
 *
 * Comment text is stored and returned PLAIN. It is never interpreted as
 * markup anywhere; the page renders each paragraph as a React text node, which
 * escapes it. Storing plain text and escaping at render is the whole defence,
 * and it is why there is no rich editor here.
 */

/** The signed-in member's id, or null. Never fails the request. */
function memberOf(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const claim = token && verifyMemberToken(token);
  return claim?.sub || null;
}

/** An admin may moderate from the panel; the same endpoint serves both. */
function adminOf(req) {
  const a = getAdmin(req);
  return a?.username || null;
}

/** The published opinion behind a slug, with its author. */
async function opinionBySlug(sb, slug) {
  const { data } = await sb.from('opinions')
    .select('id, member_id').eq('slug', slug).eq('status', 'published').maybeSingle();
  return data || null;
}

export async function GET(req) {
  const slug = String(new URL(req.url).searchParams.get('slug') || '').trim();
  if (!slug) return ok({ comments: [] });

  const sb = supabaseAdmin();
  const op = await opinionBySlug(sb, slug);
  if (!op) return ok({ comments: [] });

  const { data, error } = await sb.from('opinion_comments')
    .select('id, member_id, body, created_at, edited_at, parent_id')
    .eq('opinion_id', op.id).is('deleted_at', null)
    .order('created_at', { ascending: true }).limit(500);

  // No table yet means the migration has not been run. An empty thread is the
  // right answer for a reader; a broken page is not.
  if (error) return ok({ comments: [], author_id: op.member_id });

  const ids = [...new Set((data || []).map(c => c.member_id))];
  let people = {};
  if (ids.length) {
    const { data: mem } = await sb.from('membership_members')
      .select('id, full_name, membership_id, photo_url, photo_public, gender')
      .in('id', ids).is('deleted_at', null);
    people = Object.fromEntries((mem || []).map(m => [m.id, {
      full_name: m.full_name,
      membership_id: m.membership_id,
      // photo_public honoured exactly as in the directory. Commenting is not
      // consent to publish a face.
      photo_url: m.photo_public === false ? null : (m.photo_url || null),
      gender: m.gender,
    }]));
  }

  return ok({
    // The page needs this to know whether the reader is the author, and so
    // may remove comments on their own piece.
    author_id: op.member_id,
    comments: (data || []).map(c => ({
      id: c.id,
      member_id: c.member_id,
      parent_id: c.parent_id || null,
      body: c.body,
      created_at: c.created_at,
      edited_at: c.edited_at || null,
      author: people[c.member_id] || null,
    })),
  });
}

export async function POST(req) {
  const b = await readJson(req);
  const slug = String(b?.slug || '').trim();
  const body = cleanComment(b?.body);

  const memberId = memberOf(req);
  if (!memberId) return fail('SIGN_IN_REQUIRED', 401, {
    message: 'Please sign in to your member portal to comment.',
  });

  const problem = validateComment(body);
  if (problem) return fail('INVALID', 400, { message: problem });

  const sb = supabaseAdmin();
  const op = await opinionBySlug(sb, slug);
  if (!op) return fail('NOT_FOUND', 404, { message: 'Article not found.' });

  /* Flood check, per member rather than per address.
   *
   * Every comment is tied to a named account, so the account is the right
   * thing to limit — and unlike an IP, it does not punish a whole village
   * sharing one connection. Ten in five minutes is far beyond a real
   * conversation and well short of anything a person would notice. */
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await sb.from('opinion_comments')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId).gte('created_at', since);
  if ((count || 0) >= 10) return fail('RATE_LIMIT', 429, {
    message: 'You have posted several comments just now. Please wait a few minutes.',
  });

  /* Resolve the parent, and flatten deeper nesting.
   *
   * Replying to a reply attaches to that reply's PARENT, so a thread is never
   * more than two deep. Enforced here rather than trusted from the client:
   * the browser sends whatever comment the reader clicked, and normalising it
   * is what keeps the rule true for every route into this endpoint. */
  let parentId = null;
  let parentOwner = null;
  if (b?.parent_id) {
    const { data: parent } = await sb.from('opinion_comments')
      .select('id, member_id, parent_id, opinion_id, deleted_at')
      .eq('id', String(b.parent_id)).maybeSingle();
    // Must exist, be live, and belong to THIS article — otherwise a reply
    // could be smuggled onto a different piece.
    if (parent && !parent.deleted_at && parent.opinion_id === op.id) {
      parentId = parent.parent_id || parent.id;
      parentOwner = parent.member_id;
    }
  }

  const { data, error } = await sb.from('opinion_comments')
    .insert({ opinion_id: op.id, member_id: memberId, body, parent_id: parentId })
    .select('id, member_id, body, created_at, edited_at, parent_id').single();

  if (error) return fail('COMMENT_FAILED', 500, {
    message: /opinion_comments/i.test(error.message || '')
      ? 'Comments are not set up yet. Run migration_opinion_comments.sql in Supabase.'
      : 'Could not post your comment. Please try again.',
    detail: error.message,
  });

  const { data: me } = await sb.from('membership_members')
    .select('full_name, membership_id, photo_url, photo_public, gender')
    .eq('id', memberId).maybeSingle();

  /* Tell the people this concerns.
   *
   * A reply notifies the person being answered. A top-level comment notifies
   * the writer of the article. Never both for one comment, and never the
   * person who just typed it — notifyMember drops self-notifications, so a
   * member replying to their own thread gets nothing.
   *
   * Not awaited as a barrier to the response: the comment is already saved,
   * and a member should not wait on bookkeeping to see their own words. */
  const who = me?.full_name || 'A member';
  const link = `/media/opinions/${slug}`;
  if (parentId && parentOwner) {
    await notifyMember({
      memberId: parentOwner, actorId: memberId,
      title: `${who} replied to your comment`,
      body: excerpt(body), link, category: NOTIFY.REPLY_TO_COMMENT,
    });
  } else if (!parentId) {
    await notifyMember({
      memberId: op.member_id, actorId: memberId,
      title: `${who} commented on your opinion`,
      body: excerpt(body), link, category: NOTIFY.COMMENT_ON_OPINION,
    });
  }

  return ok({
    comment: {
      ...data,
      author: me ? {
        full_name: me.full_name,
        membership_id: me.membership_id,
        photo_url: me.photo_public === false ? null : (me.photo_url || null),
        gender: me.gender,
      } : null,
    },
  });
}

/* Edit your own comment, briefly.
 *
 * Only the writer, only within the edit window, and the row is marked as
 * edited afterwards. Not the author of the piece and not an admin: their power
 * is to REMOVE something, not to change what somebody else is recorded as
 * having said. Those are different powers and should not be confused.
 */
export async function PATCH(req) {
  const b = await readJson(req);
  const id = String(b?.id || '').trim();
  const body = cleanComment(b?.body);
  if (!id) return fail('INVALID', 400, { message: 'Missing comment.' });

  const memberId = memberOf(req);
  if (!memberId) return fail('SIGN_IN_REQUIRED', 401, { message: 'Please sign in.' });

  const problem = validateComment(body);
  if (problem) return fail('INVALID', 400, { message: problem });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from('opinion_comments')
    .select('id, member_id, created_at, deleted_at').eq('id', id).maybeSingle();
  if (!c || c.deleted_at) return fail('NOT_FOUND', 404, { message: 'Comment not found.' });

  if (c.member_id !== memberId)
    return fail('FORBIDDEN', 403, { message: 'You can only edit your own comment.' });

  if (!withinEditWindow(c.created_at))
    return fail('TOO_LATE', 403, {
      message: `Comments can be edited for ${EDIT_WINDOW_MINUTES} minutes after posting. `
        + 'You can still delete it.',
    });

  const now = new Date().toISOString();
  const { error } = await sb.from('opinion_comments')
    .update({ body, edited_at: now, updated_at: now }).eq('id', id);
  if (error) return fail('EDIT_FAILED', 500, { message: 'Could not save that change.' });

  return ok({ id, body, edited_at: now });
}

export async function DELETE(req) {
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing comment.' });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from('opinion_comments')
    .select('id, member_id, opinion_id, deleted_at').eq('id', id).maybeSingle();
  if (!c || c.deleted_at) return fail('NOT_FOUND', 404, { message: 'Comment not found.' });

  const adminName = adminOf(req);
  const memberId = memberOf(req);

  /* Three people may remove a comment, and the reason is recorded.
   *
   * Decided HERE from the verified identity, never from anything the client
   * sends. The page hides the delete button from everyone else, but a hidden
   * button is a tidy interface, not a permission. */
  const { data: op } = await sb.from('opinions')
    .select('member_id').eq('id', c.opinion_id).maybeSingle();

  let by = null;
  if (adminName) by = `admin:${adminName}`;
  else if (memberId && memberId === c.member_id) by = 'self';
  else if (memberId && op?.member_id && memberId === op.member_id) by = 'author';

  if (!by) return fail('FORBIDDEN', 403, {
    message: 'You can only remove your own comment, or a comment on your own article.',
  });

  // Soft delete: hidden from the thread, still on the record along with who
  // removed it — the question "why did my comment vanish?" arrives later, and
  // a hard delete cannot answer it.
  const { error } = await sb.from('opinion_comments')
    .update({ deleted_at: new Date().toISOString(), deleted_by: by, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not remove that comment.' });

  return ok({ removed: true, by });
}
