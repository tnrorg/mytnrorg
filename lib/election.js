import { supabaseAdmin } from './supabaseServer';

// Returns the election to vote in: the Active one, else most recent.
export async function getActiveElection() {
  const sb = supabaseAdmin();
  // 1) A live election wins (admin intent): Active > Paused > Ended.
  for (const status of ['Active', 'Paused', 'Ended']) {
    const { data } = await sb.from('elections').select('*').eq('status', status)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  // 2) Otherwise prefer the most recent election that actually HAS candidates,
  //    so an empty seed/duplicate election can never hijack the public page.
  const { data: cids } = await sb.from('candidates').select('election_id');
  const withCands = new Set((cids || []).map(c => c.election_id));
  const { data: all } = await sb.from('elections').select('*').order('created_at', { ascending: false });
  const hit = (all || []).find(e => withCands.has(e.id));
  if (hit) return hit;
  // 3) Fallback: the most recently created election.
  return (all && all[0]) || null;
}
export function isVotingOpen(e) {
  if (!e || e.status !== 'Active') return false;
  const now = Date.now();
  if (e.starts_at && now < new Date(e.starts_at).getTime()) return false;
  if (e.ends_at && now > new Date(e.ends_at).getTime()) return false;
  return true;
}
export async function getSettings(electionId) {
  const sb = supabaseAdmin();
  const { data } = await sb.from('result_settings').select('*').eq('election_id', electionId).maybeSingle();
  return data || { hide_results_during: true, show_participation_only: true, show_full_after_end: true, admin_live_preview: true, result_mode: 'after_close' };
}
