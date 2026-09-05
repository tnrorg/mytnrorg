import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { cleanAreaName } from '@/lib/membership/areaName';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const table = (t) => (t === 'village' ? 'membership_villages' : 'membership_union_councils');

/**
 * Rewrite an area name on the member records that use it.
 *
 * Member rows store village and union council as plain text, not a foreign
 * key. Renaming an area therefore used to strand every existing member on the
 * old spelling: their village showed as "not on the managed list" and the
 * counts split across two entries. The rename now carries through.
 *
 * Matching is case-insensitive (ilike, no wildcards), so a record reading
 * "HARDASS" is corrected alongside one reading "Hardass" — everyone ends up on
 * the exact managed spelling.
 */
async function renameOnMembers(sb, { field, from, to, councilName }) {
  if (!from || !to || from === to) return 0;

  let q = sb.from('membership_members').select('id').ilike(field, from);
  // A village name is only unique within its council, so scope the rewrite —
  // two councils could each contain a "Bagordo".
  if (field === 'village' && councilName) q = q.ilike('union_council', councilName);

  const { data: hits } = await q;
  if (!hits?.length) return 0;

  await sb.from('membership_members')
    .update({ [field]: to, updated_at: new Date().toISOString() })
    .in('id', hits.map(h => h.id));
  return hits.length;
}

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const isVillage = b.type === 'village';

  const patch = {};
  if ('name' in b) patch.name = cleanAreaName(b.name);
  if ('active' in b) patch.active = !!b.active;
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 0;
  if ('union_council_id' in b) patch.union_council_id = b.union_council_id;
  if (!Object.keys(patch).length) return fail('INVALID', 400, { message: 'Nothing to update.' });

  // Read the row BEFORE updating: once it is written the old name is gone, and
  // the old name is exactly what the member records still hold.
  const { data: before } = await sb.from(table(b.type))
    .select('*').eq('id', params.id).maybeSingle();
  if (!before) return fail('NOT_FOUND', 404, { message: 'Area not found.' });

  const { data, error } = await sb.from(table(b.type))
    .update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message });

  let membersUpdated = 0;
  if (patch.name && patch.name !== before.name) {
    if (isVillage) {
      const { data: uc } = await sb.from('membership_union_councils')
        .select('name').eq('id', before.union_council_id).maybeSingle();
      membersUpdated = await renameOnMembers(sb, {
        field: 'village', from: before.name, to: patch.name, councilName: uc?.name,
      });
    } else {
      membersUpdated = await renameOnMembers(sb, {
        field: 'union_council', from: before.name, to: patch.name,
      });
    }
  }

  await logAudit({
    action: 'AREA_UPDATED', actor: admin.username,
    details: `${before.name} → ${patch.name || before.name}` +
      (membersUpdated ? ` (${membersUpdated} member record${membersUpdated === 1 ? '' : 's'} updated)` : ''),
    ip: clientIp(req),
  });

  return ok({
    row: data,
    membersUpdated,
    message: membersUpdated
      ? `Renamed — ${membersUpdated} member record${membersUpdated === 1 ? '' : 's'} updated to match.`
      : 'Renamed.',
  });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const type = new URL(req.url).searchParams.get('type');

  // Members hold the area as text, so deleting a list entry does not erase
  // anyone's village — the record keeps the name, it just stops appearing in
  // the dropdowns. Report the count so the admin knows what is left behind.
  const { data: before } = await sb.from(table(type)).select('*').eq('id', params.id).maybeSingle();
  let affected = 0;
  if (before) {
    const field = type === 'village' ? 'village' : 'union_council';
    const { data: hits } = await sb.from('membership_members').select('id').ilike(field, before.name);
    affected = hits?.length || 0;
  }

  // Deleting a council cascades to its villages (FK on delete cascade).
  const { error } = await sb.from(table(type)).delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });

  await logAudit({
    action: 'AREA_DELETED', actor: admin.username,
    details: `${before?.name || params.id}` +
      (affected ? ` (${affected} member record(s) still reference it)` : ''),
    ip: clientIp(req),
  });
  return ok({
    affected,
    message: affected
      ? `Deleted — ${affected} member record${affected === 1 ? '' : 's'} still list this area. Reassign them under Members.`
      : 'Deleted.',
  });
}
