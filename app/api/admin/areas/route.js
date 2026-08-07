import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { cleanAreaName } from '@/lib/membership/areaName';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_areas.sql';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { data: ucs, error } = await sb.from('membership_union_councils')
    .select('*').order('sort_order').order('name');
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });
  const { data: villages } = await sb.from('membership_villages')
    .select('*').order('sort_order').order('name');
  return ok({
    councils: (ucs || []).map(u => ({
      ...u, villages: (villages || []).filter(v => v.union_council_id === u.id),
    })),
  });
}

// body: { type: 'council' | 'village', name, union_council_id?, sort_order? }
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  // Tidied on the way in, so a stray space cannot create a duplicate area.
  const name = cleanAreaName(b.name);
  if (!name) return fail('INVALID', 400, { message: 'A name is required.' });

  const sb = supabaseAdmin();
  if (b.type === 'village') {
    if (!b.union_council_id) return fail('INVALID', 400, { message: 'Choose a union council first.' });
    const { data, error } = await sb.from('membership_villages')
      .insert({ union_council_id: b.union_council_id, name, sort_order: Number(b.sort_order) || 0 })
      .select().maybeSingle();
    if (error) return fail('SAVE_FAILED', error.code === '23505' ? 409 : 500, {
      message: error.code === '23505' ? 'That village already exists in this union council.' : error.message, hint: HINT });
    await logAudit({ action: 'AREA_VILLAGE_ADDED', actor: admin.username, details: name, ip: clientIp(req) });
    return ok({ village: data });
  }

  const { data, error } = await sb.from('membership_union_councils')
    .insert({ name, sort_order: Number(b.sort_order) || 0 }).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', error.code === '23505' ? 409 : 500, {
    message: error.code === '23505' ? 'That union council already exists.' : error.message, hint: HINT });
  await logAudit({ action: 'AREA_COUNCIL_ADDED', actor: admin.username, details: name, ip: clientIp(req) });
  return ok({ council: data });
}
