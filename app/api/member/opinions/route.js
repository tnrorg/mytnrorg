import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { uploadDataUrl } from '@/lib/storage';
import { validateOpinion, LIMITS } from '@/lib/opinions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* A member's own Opinions.
 *
 * Every query is scoped by member_id from the verified token — never from
 * anything the client sends. An id in the request body is only ever used
 * alongside that scope, so asking for someone else's piece returns nothing
 * rather than someone else's piece.
 */

const FIELDS =
  'id, title, summary, body, cover_url, slug, status, review_note, ' +
  'reviewed_at, submitted_at, published_at, created_at, updated_at, ' +
  'published_title, published_summary';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  const { data, error } = await supabaseAdmin().from('opinions')
    .select(FIELDS)
    .eq('member_id', member.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return fail('READ_FAILED', 500, {
      message: 'Could not load your opinions.',
      hint: 'Administrator: run supabase/migration_opinions.sql.',
    });
  }
  return ok({ opinions: data || [] });
}

/** Create a new opinion, or update one the member already owns. */
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);

  const submitting = b.action === 'submit';

  /* Validation runs only when submitting.
   *
   * A draft is somewhere to think; refusing to save half a paragraph because
   * it is under the word count would mean losing it. The rules apply at the
   * moment the piece is offered for publication, which is when they matter.
   */
  if (submitting) {
    const errors = validateOpinion(b);
    if (Object.keys(errors).length) {
      return fail('INVALID', 400, { errors, message: 'Please check the highlighted fields.' });
    }
  }

  const clip = (k) => String(b[k] ?? '').trim().slice(0, LIMITS[k]);
  const patch = {
    title: clip('title'),
    summary: clip('summary'),
    body: clip('body'),
    updated_at: new Date().toISOString(),
  };

  // Cover image. Same checks as every other public upload path, enforced here
  // because this endpoint does not have to be reached through our form.
  if (b.cover_data) {
    const head = String(b.cover_data).slice(0, 40);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(head))
      return fail('BAD_IMAGE', 400, { message: 'Cover image must be a JPG, PNG or WEBP.' });
    if (String(b.cover_data).length * 0.75 > 4 * 1024 * 1024)
      return fail('IMAGE_TOO_BIG', 400, { message: 'Cover image must be smaller than 4 MB.' });
    try { patch.cover_url = await uploadDataUrl(b.cover_data, 'opinions'); }
    catch { return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the cover image.' }); }
  } else if (b.cover_url === null) {
    patch.cover_url = null;
  }

  const sb = supabaseAdmin();

  // ── Existing piece ────────────────────────────────────────────────────────
  if (b.id) {
    const { data: existing } = await sb.from('opinions')
      .select('id, status, member_id').eq('id', b.id).eq('member_id', member.id).maybeSingle();

    // Scoped by member_id above, so a wrong id is indistinguishable from
    // someone else's — which is the point.
    if (!existing) return fail('NOT_FOUND', 404, { message: 'Opinion not found.' });

    if (existing.status === 'rejected') {
      return fail('LOCKED', 409, {
        message: 'This opinion was not accepted and cannot be edited. Start a new one.',
      });
    }

    /* Status after an edit.
     *
     * Submitting sets pending regardless. Editing a PUBLISHED piece also sets
     * pending — the draft columns change while the published_* columns keep
     * serving the live page, so the public sees the approved version until an
     * admin approves the new one. Saving a draft leaves the status alone.
     */
    if (submitting) {
      patch.status = 'pending';
      patch.submitted_at = new Date().toISOString();
      patch.review_note = '';
    } else if (existing.status === 'published') {
      // A silent draft-save on a live piece would strand the edit invisibly.
      patch.status = 'pending';
      patch.submitted_at = new Date().toISOString();
    } else if (existing.status === 'changes_requested') {
      patch.status = 'draft';
    }

    const { error } = await sb.from('opinions').update(patch).eq('id', b.id).eq('member_id', member.id);
    if (error) {
      // Logged in full server-side; the member gets the actionable part only.
      console.error('[opinions] update failed:', error.message);
      return fail('SAVE_FAILED', 500, {
        message: 'Could not save your changes.',
        hint: 'If this keeps happening, tell the committee — the Opinions table may not be set up yet.',
      });
    }
    return ok({ id: b.id, status: patch.status || existing.status, submitted: submitting });
  }

  // ── New piece ─────────────────────────────────────────────────────────────
  patch.member_id = member.id;
  patch.status = submitting ? 'pending' : 'draft';
  if (submitting) patch.submitted_at = new Date().toISOString();

  const { data, error } = await sb.from('opinions').insert(patch).select('id').maybeSingle();
  if (error) {
    console.error('[opinions] insert failed:', error.message);
    /* 42P01 is "relation does not exist" — the migration has not been run.
     * Naming that precisely turns a dead end into a one-line instruction for
     * whoever the member reports it to. Every other error stays generic. */
    const missingTable = error.code === '42P01' || /does not exist/i.test(error.message || '');
    return fail('SAVE_FAILED', 500, {
      message: 'Your opinion could not be saved.',
      hint: missingTable
        ? 'The Opinions feature is not finished being set up. Ask an administrator to run supabase/migration_opinions.sql — your text is still on screen, so nothing is lost.'
        : 'Please try again. If it keeps failing, contact the committee.',
    });
  }
  return ok({ id: data?.id, status: patch.status, submitted: submitting });
}

/** Delete one of the member's own opinions. */
export async function DELETE(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('INVALID', 400, { message: 'Missing id.' });

  const { data: existing } = await supabaseAdmin().from('opinions')
    .select('id, status').eq('id', id).eq('member_id', member.id).maybeSingle();
  if (!existing) return fail('NOT_FOUND', 404, { message: 'Opinion not found.' });

  /* A published piece cannot be deleted by its author.
   *
   * It carries the organisation's approval and may already have been read and
   * linked to. Withdrawing it is a conversation with the committee, not a
   * button — and an author who could delete on impulse would sometimes wish
   * they had not. Ask an admin to unpublish it first. */
  if (existing.status === 'published') {
    return fail('LOCKED', 409, {
      message: 'A published opinion cannot be deleted here. Ask the committee to withdraw it first.',
    });
  }

  const { error } = await supabaseAdmin().from('opinions')
    .delete().eq('id', id).eq('member_id', member.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete.' });
  return ok({ deleted: true });
}
