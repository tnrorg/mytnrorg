import { requireMember } from '@/lib/membership/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { uploadDataUrl } from '@/lib/storage';
import { ok, fail, readJson } from '@/lib/api';
import {
  validateStory, canMemberEdit, MAX_PENDING,
  TITLE_MAX, ORG_MAX, DESC_MAX,
} from '@/lib/successStories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/* An image upload goes to Cloudinary (or Supabase Storage) inside the request.
 * On a slow connection from Roundu that is comfortably more than the default
 * ten seconds, and a submission killed mid-upload loses the member's writing
 * as well as their photo. */
export const maxDuration = 60;

const HINT = 'Administrator: run supabase/migration_success_stories.sql.';
const tableMissing = (e) =>
  e?.code === '42P01' || /success_stories/.test(e?.message || '');

/* A member's own success stories.
 *
 * THE ACCESS RULE, stated once:
 *
 *     the member id comes from the session token, and from nowhere else.
 *
 * There is no member_id parameter on any verb. Every read is filtered by the
 * caller's own id, and every write is checked against it before the row is
 * touched — so a member cannot read, edit or delete anyone else's story by
 * changing a value in the request.
 */

/** Only these fields, only these lengths. Anything else in the body is ignored. */
function clean(b = {}) {
  return {
    kind: String(b.kind || 'other'),
    title: String(b.title || '').trim().slice(0, TITLE_MAX),
    organisation: String(b.organisation || '').trim().slice(0, ORG_MAX),
    description: String(b.description || '').trim().slice(0, DESC_MAX),
    /* A month, normalised to the first of it. The form collects a month, so a
     * day here would be invented precision. */
    achieved_on: b.achieved_on ? String(b.achieved_on).slice(0, 7) + '-01' : null,
  };
}

