import { requireMember } from '@/lib/membership/auth';
import { ok } from '@/lib/api';
import { availableYears, attendanceRate, totalContributions } from '@/lib/contributions';
import { contributionYear, memberTimeline } from '@/lib/contributionsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

/* My Contribution — a member's own participation record.
 *
 * THE ACCESS RULE, stated once and enforced in one line:
 *
 *     the member id comes from the session token, and from nowhere else.
 *
 * There is no member_id parameter. Not an optional one, not an
 * admin-only one — none. A route that accepts an id and then checks it
 * against the caller is one forgotten check away from handing every
 * member's participation record to anyone who can edit a query string,
 * and this application talks to Postgres with the service-role key, so
 * RLS would not catch that mistake either.
 *
 * The organisation's decision was: a member sees their own record, office
 * bearers with the analytics permission see everyone's. Everyone else,
 * including other members, sees nothing. The admin route is where the
 * second half of that lives.
 */
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();

  const [{ records, meetingsHeld, missing }, timeline] = await Promise.all([
    contributionYear({ year, memberIds: [member.id] }),
    memberTimeline(member.id, year),
  ]);

  const record = records.get(member.id) || null;

  return ok({
    year,
    years: availableYears(),
    record,
    total: totalContributions(record),
    attendance_rate: attendanceRate(record?.meetings),
    /* How many meetings TNR held in total, for context.
     *
     * Deliberately NOT used as a denominator anywhere. A member invited to
     * three of forty meetings has not missed thirty-seven — they were not
     * asked to them, and a page implying otherwise would be accusing them of
     * something that never happened. It is shown as a separate fact. */
    meetings_held: meetingsHeld,
    timeline: timeline.items,
    /* Own-record only. Never a list, never another member, never a comparison
     * against anyone else — the member cannot see where they stand relative to
     * others because the organisation decided there is no such standing. */
    missing: [...new Set([...(missing || []), ...(timeline.missing || [])])],
  });
}
