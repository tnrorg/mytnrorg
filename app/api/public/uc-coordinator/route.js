import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* Is UC Coordinator recruitment open? — the public answer.
 *
 * WHAT THIS RETURNS, AND WHAT IT WILL NEVER RETURN
 *
 * Four fields: whether a call is open, its title, its summary and its closing
 * date. That is the entire payload.
 *
 * It does NOT touch uc_coordinator_applications. Not a count, not a name, not
 * "3 people have applied for UC Stak". This endpoint is reachable by anyone on
 * the internet with no credentials at all, and an applicant count broken down
 * by Union Council would tell a prospective candidate exactly how much
 * competition they face — and tell everyone in a small community roughly who
 * must have applied. The committee sees that; the public does not.
 *
 * The columns are named explicitly rather than select('*') for the same
 * reason: a column added to the rounds table later — an internal note, a
 * shortlist, a reviewer's name — would otherwise be published the moment it
 * was created, with nobody having decided to publish it.
 */
export async function GET() {
  const sb = supabaseAdmin();

  const { data, error } = await sb.from('uc_coordinator_rounds')
    .select('title, summary, closes_on')
    .eq('status', 'open')
    .maybeSingle();

  /* An error here means the migration has not run. The public page must not
   * show an error for that — from a visitor's point of view "no recruitment is
   * open" is the correct and complete answer, and a database hint on a
   * governance page tells them nothing they can use. The admin screen is where
   * the missing migration is reported. */
  if (error || !data) return ok({ open: false });

  /* A round whose closing date has passed is not open, whatever the status
   * column says — the committee may simply not have closed it yet. Checked on
   * the server, in TNR time, so a visitor's device clock cannot change the
   * answer. */
  if (data.closes_on) {
    const end = new Date(`${data.closes_on}T23:59:59+05:00`).getTime();
    if (Number.isFinite(end) && Date.now() > end) return ok({ open: false });
  }

  return ok({
    open: true,
    title: data.title || 'TNR Union Council Coordinator',
    summary: data.summary || '',
    closes_on: data.closes_on || null,
  });
}
