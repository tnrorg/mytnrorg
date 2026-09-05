import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { AUDIENCE_KINDS } from '@/lib/meetings';
import { MEMBER_FIELDS, resolveAudience } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* Who can be invited.
 *
 * Feeds the participant picker: a member search, the group targets with live
 * counts, and a preview of how many distinct people a given selection reaches.
 *
 * Returns ONLY the fields in MEMBER_FIELDS. A picker needs a name, a photo, a
 * membership ID and a role to identify someone — it does not need their mobile
 * number, address or date of birth, and this route is reachable by every admin
 * holding the meetings scope.
 */

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim();
  const sb = supabaseAdmin();

  const active = () => sb.from('membership_members')
    .select(MEMBER_FIELDS).eq('status', 'active').is('deleted_at', null);

  // ── Member search for the picker ──
  if (q) {
    /* Two plain queries rather than one .or() with the term interpolated into
     * a filter string. A comma or a parenthesis typed into the search box
     * would otherwise change what the filter MEANS, not just what it matches —
     * the same trap that was fixed in the membership duplicate check. */
    const like = `%${q.replace(/[%_]/g, m => `\\${m}`)}%`;
    const [byName, byId] = await Promise.all([
      active().ilike('full_name', like).limit(25),
      active().ilike('membership_id', like).limit(25),
    ]);
    const seen = new Map();
    for (const m of [...(byName.data || []), ...(byId.data || [])]) seen.set(m.id, m);
    return ok({ members: [...seen.values()].slice(0, 30) });
  }

  // ── Group targets, with how many people are actually behind each ──
  const counts = {};
  const { count: all } = await sb.from('membership_members')
    .select('id', { count: 'exact', head: true }).eq('status', 'active').is('deleted_at', null);
  counts.all = all || 0;

  for (const role of ['advisory', 'cec', 'uc_team', 'general']) {
    const { count } = await sb.from('membership_members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active').is('deleted_at', null).eq('role', role);
    counts[role] = count || 0;
  }

  // Union Councils that actually have active members. A dropdown listing UCs
  // with nobody in them produces invitations to an empty set.
  const { data: ucRows } = await active().not('union_council', 'is', null).limit(2000);
  const ucCounts = {};
  for (const m of (ucRows || [])) {
    const uc = String(m.union_council || '').trim();
    if (uc) ucCounts[uc] = (ucCounts[uc] || 0) + 1;
  }
  const unionCouncils = Object.entries(ucCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, n]) => ({ name, count: n }));

  return ok({ kinds: AUDIENCE_KINDS, counts, unionCouncils });
}

/** Preview: how many distinct people does this selection actually reach? */
export async function POST(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  let b = {};
  try { b = await req.json(); } catch { /* empty selection */ }

  const targets = Array.isArray(b.audience) ? b.audience : [];
  const explicit = Array.isArray(b.member_ids) ? b.member_ids : [];
  if (!targets.length && !explicit.length) return ok({ count: 0, people: [] });

  // resolveAudience already de-duplicates across overlapping targets, which is
  // the whole point of showing this number: "All members + Advisory Council"
  // is 293 people, not 293 + 12.
  const people = await resolveAudience(targets, explicit);
  return ok({ count: people.length });
}
