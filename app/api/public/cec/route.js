import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Public, read-only: the Executive Committee positions currently advertised.
 *
 * Applications are NEVER returned here. This endpoint exists so the public
 * page can list what is open — nothing about who has applied is public.
 *
 * Drafts are excluded server-side rather than hidden in the UI, so an unfinished
 * advert cannot be read by calling the endpoint directly.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().from('cec_vacancies')
      .select('id, title, seats, summary, scenario_question, responsibilities, requirements, eligibility_note, closes_on, status, sort_order')
      .in('status', ['open', 'closed'])
      .order('sort_order').order('title');
    if (error) return ok({ vacancies: [] });

    const today = new Date().toISOString().slice(0, 10);
    const vacancies = (data || []).map(v => ({
      ...v,
      // A passed deadline closes the advert on its own. Relying on someone
      // remembering to flip the status is how a form stays open for a month
      // after the closing date.
      accepting: v.status === 'open' && (!v.closes_on || v.closes_on >= today),
    }));

    return ok({ vacancies });
  } catch {
    return ok({ vacancies: [] });
  }
}
