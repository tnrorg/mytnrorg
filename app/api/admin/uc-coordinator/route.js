import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { APP_STATUS_KEYS, ROUND_STATUS_KEYS } from '@/lib/ucCoordinator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_uc_coordinator.sql.';
const APPLY_PATH = '/member/uc-coordinator';

/* Union Council Coordinator recruitment — the committee's side.
 *
 * Reached under the `membership` permission area; see the note in
 * lib/adminScopes.js for why it is not a scope of its own.
 *
 * WHAT THIS ROUTE DOES NOT DO
 *
 * It does not change anybody's membership role. Marking an applicant
 * "Selected" records the committee's decision and nothing else — promoting
 * someone to the Union Council Team stays in the Membership screen, where role
 * changes already live, are already audited, and are already done deliberately
 * rather than as a side effect of a dropdown. That was the organisation's
 * decision, and putting a silent role change behind a status field would undo
 * it without anyone noticing.
 */

const tableMissing = (e) =>
  e?.code === '42P01' || /uc_coordinator_(rounds|applications)/.test(e?.message || '');

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  const { data: rounds, error } = await sb.from('uc_coordinator_rounds')
    .select('*').order('created_at', { ascending: false });

  if (error) {
    return fail('READ_FAILED', 500, {
      message: tableMissing(error)
        ? 'UC Coordinator recruitment is not set up yet.'
        : 'Could not read the recruitment rounds.',
      detail: tableMissing(error) ? HINT : String(error.message || '').slice(0, 160),
    });
  }

  const url = new URL(req.url);
  /* Default to the newest round rather than requiring a choice. The committee
   * almost always wants the one that is running. */
  const roundId = url.searchParams.get('round_id') || rounds?.[0]?.id || null;

  let applications = [];
  if (roundId) {
    const { data, error: aErr } = await sb.from('uc_coordinator_applications')
      .select('*').eq('round_id', roundId)
      .order('union_council').order('created_at', { ascending: false });
    if (aErr && !tableMissing(aErr)) {
      return fail('READ_FAILED', 500, {
        message: 'Could not read the applications.', detail: aErr.message,
      });
    }
    applications = data || [];
  }

  /* Counts per Union Council, computed once here so the screen header and the
   * grouped list cannot tell different stories. */
  const byUc = {};
  for (const a of applications) {
    const uc = a.union_council || 'Not recorded';
    (byUc[uc] || (byUc[uc] = { total: 0, selected: 0 })).total += 1;
    if (a.status === 'selected') byUc[uc].selected += 1;
  }

  return ok({ rounds: rounds || [], round_id: roundId, applications, by_uc: byUc });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const action = String(b?.action || '');

  // ── Open or create a round ───────────────────────────────────────────────
  if (action === 'save_round') {
    const status = ROUND_STATUS_KEYS.includes(b.status) ? b.status : 'draft';
    const patch = {
      title: String(b.title || '').trim().slice(0, 160) || 'TNR Union Council Coordinator',
      summary: String(b.summary || '').trim().slice(0, 2000),
      status,
      closes_on: b.closes_on || null,
      updated_at: new Date().toISOString(),
    };

    let row;
    if (b.id) {
      const { data, error } = await sb.from('uc_coordinator_rounds')
        .update(patch).eq('id', b.id).select('*').maybeSingle();
      if (error) return saveFailed(error);
      row = data;
    } else {
      patch.opened_by = admin?.username || 'admin';
      const { data, error } = await sb.from('uc_coordinator_rounds')
        .insert(patch).select('*').maybeSingle();
      if (error) return saveFailed(error);
      row = data;
    }
    if (!row) return fail('NOT_FOUND', 404, { message: 'That round no longer exists.' });

    /* The website announcement follows the round's status.
     *
     * Opening publishes one; closing retires it. Tying them together is the
     * point — an announcement left up after a call closes sends members to a
     * form that will refuse them, and "remember to delete the announcement" is
     * not a step that survives contact with a busy committee. */
    const announcement = await syncAnnouncement(sb, row);

    await logAudit({
      action: status === 'open' ? 'UC_COORDINATOR_ROUND_OPENED' : 'UC_COORDINATOR_ROUND_SAVED',
      actor: admin?.username || 'admin',
      details: `${row.title} — ${status}${row.closes_on ? `, closes ${row.closes_on}` : ''}`,
      ip: clientIp(req),
    });

    return ok({ round: { ...row, ...announcement.patch }, warning: announcement.warning });
  }

  // ── Move an application through review ───────────────────────────────────
  if (action === 'set_status') {
    if (!b.id) return fail('INVALID', 400, { message: 'Missing application.' });
    if (!APP_STATUS_KEYS.includes(b.status)) {
      return fail('INVALID', 400, { message: 'That is not a review status.' });
    }

    const { data, error } = await sb.from('uc_coordinator_applications').update({
      status: b.status,
      admin_notes: b.admin_notes !== undefined
        ? String(b.admin_notes || '').trim().slice(0, 2000)
        : undefined,
      reviewed_by: admin?.username || 'admin',
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', b.id).select('*').maybeSingle();

    if (error) return saveFailed(error);
    if (!data) return fail('NOT_FOUND', 404, { message: 'That application no longer exists.' });

    await logAudit({
      action: 'UC_COORDINATOR_APPLICATION_REVIEWED',
      actor: admin?.username || 'admin',
      details: `${data.full_name} (${data.membership_id}, ${data.union_council}) → ${b.status}`,
      ip: clientIp(req),
    });

    return ok({
      application: data,
      /* Said plainly on every selection, because the two steps are separate on
       * purpose and a committee that assumes otherwise will leave a coordinator
       * with no UC Team role and no idea why. */
      message: b.status === 'selected'
        ? `${data.full_name} marked as Selected. Their membership role has NOT changed — `
          + 'set it to Union Council Team in Membership when you are ready.'
        : 'Updated.',
    });
  }

  return fail('INVALID', 400, { message: 'Unknown action.' });
}

function saveFailed(error) {
  return fail('SAVE_FAILED', 500, {
    message: tableMissing(error)
      ? 'UC Coordinator recruitment is not set up yet.'
      : 'Could not save.',
    detail: tableMissing(error) ? HINT : String(error.message || '').slice(0, 160),
  });
}

/**
 * Keep the public announcement in step with the round.
 *
 * Returns `{ patch, warning }`. A failure here NEVER fails the save: the round
 * opening is the thing that matters, and a missing ticker line is worth a
 * warning rather than a refusal that leaves the committee unable to open
 * recruitment at all.
 */
async function syncAnnouncement(sb, round) {
  const open = round.status === 'open';
  const text = `Applications open: ${round.title}`
    + (round.closes_on ? ` — closing ${round.closes_on}` : '');

  try {
    if (round.announcement_id) {
      await sb.from('announcements').update({
        text, href: APPLY_PATH,
        /* Deactivated rather than deleted when the round closes. The row is a
         * record that the call was advertised, and deleting it loses that. */
        active: open,
        updated_at: new Date().toISOString(),
      }).eq('id', round.announcement_id);
      return { patch: {}, warning: null };
    }

    if (!open) return { patch: {}, warning: null };   // nothing to announce yet

    const { data, error } = await sb.from('announcements')
      .insert({ text, href: APPLY_PATH, active: true, sort_order: 0 })
      .select('id').maybeSingle();
    if (error || !data) {
      return { patch: {}, warning: 'The round is open, but the website announcement could not be published.' };
    }

    await sb.from('uc_coordinator_rounds')
      .update({ announcement_id: data.id }).eq('id', round.id);
    return { patch: { announcement_id: data.id }, warning: null };
  } catch {
    return { patch: {}, warning: 'The round was saved, but the website announcement could not be updated.' };
  }
}
