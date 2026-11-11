import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { openFlagScores } from '@/lib/membership/duplicateDetection';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  const search = (url.searchParams.get('search') || '').trim();

  let q = supabaseAdmin().from('membership_applications').select('*')
    .order('created_at', { ascending: false }).limit(500);
  if (status) q = q.eq('status', status);
  if (search) q = q.or(
    `full_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%,reference_no.ilike.%${search}%`
  );
  // The error was previously discarded, so a failed query rendered as "no
  // applications" — indistinguishable from an empty queue. Surface it instead.
  const { data, error } = await q;
  if (error) return fail('READ_FAILED', 500, {
    message: 'Could not load applications: ' + error.message,
    hint: 'If this mentions a missing column, run the pending migrations in supabase/.',
  });

  const applications = await withMembershipIds(data || []);

  /* Attach the duplicate-check score where the reviewing happens.
   *
   * The Duplicate Check tab already lists every flagged pair, but an admin
   * approving applications works here and has no reason to open that tab
   * first — so a flag raised on an application would reliably be found after
   * the approval rather than before it. One extra field on this list is what
   * makes detection actually reach the decision it exists to inform.
   *
   * Cosmetic and non-fatal, exactly like the membership numbers above: no
   * score simply means no badge. */
  const flags = await openFlagScores('application', applications.map(a => a.id));
  for (const a of applications) {
    const s = flags.get(a.id);
    if (s) a.duplicate_score = s;
  }

  return ok({ applications, total: applications.length });
}

/**
 * Approving an application creates a row in `membership_members` carrying the
 * permanent membership number (TNR-MN-0001…). The applications table has no
 * such column, so the number was invisible in this list. Look it up and attach
 * it, keyed on the `application_id` the approval writes back.
 *
 * A failure here is non-fatal — the list still renders, just without numbers.
 */
async function withMembershipIds(apps) {
  const ids = apps.filter(a => a.status === 'Approved').map(a => a.id);
  if (!ids.length) return apps;

  try {
    const { data, error } = await supabaseAdmin()
      .from('membership_members')
      .select('application_id, membership_id, status')
      .in('application_id', ids)
      .is('deleted_at', null);
    if (error) return apps;

    const byApp = new Map(
      (data || []).map(m => [m.application_id, m])
    );
    return apps.map(a => {
      const m = byApp.get(a.id);
      return m
        ? { ...a, membership_id: m.membership_id, member_status: m.status }
        : a;
    });
  } catch {
    return apps;
  }
}
