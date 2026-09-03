import 'server-only';

/* Rate limits for the AI features.
 *
 * IN-MEMORY, and honest about what that means: each serverless instance keeps
 * its own counters, so someone spread across several cold starts gets more
 * than the nominal allowance. It is a COST GUARD, not a security control —
 * enough to stop a single browser hammering the endpoint or a script pointing
 * at a public route, which is what actually burns a free-tier quota.
 *
 * A shared limit would need Redis or a Postgres table on every request. That
 * is worth adding if abuse ever appears; it is not worth the round trip now,
 * and pretending an in-memory Map is a hard limit would be the real mistake.
 *
 * The real protections are elsewhere and are exact: the meeting AI is behind
 * an admin scope, and the transcription job takes a database lock so the same
 * meeting cannot be billed twice.
 */

const buckets = new Map();

/* Bounded, because a Map keyed by IP on a long-lived instance is a slow leak.
 * Old entries are dropped whenever the map gets large — imprecise under load,
 * which is acceptable for a spend guard. */
const MAX_KEYS = 5000;

function take(key, { max, windowMs }) {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.reset < now) buckets.delete(k);
      if (buckets.size <= MAX_KEYS / 2) break;
    }
  }

  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

/* Homepage chat: PUBLIC and unauthenticated, so the tightest limit.
 * Twelve questions a minute is far more than a person types and far less than
 * a script costs. */
export const allowAsk = (ip) =>
  take(`ask:${ip}`, { max: 12, windowMs: 60_000 });

/* Meeting AI: authenticated and admin-scoped already, so this only guards
 * against a double-click or an impatient retry. Transcribing an hour of audio
 * is the expensive call in this whole application. */
export const allowMeetingAi = (adminOrMemberId) =>
  take(`meetingai:${adminOrMemberId}`, { max: 6, windowMs: 10 * 60_000 });
