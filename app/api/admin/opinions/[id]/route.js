import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { logAudit, clientIp } from '@/lib/audit';
import { makeSlug } from '@/lib/opinions';

export const dynamic = 'force-dynamic';

/* Review decisions.
 *
 * Four actions, and the difference between them matters to the person who
 * wrote the piece:
 *
 *   publish          — approve, copy draft → published, make it live
 *   request_changes  — send it back with a reason; the author can rework it
 *   reject           — not for publication; final, and needs a reason
 *   unpublish        — take a live piece down without deleting it
 */
export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
  const b = await readJson(req);
  const action = b.action;

  const sb = supabaseAdmin();
  const { data: o } = await sb.from('opinions').select('*').eq('id', params.id).maybeSingle();
  if (!o) return fail('NOT_FOUND', 404, { message: 'Opinion not found.' });

  const now = new Date().toISOString();
  const patch = { reviewed_by: admin.username, reviewed_at: now, updated_at: now };

  if (action === 'publish') {
    /* Copy the draft into the published columns.
     *
     * This copy IS the approval. The public page reads only these columns, so
     * whatever an admin read while deciding is exactly what a visitor gets —
     * a later edit lands in the draft columns and changes nothing live until
     * someone approves it too. */
    patch.status = 'published';
    patch.published_title = o.title;
    patch.published_summary = o.summary;
    patch.published_body = o.body;
    patch.published_cover = o.cover_url;
    patch.review_note = String(b.note || '').slice(0, 2000);
    // published_at is the FIRST publication. Re-approving an edit is not a new
    // piece, and the listing order should not jump because of a typo fix.
    if (!o.published_at) patch.published_at = now;
    // Likewise the slug: set once, never regenerated. A changing URL breaks
    // every link anyone has already shared.
    if (!o.slug) patch.slug = makeSlug(o.title, o.id);
  }

  else if (action === 'request_changes') {
    const note = String(b.note || '').trim();
    if (!note) return fail('NOTE_REQUIRED', 400, {
      message: 'Say what needs changing — the author cannot act on a blank reply.',
    });
    patch.status = 'changes_requested';
    patch.review_note = note.slice(0, 2000);
  }

  else if (action === 'reject') {
    const note = String(b.note || '').trim();
    if (!note) return fail('NOTE_REQUIRED', 400, {
      message: 'A reason is required. Rejecting silently leaves someone with nothing to learn from.',
    });
    patch.status = 'rejected';
    patch.review_note = note.slice(0, 2000);
  }

  else if (action === 'unpublish') {
    // Back to the author's hands, live copy withdrawn. The published_* columns
    // are left in place so re-publishing is one click rather than a rewrite.
    patch.status = 'changes_requested';
    patch.review_note = String(b.note || 'Withdrawn by the committee.').slice(0, 2000);
  }

  else return fail('BAD_ACTION', 400, { message: 'Unknown action.' });

  const { error } = await sb.from('opinions').update(patch).eq('id', params.id);
  if (error) return fail('UPDATE_FAILED', 500, { message: 'Could not update.', detail: error.message });

  await logAudit({
    action: `OPINION_${action.toUpperCase()}`,
    actor: admin.username,
    ip: clientIp(req),
    details: `"${o.title}"`,
  });

  // The author needs to know a decision was made, not discover it by checking.
  try {
    const { data: m } = await sb.from('membership_members')
      .select('id').eq('id', o.member_id).maybeSingle();
    if (m) {
      const TITLE = {
        publish: 'Your opinion has been published',
        request_changes: 'Changes requested on your opinion',
        reject: 'Your opinion was not accepted',
        unpublish: 'Your opinion has been withdrawn',
      };
      await sb.from('membership_notifications').insert({
        member_id: o.member_id,
        title: TITLE[action],
        body: patch.review_note || `"${o.title}"`,
        category: 'opinion',
      });
    }
  } catch { /* a missing notifications table must not fail the decision */ }

  return ok({ updated: true, status: patch.status });
}

/* Deletion is SUPER ADMIN only.
 *
 * Someone's writing, with their name on it. Unpublishing is the everyday
 * action and it is reversible; removing the piece entirely is not, so it sits
 * behind the higher rank and leaves an audit entry naming who did it.
 */
export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
  if (!isSuperAdmin(admin)) {
    return fail('FORBIDDEN', 403, {
      message: 'Only a Super Admin can delete an opinion. Unpublish it instead.',
    });
  }

  const sb = supabaseAdmin();
  const { data: o } = await sb.from('opinions').select('title').eq('id', params.id).maybeSingle();

  const { error } = await sb.from('opinions').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete.' });

  await logAudit({
    action: 'OPINION_DELETED', actor: admin.username, ip: clientIp(req),
    details: o ? `"${o.title}"` : params.id,
  });
  return ok({ deleted: true });
}
