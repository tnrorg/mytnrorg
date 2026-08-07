import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { vacancyFromBody } from '@/lib/cecWrite';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_cec_recruitment.sql in the Supabase SQL Editor.';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  const { data, error } = await sb.from('cec_vacancies')
    .select('*').order('sort_order').order('title');
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });

  // Application counts per position, so the admin sees interest at a glance
  // without opening each advert.
  const { data: apps } = await sb.from('cec_applications').select('vacancy_id, status');
  const counts = {};
  for (const a of apps || []) {
    counts[a.vacancy_id] ??= { total: 0, new: 0 };
    counts[a.vacancy_id].total++;
    if (a.status === 'new') counts[a.vacancy_id].new++;
  }

  return ok({ vacancies: (data || []).map(v => ({ ...v, counts: counts[v.id] || { total: 0, new: 0 } })) });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!String(b.title || '').trim()) {
    return fail('MISSING', 400, { message: 'Give the position a title.' });
  }

  const { data, error } = await supabaseAdmin().from('cec_vacancies')
    .insert(vacancyFromBody(b)).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({ action: 'CEC_VACANCY_ADDED', actor: admin.username, details: data?.title || '', ip: clientIp(req) });
  return ok({ vacancy: data, message: 'Position added.' });
}
