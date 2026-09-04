import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import {
  validateActivity, engagementBand, totalContributions, attendanceRate, emptyRecord,
} from '@/lib/contributions';
import { contributionYear, memberTimeline } from '@/lib/contributionsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/* Eight grouped reads across a year of activity for 293 members. Comfortably
 * inside a second in practice, but the default ten-second limit is tight for a
 * cold start on a slow connection, and a report that times out silently looks
 * exactly like a report showing zeros. */
export const maxDuration = 60;

const HINT = 'Administrator: run supabase/migration_contributions.sql.';

/* Progress Analytics.
 *
 * Reached under the `analytics` permission area, enforced centrally in
 * requireAdmin — this file does not re-implement that check.
 *
 * WHAT THIS ROUTE WILL NOT DO, by decision of the organisation:
 *   • It does not compute a score, and it does not rank members. The response
 *     carries counts. A caller wanting a league table would have to build one,
 *     and that is a conversation to have with people, not a sort order to slip
 *     in quietly.
 *   • It does not expose contact details. Contribution figures are about
 *     participation; an admin who needs a phone number has Membership for it.
 */

// Named explicitly so nobody widens it to select('*') and starts shipping
// CNICs and mobile numbers into a participation report.
const MEMBER_FIELDS = 'id, membership_id, full_name, photo_url, role, union_council, status, created_at';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();

  // ── One member's timeline, for the drill-down ──────────────────────────
  const memberId = url.searchParams.get('member_id');
  if (memberId) {
    const { data: member } = await sb.from('membership_members')
      .select(MEMBER_FIELDS).eq('id', memberId).maybeSingle();
    if (!member) return fail('NOT_FOUND', 404, { message: 'Member not found.' });

    const [{ records }, timeline] = await Promise.all([
      contributionYear({ year, memberIds: [memberId] }),
      memberTimeline(memberId, year),
    ]);

    return ok({
      year, member,
      record: records.get(memberId) || null,
      timeline: timeline.items,
      missing: [...new Set([...(timeline.missing || [])])],
      hint: timeline.missing?.includes('member_activities') ? HINT : undefined,
    });
  }

  // ── The whole organisation for a year ──────────────────────────────────
  /* Active members only.
   *
   * A suspended or deleted account cannot attend anything, so including them
   * would pad the "nothing recorded" column with people who were never able to
   * take part — and that column is the one an office bearer acts on. */
  const { data: members, error: mErr } = await sb.from('membership_members')
    .select(MEMBER_FIELDS)
    .eq('status', 'active').is('deleted_at', null)
    .order('full_name');

  if (mErr) {
    return fail('READ_FAILED', 500, {
      message: 'Could not read the member list.', detail: mErr.message,
    });
  }

  const { records, meetingsHeld, missing } = await contributionYear({ year });

  const rows = (members || []).map(m => {
    // emptyRecord(), not a hand-written copy — a literal here drifts from the
    // real shape the moment a group is added, and the group that goes missing
    // is the one nobody notices is missing.
    const record = records.get(m.id) || emptyRecord();
    return {
      member: m,
      record,
      total: totalContributions(record),
      band: engagementBand(record),
      attendance_rate: attendanceRate(record.meetings),
    };
  });

  // Organisation totals. Sums of the same counts, so the header and the table
  // can never tell different stories.
  const summary = rows.reduce((a, r) => ({
    members: a.members + 1,
    attended: a.attended + r.record.meetings.attended,
    invited: a.invited + r.record.meetings.invited,
    opinions: a.opinions + r.record.writing.opinions,
    comments: a.comments + r.record.writing.comments,
    activities: a.activities + r.record.activities.count,
    hours: a.hours + r.record.activities.hours,
    events: a.events + r.record.events.attended,
    volunteer: a.volunteer + r.record.volunteering.assignments,
    volunteer_hours: a.volunteer_hours + r.record.volunteering.hours,
    hosted: a.hosted + r.record.leadership.hosted,
    duties: a.duties + r.record.leadership.duties,
    active: a.active + (r.band === 'active' ? 1 : 0),
    some: a.some + (r.band === 'some' ? 1 : 0),
    none: a.none + (r.band === 'none' ? 1 : 0),
  }), {
    members: 0, attended: 0, invited: 0, opinions: 0, comments: 0,
    activities: 0, hours: 0, events: 0, volunteer: 0, volunteer_hours: 0,
    hosted: 0, duties: 0, active: 0, some: 0, none: 0,
  });
  summary.hours = Math.round(summary.hours * 100) / 100;
  summary.volunteer_hours = Math.round(summary.volunteer_hours * 100) / 100;
  summary.meetings_held = meetingsHeld;

  return ok({
    year, rows, summary,
    /* Say what could not be read.
     *
     * A table of zeros because a migration has not been run is
     * indistinguishable from a table of zeros because nobody did anything —
     * and the second reading is the one that gets acted on. */
    missing,
    hint: missing.includes('member_activities') ? HINT : undefined,
  });
}

