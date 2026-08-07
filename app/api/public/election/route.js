import { supabaseAdmin } from '@/lib/supabaseServer';
import { getActiveElection, isVotingOpen } from '@/lib/election';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const CANONICAL_ORG = { name: 'Tehreek-e-Nojawanan Roundu', short_name: 'TNR' };
export async function GET() {
  const sb = supabaseAdmin();
  const { data: org } = await sb.from('organizations').select('*').limit(1).maybeSingle();
  if (org) { org.name = CANONICAL_ORG.name; org.short_name = CANONICAL_ORG.short_name; }
  const e = await getActiveElection();
  return ok({
    org: org || { name: 'Tehreek-e-Nojawanan Roundu', short_name: 'TNR', logo_url: '/tnr-logo.png' },
    election: e ? {
      id: e.id, title: e.title, description: e.description, status: e.status,
      starts_at: e.starts_at, ends_at: e.ends_at, voting_open: isVotingOpen(e),
      voter_list_locked: e.voter_list_locked, result_published: e.result_published,
    } : null,
  });
}
