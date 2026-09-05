import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const election_id = new URL(req.url).searchParams.get('election_id');
  if (!election_id) return fail('MISSING', 400, { message: 'election_id required.' });
  let { data } = await sb.from('result_settings').select('*').eq('election_id', election_id).maybeSingle();
  if (!data) { ({ data } = await sb.from('result_settings').insert({ election_id }).select().maybeSingle()); }
  return ok({ settings: data });
}
export async function PATCH(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  if (!b.election_id) return fail('MISSING', 400, { message: 'election_id required.' });
  const patch = { updated_at: new Date().toISOString() };
  for (const f of ['hide_results_during','show_participation_only','show_full_after_end','admin_live_preview']) if (f in b) patch[f] = !!b[f];
  if ('result_mode' in b && ['full','percent','leading','hidden','after_close'].includes(b.result_mode)) patch.result_mode = b.result_mode;
  const { data, error } = await sb.from('result_settings').upsert({ election_id: b.election_id, ...patch }).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'RESULT_SETTINGS_UPDATED', actor: admin.username, election_id: b.election_id, ip: clientIp(req) });
  return ok({ settings: data });
}
