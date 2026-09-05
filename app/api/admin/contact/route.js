import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { KIND_KEYS, STATUSES } from '@/lib/contact';

export const dynamic = 'force-dynamic';

/* The contact inbox, for admins.
 *
 * `ip` and `user_agent` are stored but deliberately NOT selected. They exist
 * so a flood of abuse can be investigated, not so the committee browses where
 * people wrote from. Anything not needed to answer a message stays out of the
 * response.
 */
const FIELDS =
  'id, kind, name, email, mobile, membership_id, subject, message, ' +
  'status, admin_notes, handled_by, handled_at, created_at';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;

  const p = new URL(req.url).searchParams;
  const kind = p.get('kind') || '';
  const status = p.get('status') || '';
  const search = (p.get('search') || '').trim();

  let q = supabaseAdmin().from('contact_messages')
    .select(FIELDS)
    .order('created_at', { ascending: false })
    .limit(500);

  if (kind && KIND_KEYS.includes(kind)) q = q.eq('kind', kind);
  if (status && STATUSES.includes(status)) q = q.eq('status', status);
  if (search) {
    const like = `%${search.replace(/[%_]/g, '')}%`;
    q = q.or(`name.ilike.${like},email.ilike.${like},subject.ilike.${like},membership_id.ilike.${like}`);
  }

  const { data, error } = await q;
  if (error) {
    return fail('READ_FAILED', 500, {
      message: 'Could not load messages.',
      detail: error.message,
      hint: 'Run supabase/migration_contact_messages.sql in the Supabase SQL Editor.',
    });
  }

  // Counts for the filter chips, so an admin can see there are unread
  // messages without switching filters to find out.
  const { data: all } = await supabaseAdmin().from('contact_messages').select('status, kind');
  const counts = { total: (all || []).length, new: 0 };
  for (const r of all || []) if (r.status === 'new') counts.new += 1;

  return ok({ messages: data || [], counts });
}
