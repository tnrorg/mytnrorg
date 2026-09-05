import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { settingsFromBody } from '@/lib/projectWrite';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_projects_v2.sql in the Supabase SQL Editor.';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin().from('project_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });
  return ok({ settings: data || { id: 1, currency: 'PKR' } });
}

export async function PATCH(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const patch = settingsFromBody(await readJson(req));

  const { data, error } = await supabaseAdmin().from('project_settings')
    .upsert(patch, { onConflict: 'id' }).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({
    action: 'PROJECT_SETTINGS_UPDATED', actor: admin.username,
    details: 'Development projects page', ip: clientIp(req),
  });
  return ok({ settings: data, message: 'Saved.' });
}
