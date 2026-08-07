import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_cec_recruitment.sql in the Supabase SQL Editor.';

/* Admin only. Returns the full application, including contact details — this
 * is the panel's working view, and it sits behind requireAdmin. Nothing from
 * this table is exposed by any public endpoint. */
export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  const vacancy = url.searchParams.get('vacancy') || '';

  const sb = supabaseAdmin();
  let q = sb.from('cec_applications').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (vacancy) q = q.eq('vacancy_id', vacancy);

  const { data, error } = await q;
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });

  // Position titles, so the list does not show raw ids.
  const { data: vacancies } = await sb.from('cec_vacancies').select('id, title');
  const titles = Object.fromEntries((vacancies || []).map(v => [v.id, v.title]));

  return ok({
    applications: (data || []).map(a => ({ ...a, position: titles[a.vacancy_id] || '—' })),
    vacancies: vacancies || [],
  });
}
