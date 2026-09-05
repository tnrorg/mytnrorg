import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { STATUSES } from '@/lib/opinions';

export const dynamic = 'force-dynamic';

/** The review queue. Pending first — that is the work. */
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;

  const status = new URL(req.url).searchParams.get('status') || '';

  let q = supabaseAdmin().from('opinions')
    .select('*')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(300);
  if (status && STATUSES.includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    return fail('READ_FAILED', 500, {
      message: 'Could not load opinions.',
      detail: error.message,
      hint: 'Run supabase/migration_opinions.sql in the Supabase SQL Editor.',
    });
  }

  /* Author details are joined here rather than stored on the opinion.
   *
   * A name copied onto the row at submission would go stale the moment the
   * member corrected their spelling or changed their photo — and the byline is
   * the one thing on the page that must match who they are now. */
  const ids = [...new Set((data || []).map(o => o.member_id))];
  let authors = {};
  if (ids.length) {
    const { data: mem } = await supabaseAdmin().from('membership_members')
      .select('id, full_name, membership_id, photo_url, role').in('id', ids);
    authors = Object.fromEntries((mem || []).map(m => [m.id, m]));
  }

  const counts = { pending: 0, published: 0, total: (data || []).length };
  for (const o of data || []) {
    if (o.status === 'pending') counts.pending += 1;
    if (o.status === 'published') counts.published += 1;
  }

  return ok({
    opinions: (data || []).map(o => ({ ...o, author: authors[o.member_id] || null })),
    counts,
  });
}
