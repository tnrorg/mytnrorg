import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { STATUS_KEYS } from '@/lib/successStories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_success_stories.sql.';
const tableMissing = (e) =>
  e?.code === '42P01' || /success_stories/.test(e?.message || '');

/* Success Stories — the review queue.
 *
 * Reached under the `content` permission area: this is material that goes on
 * the public website, and the people who run the website are the ones who
 * decide what appears on it.
 *
 * WHAT THE REVIEWER IS SHOWN, AND WHAT THEY ARE NOT
 *
 * The story, plus the author's name, membership number, Union Council and
 * photograph — the things that will be on the public card, so the reviewer can
 * see what they are approving. NOT the author's phone number, email, CNIC or
 * address: approving a card about someone's graduation does not require their
 * contact details, and this queue is reachable by every admin who edits hero
 * slides.
 */
const AUTHOR_FIELDS = 'id, full_name, membership_id, union_council, photo_url, role';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let q = sb.from('success_stories').select('*')
    .order('submitted_at', { ascending: false }).limit(500);
  if (STATUS_KEYS.includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    return fail('READ_FAILED', 500, {
      message: tableMissing(error)
        ? 'Success Stories are not set up yet.'
        : 'Could not read the stories.',
      detail: tableMissing(error) ? HINT : String(error.message || '').slice(0, 160),
    });
  }

  const stories = data || [];

  /* Authors in ONE query rather than one per row. Three hundred stories would
   * otherwise be three hundred round trips, and the page would time out long
   * before it rendered. */
  let authors = {};
  const ids = [...new Set(stories.map(s => s.member_id).filter(Boolean))];
  if (ids.length) {
    const { data: ms } = await sb.from('membership_members')
      .select(AUTHOR_FIELDS).in('id', ids);
    authors = Object.fromEntries((ms || []).map(m => [m.id, m]));
  }

  /* Counts across ALL statuses, not just the filtered view — the tab headings
   * must keep showing "12 waiting" while you are looking at the published
   * ones, or nobody notices the queue growing. */
  const counts = {};
  if (STATUS_KEYS.includes(status)) {
    const { data: all } = await sb.from('success_stories').select('status').limit(5000);
    for (const r of (all || [])) counts[r.status] = (counts[r.status] || 0) + 1;
  } else {
    for (const s of stories) counts[s.status] = (counts[s.status] || 0) + 1;
  }

  return ok({ stories, authors, counts });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);

  if (!b?.id) return fail('INVALID', 400, { message: 'Missing story.' });

  const action = String(b.action || '');
  const now = new Date().toISOString();
  const who = admin?.username || 'admin';

  /* Read it first so the audit entry can name what was decided. "STORY_
   * REVIEWED 8f2c…" tells nobody anything a year later. */
  const { data: before, error: rErr } = await sb.from('success_stories')
    .select('*').eq('id', b.id).maybeSingle();

  if (rErr) {
    return fail('READ_FAILED', 500, {
      message: tableMissing(rErr) ? 'Success Stories are not set up yet.' : 'Could not load that story.',
      detail: tableMissing(rErr) ? HINT : undefined,
    });
  }
  if (!before) return fail('NOT_FOUND', 404, { message: 'That story no longer exists.' });

  const patch = { reviewed_by: who, reviewed_at: now, updated_at: now };

  if (action === 'publish') {
    patch.status = 'published';
    patch.review_note = '';
    /* Set once, on FIRST publication. A story taken down and put back up
     * should not jump to the top of the page as though it were new — the page
     * is ordered by when the achievement happened and when it first went
     * live, and re-dating it would quietly reorder the whole page. */
    patch.published_at = before.published_at || now;
  } else if (action === 'send_back') {
    const note = String(b.review_note || '').trim().slice(0, 1000);
    /* A note is REQUIRED here, not optional.
     *
     * "Sent back for changes" with no reason is the single most discouraging
     * thing this platform can say to a member who shared good news. If the
     * committee cannot say what to change, the honest action is Reject or
     * Publish — not a silent bounce. */
    if (note.length < 5) {
      return fail('NOTE_REQUIRED', 400, {
        message: 'Please write a short note saying what needs changing — '
               + 'the member sees it, and without it they have nothing to act on.',
      });
    }
    patch.status = 'changes_requested';
    patch.review_note = note;
  } else if (action === 'reject') {
    patch.status = 'rejected';
    patch.review_note = String(b.review_note || '').trim().slice(0, 1000);
  } else if (action === 'unpublish') {
    patch.status = 'unpublished';
    patch.review_note = String(b.review_note || '').trim().slice(0, 1000);
  } else if (action === 'feature') {
    /* Featuring is not a review decision, so it does not touch the status or
     * stamp a reviewer — a story can be highlighted and unhighlighted all week
     * without rewriting who last reviewed it. */
    const { data, error } = await sb.from('success_stories')
      .update({ featured: !!b.featured, updated_at: now })
      .eq('id', b.id).select('*').maybeSingle();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not update.' });
    return ok({ story: data, message: b.featured ? 'Featured.' : 'No longer featured.' });
  } else {
    return fail('INVALID', 400, { message: 'Unknown action.' });
  }

  const { data, error } = await sb.from('success_stories')
    .update(patch).eq('id', b.id).select('*').maybeSingle();

  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });

  await logAudit({
    action: `SUCCESS_STORY_${action.toUpperCase()}`,
    actor: who,
    details: `${before.title} (${before.kind}) — ${before.status} → ${patch.status}`.slice(0, 200),
    ip: clientIp(req),
  });

  const MESSAGES = {
    publish: 'Published. It is now on the public website.',
    send_back: 'Sent back to the member with your note.',
    reject: 'Marked as not accepted.',
    unpublish: 'Removed from the public website.',
  };
  return ok({ story: data, message: MESSAGES[action] });
}
