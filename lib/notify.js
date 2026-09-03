import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseServer';

/* Member notifications.
 *
 * One place that writes to membership_notifications, so every notification in
 * the portal has the same shape and the rules below hold everywhere.
 *
 * THE RULES
 *   1. Never notify someone about their own action. A bell that lights up
 *      because you did something teaches people to ignore the bell.
 *   2. Never fail the request that caused it. A comment that saved but could
 *      not be announced is a working comment; throwing here would lose it.
 *   3. Always carry a link. A notification you cannot act on is just noise.
 */

export const NOTIFY = {
  COMMENT_ON_OPINION: 'comment',
  REPLY_TO_COMMENT: 'reply',
};

/**
 * @param {object}   n
 * @param {string}   n.memberId  who receives it
 * @param {string}   n.actorId   who caused it — skipped when the two match
 * @param {string}   n.title
 * @param {string}   [n.body]
 * @param {string}   [n.link]
 * @param {string}   [n.category]
 */
export async function notifyMember({ memberId, actorId, title, body, link, category = 'general' }) {
  if (!memberId || !title) return;
  if (actorId && String(actorId) === String(memberId)) return;   // rule 1

  try {
    await supabaseAdmin().from('membership_notifications').insert({
      member_id: memberId,
      title: String(title).slice(0, 200),
      // Trimmed to a readable preview. The full text is one click away at the
      // link, and a notification list of essays is a notification list nobody
      // reads.
      body: body ? String(body).slice(0, 300) : null,
      link: link || null,
      category,
    });
  } catch {
    // rule 2 — deliberately silent
  }
}

/**
 * The same notification to many members, in one insert per batch.
 *
 * WHY NOT JUST LOOP notifyMember: inviting "all active members" is 293 people.
 * That loop is 293 sequential round trips to Supabase inside one serverless
 * invocation — it would run for minutes and hit the time limit, and the admin
 * would be left with a meeting that was created but announced to only some of
 * the list, with no way to tell which.
 *
 * Chunked because Postgres has a parameter ceiling and a single 300-row insert
 * that fails takes everything with it; 100 at a time means one bad batch loses
 * one batch. Obeys the same three rules as notifyMember, including never
 * throwing into the caller.
 *
 * @param {string[]} memberIds
 */
export async function notifyMembers(memberIds, { actorId, title, body, link, category = 'general' }) {
  const ids = [...new Set((memberIds || []).map(String).filter(Boolean))]
    .filter(id => !actorId || id !== String(actorId));      // rule 1
  if (!ids.length || !title) return { sent: 0 };

  const row = (member_id) => ({
    member_id,
    title: String(title).slice(0, 200),
    body: body ? String(body).slice(0, 300) : null,
    link: link || null,
    category,
  });

  let sent = 0;
  const sb = supabaseAdmin();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const { error } = await sb.from('membership_notifications').insert(chunk.map(row));
      if (!error) sent += chunk.length;
    } catch {
      // rule 2 — a meeting that saved but could not be announced is still a
      // meeting. The caller reports how many were reached.
    }
  }
  return { sent, total: ids.length };
}

/** Preview of a comment, for the notification body. */
export const excerpt = (s, n = 140) => {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};
