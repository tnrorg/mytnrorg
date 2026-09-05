import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { ACTIVE_STATUSES } from '@/lib/membershipStats';
import { ROLES } from '@/lib/membership/roles';
import { cleanAreaName } from '@/lib/membership/areaName';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Membership overview for the admin dashboard: every Union Council with its
// villages and head-counts, plus the split by membership type.
//
// Councils and villages come from the admin-managed area lists, so a council
// with no members yet still appears (at zero) rather than vanishing — that is
// the useful signal for an admin: where recruitment has not reached.
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  try {
    const [{ data: members, error: mErr }, { data: ucs }, { data: villages }] = await Promise.all([
      sb.from('membership_members')
        .select('membership_id, village, union_council, role')
        .in('status', ACTIVE_STATUSES).is('deleted_at', null).limit(5000),
      sb.from('membership_union_councils').select('id, name, active').order('sort_order').order('name'),
      sb.from('membership_villages').select('id, union_council_id, name, active').order('sort_order').order('name'),
    ]);
    if (mErr) return fail('READ_FAILED', 500, { message: mErr.message });

    const rows = members || [];
    const norm = (v) => (v || '').trim();
    // Match on a normalised key, not the raw string. Case alone was not
    // enough: a member record reading "UC BAGORDO /BAGHIZA" would not match the
    // corrected "UC BAGORDO/BAGHIZA" on the managed list, so the council fell
    // through as "unlisted" and the page displayed the member's spelling
    // instead of the managed one. cleanAreaName folds the punctuation spacing
    // as well, so the managed spelling always wins on screen.
    const key = (v) => cleanAreaName(v).toLowerCase();

    // Head-counts keyed by council and by "council::village", both folded.
    const byCouncil = new Map();
    const byVillage = new Map();
    // Remembers the spelling a member actually used, for anything that turns
    // out not to be on the managed list.
    const seenLabel = new Map();
    for (const m of rows) {
      const c = norm(m.union_council) || 'Unassigned';
      const v = norm(m.village) || 'Not recorded';
      const ck = key(c) || 'unassigned';
      const vk = `${ck}::${key(v) || 'not recorded'}`;
      byCouncil.set(ck, (byCouncil.get(ck) || 0) + 1);
      byVillage.set(vk, (byVillage.get(vk) || 0) + 1);
      if (!seenLabel.has(ck)) seenLabel.set(ck, c);
      if (!seenLabel.has(vk)) seenLabel.set(vk, v);
    }

    // Start from the admin-managed lists so empty areas are visible.
    const councils = (ucs || []).map(uc => {
      const ck = key(uc.name);
      const vs = (villages || []).filter(v => v.union_council_id === uc.id).map(v => ({
        name: v.name,                                   // always the managed spelling
        active: v.active,
        members: byVillage.get(`${ck}::${key(v.name)}`) || 0,
      }));
      // Villages members typed that are genuinely not on the managed list.
      const known = new Set(vs.map(v => key(v.name)));
      for (const [vk, count] of byVillage) {
        const [c, v] = vk.split('::');
        if (c === ck && !known.has(v)) {
          vs.push({ name: seenLabel.get(vk) || v, members: count, unlisted: true });
        }
      }
      return {
        name: uc.name,
        active: uc.active,
        members: byCouncil.get(ck) || 0,
        villages: vs.sort((a, b) => b.members - a.members || a.name.localeCompare(b.name)),
      };
    });

    // Councils that appear on member records but are not on the managed list.
    const listed = new Set(councils.map(c => key(c.name)));
    for (const [ck, members] of byCouncil) {
      if (listed.has(ck)) continue;
      const vs = [];
      for (const [vk, count] of byVillage) {
        const [c, v] = vk.split('::');
        if (c === ck) vs.push({ name: seenLabel.get(vk) || v, members: count, unlisted: true });
      }
      councils.push({ name: seenLabel.get(ck) || ck, members, villages: vs, unlisted: true });
    }
    councils.sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));

    const roles = ROLES.map(r => ({
      key: r.key,
      label: r.label,
      members: rows.filter(m => (m.role || 'general') === r.key).length,
    }));

    return ok({
      total: rows.length,
      councils,
      roles,
      totalCouncils: councils.filter(c => c.members > 0).length,
      totalVillages: new Set([...byVillage.keys()]).size,
      listedCouncils: (ucs || []).length,
      listedVillages: (villages || []).length,
    });
  } catch (e) {
    return fail('OVERVIEW_FAILED', 500, { message: e.message });
  }
}