// ── Logging what the platform cannot see ───────────────────────────────────
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const { ok: valid, errors, value } = validateActivity(b);
  if (!valid) return fail('INVALID', 400, { message: 'Check the highlighted fields.', errors });

  // The member must exist and be one of ours. Without this, a mistyped id
  // creates an orphan record that shows up in nobody's totals and cannot be
  // found again.
  const { data: member } = await sb.from('membership_members')
    .select('id, full_name').eq('id', value.member_id).is('deleted_at', null).maybeSingle();
  if (!member) return fail('NOT_FOUND', 404, { message: 'That member was not found.' });

  const row = {
    member_id: value.member_id,
    activity_type: value.activity_type,
    title: value.title,
    description: value.description ?? null,
    activity_date: value.activity_date,
    hours: value.hours ?? null,
    location: value.location ?? null,
    evidence_url: value.evidence_url ?? null,
    /* `sub`, not `id`. The admin JWT carries the account id in the standard
     * `sub` claim; admin.id is undefined, and writing that here would have
     * stored NULL — leaving every entry with no author and, because
     * verified_by is set from the same value, marked unverified for ever. */
    logged_by: admin?.sub || null,
    /* Recorded by an office bearer IS the confirmation.
     *
     * Members cannot write here at all — there is no member-side create route
     * — so the only way an entry exists is that an admin typed it. Leaving it
     * unverified would put "unverified" on every single row, which trains
     * everyone to ignore the word. */
    verified_by: admin?.sub || null,
    verified_at: new Date().toISOString(),
  };

  const { data, error } = await sb.from('member_activities').insert(row).select('*').maybeSingle();
  if (error) {
    return fail('WRITE_FAILED', 500, {
      message: 'Could not save the activity.', detail: error.message, hint: HINT,
    });
  }

  await logAudit({
    action: 'ACTIVITY_LOGGED', actor: admin?.username || 'admin',
    details: `${value.activity_type} for ${member.full_name}: ${value.title} (${value.activity_date})`,
    ip: clientIp(req),
  });

  return ok({ activity: data, message: `Recorded for ${member.full_name}.` });
}

export async function PATCH(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!b?.id) return fail('INVALID', 400, { message: 'Missing activity.' });

  const sb = supabaseAdmin();
  const { ok: valid, errors, value } = validateActivity(b, { editing: true });
  if (!valid) return fail('INVALID', 400, { message: 'Check the highlighted fields.', errors });

  // member_id is deliberately NOT editable. Moving a contribution from one
  // person to another is deleting one record and writing another, and should
  // read that way in the audit log.
  delete value.member_id;
  if (!Object.keys(value).length) return fail('INVALID', 400, { message: 'Nothing to change.' });

  const { data, error } = await sb.from('member_activities')
    .update(value).eq('id', b.id).select('*').maybeSingle();
  if (error) return fail('WRITE_FAILED', 500, { message: 'Could not update.', detail: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'That activity no longer exists.' });

  await logAudit({
    action: 'ACTIVITY_EDITED', actor: admin?.username || 'admin',
    details: `${b.id}: ${Object.keys(value).join(', ')}`, ip: clientIp(req),
  });
  return ok({ activity: data, message: 'Updated.' });
}

export async function DELETE(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('INVALID', 400, { message: 'Missing activity.' });

  const sb = supabaseAdmin();
  /* Read it before deleting, so the audit entry names what was removed.
   * "ACTIVITY_DELETED 8f2c…" tells nobody anything a year later. */
  const { data: existing } = await sb.from('member_activities')
    .select('title, activity_date, member_id').eq('id', id).maybeSingle();
  if (!existing) return fail('NOT_FOUND', 404, { message: 'That activity no longer exists.' });

  const { error } = await sb.from('member_activities').delete().eq('id', id);
  if (error) return fail('WRITE_FAILED', 500, { message: 'Could not delete.', detail: error.message });

  await logAudit({
    action: 'ACTIVITY_DELETED', actor: admin?.username || 'admin',
    details: `${existing.title} (${existing.activity_date}) for member ${existing.member_id}`,
    ip: clientIp(req),
  });
  return ok({ message: 'Activity removed.' });
}
