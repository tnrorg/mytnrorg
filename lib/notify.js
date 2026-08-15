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

/** Preview of a comment, for the notification body. */
export const excerpt = (s, n = 140) => {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};
