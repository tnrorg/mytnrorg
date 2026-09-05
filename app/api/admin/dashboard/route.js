import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin, hasScope } from '@/lib/guard';
import { superAdminActors, filterForNormalAdmin } from '@/lib/auditVisibility';
import { getActiveElection } from '@/lib/election';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
async function c(sb, table, filter) {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter || {})) q = q.eq(k, v);
  return (await q).count || 0;
}
export async function GET(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  /* The dashboard shows only the areas this admin works in.
   *
   * Filtered on the SERVER, not by hiding cards in the browser: an admin with
   * no election permission should not receive turnout figures at all, whether
   * or not a card is rendered for them. Sending the numbers and then choosing
   * not to draw them is not a restriction.
   *
   * `show_*` tells the client which sections exist, so it can render an
   * honest panel instead of blank cards reading zero. */
  const showElection  = hasScope(admin, 'election');
  const showMembership = hasScope(admin, 'membership');

  if (!showElection) {
    return ok({
      show_election: false, show_membership: showMembership,
      show_activity: false, recent_logs: [],
    });
  }

  const total     = await c(sb, 'members');
  const approved  = await c(sb, 'members', { status: 'Approved' });
  const pending   = await c(sb, 'members', { status: 'Pending' });
  const blocked   = await c(sb, 'members', { status: 'Blocked' });
  const e = await getActiveElection();
  let votes_cast = 0, total_voters = 0, progress = 0;
  if (e) {
    votes_cast   = await c(sb, 'votes', { election_id: e.id });
    total_voters = approved;
    progress = total_voters ? Math.round((votes_cast / total_voters) * 1000) / 10 : 0;
  }
  const active_elections = await c(sb, 'elections', { status: 'Active' });
  // Recent Activity is Super-Admin only.
  let logs = [];
  if (isSuperAdmin(admin)) {
    const { data } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(12);
    logs = data || [];
  }
  return ok({
    show_election: true, show_membership: showMembership,
    members: { total, approved, pending, blocked },
    election: e ? { id: e.id, title: e.title, status: e.status, result_published: e.result_published } : null,
    votes_cast, total_voters, remaining: Math.max(0, total_voters - votes_cast),
    progress, active_elections, recent_logs: logs, show_activity: isSuperAdmin(admin),
  });
}
