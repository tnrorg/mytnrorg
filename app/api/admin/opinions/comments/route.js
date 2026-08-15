import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

/* Moderation view: every comment across every article, newest first.
 *
 * Scanning one list beats opening thirty articles to check each thread. The
 * newest comment is also the one most likely to still be a problem nobody has
 * seen — which is why the order is what it is.
 *
 * Reached under the `opinions` permission area, so an admin restricted to,
 * say, the Election Portal cannot moderate here. That is enforced centrally in
 * requireAdmin, not by this file.
 */
export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;

  const p = new URL(req.url).searchParams;
  const showRemoved = p.get('removed') === '1';

  const sb = supabaseAdmin();
  let q = sb.from('opinion_comments')
    .select('id, opinion_id, member_id, body, created_at, deleted_at, deleted_by')
    .order('created_at', { ascending: false }).limit(200);
  q = showRemoved ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);

  const { data, error } = await q;
  if (error) return ok({
    comments: [],
    hint: 'Run supabase/migration_opinion_comments.sql to enable comments.',
  });

  const rows = data || [];
  // Two lookups for the whole page rather than one per comment.
  const memberIds = [...new Set(rows.map(c => c.member_id))];
  const opinionIds = [...new Set(rows.map(c => c.opinion_id))];

  let people = {}, pieces = {};
  if (memberIds.length) {
    const { data: mem } = await sb.from('membership_members')
      .select('id, full_name, membership_id').in('id', memberIds);
    people = Object.fromEntries((mem || []).map(m => [m.id, m]));
  }
  if (opinionIds.length) {
    const { data: ops } = await sb.from('opinions')
      .select('id, slug, published_title').in('id', opinionIds);
    pieces = Object.fromEntries((ops || []).map(o => [o.id, o]));
  }

  return ok({
    comments: rows.map(c => ({
      ...c,
      author: people[c.member_id] || null,
      opinion: pieces[c.opinion_id] || null,
    })),
  });
}

/** Remove a comment. Soft delete — the row and the reason survive. */
export async function DELETE(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing comment.' });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from('opinion_comments')
    .select('id, member_id, deleted_at').eq('id', id).maybeSingle();
  if (!c) return fail('NOT_FOUND', 404, { message: 'Comment not found.' });
  if (c.deleted_at) return ok({ removed: true });     // already gone; not an error

  const now = new Date().toISOString();
  const { error } = await sb.from('opinion_comments')
    .update({ deleted_at: now, deleted_by: `admin:${admin?.username || 'admin'}`, updated_at: now })
    .eq('id', id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not remove that comment.' });

  await logAudit({
    action: 'COMMENT_REMOVED', actor: admin?.username || 'admin',
    details: `comment ${id}`, ip: clientIp(req),
  });
  return ok({ removed: true });
}

/** Put a removed comment back — for a moderation call made in error. */
export async function PATCH(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing comment.' });

  const { error } = await supabaseAdmin().from('opinion_comments')
    .update({ deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return fail('RESTORE_FAILED', 500, { message: 'Could not restore that comment.' });

  await logAudit({
    action: 'COMMENT_RESTORED', actor: admin?.username || 'admin',
    details: `comment ${id}`, ip: clientIp(req),
  });
  return ok({ restored: true });
}
