import { supabaseAdmin } from '@/lib/supabaseServer';
import { getActiveElection, getSettings, isVotingOpen } from '@/lib/election';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
const CANONICAL_ORG = { name: 'Tehreek-e-Nojawanan Roundu', short_name: 'TNR' };

// Effective public visibility of vote data given the admin mode + election state.
// Returns one of: 'full' | 'percent' | 'leading' | 'hidden'
function effectiveVisibility(mode, { ended, votingOpen, published }) {
  if (ended || published) return (mode === 'hidden' && !published) ? 'hidden' : 'full';
  if (!votingOpen) return 'hidden';                 // not started / paused
  if (mode === 'after_close') return 'hidden';      // hide during voting, reveal after close
  return ['full', 'percent', 'leading', 'hidden'].includes(mode) ? mode : 'hidden';
}

export async function GET() {
  const sb = supabaseAdmin();
  const { data: org } = await sb.from('organizations').select('*').limit(1).maybeSingle();
  if (org) { org.name = CANONICAL_ORG.name; org.short_name = CANONICAL_ORG.short_name; }
  const e = await getActiveElection();
  if (!e) return ok({ org: org || null, election: null });

  const settings = await getSettings(e.id);
  const now = Date.now();
  const votingOpen = isVotingOpen(e);
  const ended = e.status === 'Ended' || (e.ends_at && now > new Date(e.ends_at).getTime());
  const vis = effectiveVisibility(settings.result_mode || 'after_close', { ended, votingOpen, published: e.result_published });

  const { data: positions } = await sb.from('positions').select('*').eq('election_id', e.id).order('sort_order');
  const { data: candidates } = await sb.from('candidates').select('*').eq('election_id', e.id).eq('status', 'Active').order('sort_order');
  const { data: votes } = await sb.from('votes').select('candidate_id, member_id').eq('election_id', e.id);
  const { data: unions } = await sb.from('unions').select('id, union_name');
  const umap = Object.fromEntries((unions || []).map(u => [u.id, u.union_name]));
  const tally = {}; for (const v of votes || []) tally[v.candidate_id] = (tally[v.candidate_id] || 0) + 1;

  const showCounts = vis === 'full';
  const showPercent = vis === 'full' || vis === 'percent';
  const showLeading = vis === 'full' || vis === 'percent' || vis === 'leading';

  const positionsOut = (positions || []).map(p => {
    const cands = (candidates || []).filter(c => c.position_id === p.id);
    const total = cands.reduce((s, c) => s + (tally[c.id] || 0), 0);
    const withVotes = cands.map((c, i) => ({ c, v: tally[c.id] || 0, i }));
    const max = Math.max(0, ...withVotes.map(x => x.v));
    const leaders = withVotes.filter(x => x.v === max && max > 0);
    const tie = leaders.length > 1 || (max === 0);
    const out = withVotes.map(({ c, v, i }) => {
      const percent = total ? Math.round((v / total) * 1000) / 10 : 0;
      const other = withVotes.find(x => x.c.id !== c.id);
      const margin = other ? v - other.v : 0;
      let statusBadge = null;
      if (showLeading) {
        // ELECTED only after the election has actually ENDED. While voting is open
        // (even if results are published), show LEADING / TRAILING / TIED.
        if (ended) statusBadge = (v === max && max > 0 && !tie) ? 'ELECTED' : (tie ? 'TIED' : null);
        else statusBadge = tie ? 'TIED' : (v === max ? 'LEADING' : 'TRAILING');
      }
      return {
        id: c.id, name: c.name, number: i + 1, symbol: c.symbol, symbol_url: c.symbol_url,
        photo_url: c.photo_url, region: umap[c.union_id] || null,
        qualification: c.education || null, manifesto: c.manifesto || null,
        votes: showCounts ? v : null,
        percent: showPercent ? percent : null,
        margin: showCounts ? Math.abs(margin) : null,
        leading: showLeading ? (v === max && !tie) : null,
        status_badge: statusBadge,
        elected: ended && v === max && max > 0 && !tie,
      };
    });
    return { id: p.id, title: p.title, total: showCounts ? total : null, candidates: out };
  });

  // Safety net: surface Active candidates that have no (or an unknown) position so nothing is hidden.
  const knownPos = new Set((positions || []).map(p => p.id));
  const orphans = (candidates || []).filter(c => !c.position_id || !knownPos.has(c.position_id));
  if (orphans.length) {
    const oc = orphans.map((c, i) => ({
      id: c.id, name: c.name, number: i + 1, symbol: c.symbol, symbol_url: c.symbol_url,
      photo_url: c.photo_url, region: umap[c.union_id] || null, qualification: c.education || null,
      manifesto: c.manifesto || null, votes: showCounts ? (tally[c.id] || 0) : null,
      percent: null, margin: null, leading: null, status_badge: null, elected: false,
    }));
    positionsOut.push({ id: 0, title: 'Other Candidates', total: null, candidates: oc });
  }

  const total_voters = (await sb.from('members').select('*', { count: 'exact', head: true }).eq('status', 'Approved')).count || 0;

  // Public-awareness gender split of all approved members
  let gender = { male: 0, female: 0, other: 0 };
  {
    const { data: gm } = await sb.from('members').select('id, gender, status');
    for (const m of gm || []) {
      if (String(m.status || '').trim().toLowerCase() !== 'approved') continue;
      const g = String(m.gender || '').trim().toLowerCase();
      gender[g.startsWith('m') ? 'male' : g.startsWith('f') ? 'female' : 'other'] += 1;
    }
  }
  // One voter now produces one row per position, so turnout counts DISTINCT voters.
  const votes_cast = new Set((votes || []).map(v => v.member_id)).size;

  return ok({
    org: org || { name: 'Tehreek-e-Nojawanan Roundu', short_name: 'TNR', logo_url: '/tnr-logo.png' },
    election: {
      id: e.id, title: e.title, description: e.description, status: e.status,
      starts_at: e.starts_at, ends_at: e.ends_at,
      voting_open: votingOpen, ended, result_published: e.result_published,
    },
    visibility: vis,                      // full | percent | leading | hidden
    stats: {
      total_voters, votes_cast,
      remaining: Math.max(0, total_voters - votes_cast),
      turnout: total_voters ? Math.round((votes_cast / total_voters) * 1000) / 10 : 0,
      gender,
    },
    positions: positionsOut,
  });
}