/* The uploaded photograph.
 *
 * The member picks a file; the browser shrinks it and sends a data: URL as
 * `image_data`. This turns that into a hosted URL.
 *
 * The browser does NOT get to send `image_url` directly. If it could, the
 * "photo" on a published card could point anywhere on the internet — at a site
 * that later changes what it serves, or at a tracker that logs every visitor
 * to the TNR page. Uploading means the image TNR shows is an image TNR holds.
 *
 * Returns `{ url }` on success, `{ error }` with a message for the member, or
 * `{}` when there is nothing to do.
 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function resolveImage(b, existing) {
  /* Explicitly cleared — the member removed the photo from a story they are
   * editing. `null` is a decision and must be honoured; `undefined` is "not
   * mentioned" and leaves whatever was there. */
  if (b?.image_data === null) return { url: null };
  if (!b?.image_data) return { url: existing };

  const data = String(b.image_data);
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(data.slice(0, 40))) {
    return { error: 'The photo must be a JPG, PNG or WEBP image.' };
  }
  // base64 is about 4/3 the size of the bytes it encodes.
  if (data.length * 0.75 > MAX_IMAGE_BYTES) {
    return { error: 'That photo is too large. Please choose one under 4 MB.' };
  }

  try {
    const url = await uploadDataUrl(data, 'success-stories');
    if (!url) return { error: 'The photo could not be uploaded. Please try again.' };
    return { url };
  } catch {
    /* A failed upload must not take the member's writing with it. The caller
     * turns this into a message, and the member's typed answer is still in the
     * form where they can retry without rewriting it. */
    return { error: 'The photo could not be uploaded. Please try again, or submit without it.' };
  }
}

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();

  const { data, error } = await sb.from('success_stories')
    .select('*').eq('member_id', member.id)
    .order('created_at', { ascending: false });

  if (error) {
    /* Not switched on yet is not the member's problem to solve, so they get a
     * plain sentence and the administrator gets the file name. An empty list
     * would have been indistinguishable from "you have not submitted any",
     * which is the wrong thing to tell someone who just submitted one. */
    return fail('NOT_READY', 503, {
      message: tableMissing(error)
        ? 'Success Stories are not switched on yet.'
        : 'Could not load your stories.',
      detail: tableMissing(error) ? HINT : String(error.message || '').slice(0, 160),
    });
  }

  const stories = data || [];
  return ok({
    stories,
    pending: stories.filter(s => s.status === 'pending').length,
    max_pending: MAX_PENDING,
  });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const f = clean(b);

  const errors = validateStory(f);
  if (Object.keys(errors).length) {
    return fail('INVALID', 400, { message: 'Please check the highlighted fields.', errors });
  }

  // ── Editing one they already submitted ───────────────────────────────────
  if (b?.id) {
    /* Read it FIRST, and check the owner before writing anything.
     *
     * Filtering the update by member_id alone would be enough to stop the
     * write, but it would report "not found" for someone else's story and
     * "not found" for a story that has been published — two different
     * situations needing two different answers. */
    const { data: existing, error: rErr } = await sb.from('success_stories')
      .select('id, member_id, status, image_url').eq('id', b.id).maybeSingle();

    if (rErr) return fail('READ_FAILED', 500, { message: 'Could not load that story.' });
    if (!existing || existing.member_id !== member.id) {
      /* Deliberately the same answer for "does not exist" and "belongs to
       * someone else". Distinguishing them would confirm that a given id is
       * real, which is a small thing to hand to somebody guessing. */
      return fail('NOT_FOUND', 404, { message: 'That story was not found.' });
    }
    if (!canMemberEdit(existing.status)) {
      return fail('LOCKED', 409, {
        message: existing.status === 'published'
          ? 'This story is already published, so it cannot be edited. '
            + 'You can submit a new story for a new achievement.'
          : 'This story can no longer be edited.',
      });
    }

    /* The photo is resolved AFTER the ownership and lock checks, so a stranger
     * poking at someone else's story id cannot make the server do an upload. */
    const img = await resolveImage(b, existing.image_url);
    if (img.error) return fail('BAD_IMAGE', 400, { message: img.error, errors: { image: img.error } });

    const { data, error } = await sb.from('success_stories').update({
      ...f,
      image_url: img.url ?? null,
      /* Editing sends it back to the queue. A story that was sent back for
       * changes and then edited must be looked at again — leaving it in
       * changes_requested would mean the committee never sees the correction. */
      status: 'pending',
      review_note: '',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', b.id).eq('member_id', member.id).select('*').maybeSingle();

    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save your changes.' });
    return ok({ story: data, message: 'Updated and sent for review again.' });
  }

  // ── A new story ──────────────────────────────────────────────────────────
  /* The queue cap, checked here rather than in the database. See the migration:
   * a trigger could enforce it, but only a route can explain it kindly. */
  const { count, error: cErr } = await sb.from('success_stories')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', member.id).eq('status', 'pending');

  if (cErr) {
    return fail('NOT_READY', 503, {
      message: tableMissing(cErr)
        ? 'Success Stories are not switched on yet.'
        : 'Could not submit your story.',
      detail: tableMissing(cErr) ? HINT : undefined,
    });
  }

  if ((count || 0) >= MAX_PENDING) {
    return fail('TOO_MANY_PENDING', 429, {
      message: `You already have ${MAX_PENDING} stories waiting for review. `
             + 'Please wait until those have been looked at before adding another.',
    });
  }

  /* Uploaded only after the queue cap has been checked — otherwise a member at
   * their limit would wait through an upload just to be refused. */
  const img = await resolveImage(b, null);
  if (img.error) return fail('BAD_IMAGE', 400, { message: img.error, errors: { image: img.error } });

  const { data, error } = await sb.from('success_stories').insert({
    ...f,
    image_url: img.url ?? null,
    member_id: member.id,        // from the token, never from the body
    status: 'pending',
    submitted_at: new Date().toISOString(),
  }).select('*').maybeSingle();

  if (error) {
    return fail('SAVE_FAILED', 500, {
      message: tableMissing(error)
        ? 'Success Stories are not switched on yet.'
        : 'Your story could not be submitted.',
      detail: tableMissing(error) ? HINT : String(error.message || '').slice(0, 160),
    });
  }

  return ok({
    story: data,
    message: 'Sent for review. It will appear on the TNR website once approved.',
  });
}

export async function DELETE(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('INVALID', 400, { message: 'Missing story.' });

  const sb = supabaseAdmin();
  const { data: existing } = await sb.from('success_stories')
    .select('id, member_id, status').eq('id', id).maybeSingle();

  if (!existing || existing.member_id !== member.id) {
    return fail('NOT_FOUND', 404, { message: 'That story was not found.' });
  }
  /* A member may withdraw something that is still waiting or was sent back.
   * They may NOT delete a published card: it is on the public site, it may
   * have been shared, and taking it down is a decision for the committee that
   * put it up. They can ask — that is what the review note is for. */
  if (!canMemberEdit(existing.status)) {
    return fail('LOCKED', 409, {
      message: 'A published story cannot be removed from here. '
             + 'Please contact the committee if you would like it taken down.',
    });
  }

  const { error } = await sb.from('success_stories')
    .delete().eq('id', id).eq('member_id', member.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not remove it.' });

  return ok({ message: 'Withdrawn.' });
}
