import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { PUBLIC_PROJECT_COLUMNS, summarise } from '@/lib/projects';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const DEFAULT_SETTINGS = {
  page_title: 'Development Projects',
  page_intro: '',
  representative_name: '',
  representative_title: '',
  constituency: '',
  currency: 'PKR',
  source_note: '',
};

/* Public, read-only: published development schemes and their roll-ups.
 *
 * An empty list is a valid answer — the page then says no projects are
 * recorded yet, which is honest. A missing table (migration not yet run)
 * behaves the same way rather than erroring.
 *
 * Unpublished rows are excluded from the totals as well as the list, so a
 * draft entry can never inflate a published spending figure.
 */
export async function GET() {
  const empty = { projects: [], stats: summarise([]), settings: DEFAULT_SETTINGS };
  try {
    const sb = supabaseAdmin();
    const [{ data, error }, { data: cfg }] = await Promise.all([
      sb.from('tnr_projects')
        .select(PUBLIC_PROJECT_COLUMNS)
        .eq('published', true)
        .order('sort_order').order('created_at', { ascending: false }),
      sb.from('project_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (error) return ok(empty);

    const projects = data || [];
    return ok({
      projects,
      stats: summarise(projects),
      settings: { ...DEFAULT_SETTINGS, ...(cfg || {}) },
    });
  } catch {
    return ok(empty);
  }
}
