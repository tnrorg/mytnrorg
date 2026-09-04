import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseServer';
import {
  yearBounds, emptyRecord, ACTIVITY_TYPE_KEYS,
} from '@/lib/contributions';

/* Turning a calendar year into a contribution record for every member.
 *
 * ONE function does this, and both the admin tab and the member's own page go
 * through it. Two implementations of "how many meetings did she attend" is two
 * numbers that disagree in front of the person they are about.
 *
 * Everything here runs with the service-role key, which bypasses RLS. Nothing
 * in this file decides WHO may see a record — that is the routes' job, and the
 * member route in particular passes only the caller's own id. This file will
 * happily compute a record for anybody it is asked about, so a caller that
 * takes a member id from the request body is a data leak. There isn't one.
 */

/* Read every row, not the first thousand.
 *
 * PostgREST caps a response at 1000 rows by default and says nothing about it.
 * A year of meetings across 293 members is several thousand participant rows,
 * so an unpaginated read silently reported attendance for the first fraction
 * of the organisation and zero for everybody else — the kind of wrong that
 * looks exactly like a quiet year. */
const PAGE = 1000;

async function pageAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { rows: out, error };
    const batch = data || [];
    out.push(...batch);
    if (batch.length < PAGE) return { rows: out, error: null };
    // A runaway guard. 200 pages is 200,000 rows — far beyond anything this
    // organisation will produce, and a loop that cannot end is worse than a
    // number that is short.
    if (from > PAGE * 200) return { rows: out, error: null };
  }
}

/** Add a member to the map on first sight, so every id gets a full record. */
function rec(map, id) {
  if (!id) return null;
  if (!map.has(id)) map.set(id, emptyRecord());
  return map.get(id);
}

/**
 * Contribution records for a calendar year.
 *
 * @param {object}   opts
 * @param {number}   opts.year
 * @param {string[]} [opts.memberIds]  restrict to these members. The member
 *   portal passes exactly one id — its own caller's.
 * @returns {Promise<{ records: Map<string, object>, meetingsHeld: number,
 *                     missing: string[], bounds: object }>}
 *   `missing` names any table that could not be read. The UI shows that as a
 *   warning; it does NOT show zeros as if they were the answer.
 */
export async function contributionYear({ year, memberIds = null } = {}) {
  const sb = supabaseAdmin();
  const b = yearBounds(year);
  const records = new Map();
  const missing = [];
  const only = Array.isArray(memberIds) && memberIds.length ? memberIds : null;

  if (only) for (const id of only) rec(records, id);

  // ── 1. Which meetings belong to this year ────────────────────────────────
  /* Cancelled meetings are excluded everywhere below. Counting a member absent
   * from a meeting that never happened is a false mark on their record, and it
   * is the sort of thing nobody notices until an election. */
  const meetingsQ = await pageAll(() => sb.from('meetings')
    .select('id, host_id, co_host_ids, status, scheduled_at')
    .gte('scheduled_at', b.from).lt('scheduled_at', b.to)
    .neq('status', 'cancelled'));

  if (meetingsQ.error) missing.push('meetings');
  const meetings = meetingsQ.rows;
  const meetingIds = meetings.map(m => m.id);

  // ── 2. Who was invited ───────────────────────────────────────────────────
  if (meetingIds.length) {
    for (let i = 0; i < meetingIds.length; i += 100) {
      const chunk = meetingIds.slice(i, i + 100);
      const q = await pageAll(() => {
        let sel = sb.from('meeting_participants').select('member_id').in('meeting_id', chunk);
        if (only) sel = sel.in('member_id', only);
        return sel;
      });
      if (q.error) { if (!missing.includes('meeting_participants')) missing.push('meeting_participants'); break; }
      for (const r of q.rows) { const x = rec(records, r.member_id); if (x) x.meetings.invited += 1; }
    }

    // ── 3. Who actually turned up ──────────────────────────────────────────
    for (let i = 0; i < meetingIds.length; i += 100) {
      const chunk = meetingIds.slice(i, i + 100);
      const q = await pageAll(() => {
        let sel = sb.from('meeting_attendance')
          .select('member_id, attendance_status, total_duration_seconds')
          .in('meeting_id', chunk);
        if (only) sel = sel.in('member_id', only);
        return sel;
      });
      if (q.error) { if (!missing.includes('meeting_attendance')) missing.push('meeting_attendance'); break; }

      for (const r of q.rows) {
        const x = rec(records, r.member_id); if (!x) continue;
        const s = String(r.attendance_status || '').toLowerCase();
        /* Present and late both count as ATTENDED. Someone who joined twenty
         * minutes late still came, and a tracker that files them with the
         * people who did not is a tracker nobody trusts. Lateness is kept as
         * its own figure so it is visible without being punitive. */
        if (s === 'present' || s === 'late') x.meetings.attended += 1;
        if (s === 'late') x.meetings.late += 1;
        if (s === 'partial') x.meetings.partial += 1;
        if (s === 'absent') x.meetings.absent += 1;
        x.meetings.minutes += Math.round((Number(r.total_duration_seconds) || 0) / 60);
      }
    }
  }

  // ── 4. Meetings hosted or co-hosted ──────────────────────────────────────
  /* The one leadership duty the platform records reliably: the host is stored
   * on the meeting itself. */
  for (const m of meetings) {
    const ids = [m.host_id, ...(Array.isArray(m.co_host_ids) ? m.co_host_ids : [])].filter(Boolean);
    for (const id of new Set(ids)) {
      if (only && !only.includes(id)) continue;
      const x = rec(records, id); if (x) x.leadership.hosted += 1;
    }
  }

  // ── 5. Writing: opinions published this year ─────────────────────────────
  /* published_at, not created_at. A piece drafted in December and published in
   * January belongs to the year it reached readers — that is when the
   * contribution to TNR actually happened. */
  {
    const q = await pageAll(() => {
      let sel = sb.from('opinions').select('member_id')
        .eq('status', 'published')
        .gte('published_at', b.from).lt('published_at', b.to);
      if (only) sel = sel.in('member_id', only);
      return sel;
    });
    if (q.error) missing.push('opinions');
    for (const r of q.rows) { const x = rec(records, r.member_id); if (x) x.writing.opinions += 1; }
  }

  // ── 6. Writing: comments ─────────────────────────────────────────────────
  {
    const q = await pageAll(() => {
      let sel = sb.from('opinion_comments').select('member_id')
        .is('deleted_at', null)
        .gte('created_at', b.from).lt('created_at', b.to);
      if (only) sel = sel.in('member_id', only);
      return sel;
    });
    if (q.error) missing.push('opinion_comments');
    for (const r of q.rows) { const x = rec(records, r.member_id); if (x) x.writing.comments += 1; }
  }

  // ── 7. Field work, logged by an office bearer ────────────────────────────
  /* activity_date is a `date` column with no timezone, so it is compared
   * against plain YYYY-MM-DD. Comparing a date against an ISO instant makes
   * Postgres coerce one side, and the row on 1 January lands in the wrong
   * year. */
  {
    const q = await pageAll(() => {
      let sel = sb.from('member_activities')
        .select('member_id, activity_type, hours, verified_at')
        .gte('activity_date', b.fromDate).lte('activity_date', b.toDate);
      if (only) sel = sel.in('member_id', only);
      return sel;
    });
    if (q.error) missing.push('member_activities');
    for (const r of q.rows) {
      const x = rec(records, r.member_id); if (!x) continue;
      x.activities.count += 1;
      x.activities.hours += Number(r.hours) || 0;
      if (r.verified_at) x.activities.verified += 1;
      const t = ACTIVITY_TYPE_KEYS.includes(r.activity_type) ? r.activity_type : 'other';
      x.activities.byType[t] = (x.activities.byType[t] || 0) + 1;
      // Committee work done off-platform is a leadership duty as much as
      // chairing a session on it.
      if (t === 'committee_work') x.leadership.duties += 1;
    }
  }

  // ── 8. Guidance requests answered ────────────────────────────────────────
  /* Council and leadership members answer members' guidance requests. The
   * request points at a leadership_profile, which points at a member, so this
   * one is genuinely automatic.
   *
   * HONEST LIMITATION, recorded rather than hidden: this is the ONLY admin-side
   * duty that can be attributed to a person. audit_logs records the admin
   * USERNAME, and admin_users has no link to membership_members, so reviewing
   * an application or moderating a comment cannot be credited to a member
   * without inventing a join that would be wrong as often as it was right.
   * Those duties are logged by hand as 'committee_work' instead. */
  {
    const profiles = await pageAll(() => {
      let sel = sb.from('leadership_profiles').select('id, member_id').not('member_id', 'is', null);
      if (only) sel = sel.in('member_id', only);
      return sel;
    });
    if (profiles.error) missing.push('leadership_profiles');

    const byProfile = new Map(profiles.rows.map(p => [p.id, p.member_id]));
    const profileIds = [...byProfile.keys()];

    for (let i = 0; i < profileIds.length; i += 100) {
      const chunk = profileIds.slice(i, i + 100);
      const q = await pageAll(() => sb.from('council_guidance_requests')
        .select('profile_id')
        .in('profile_id', chunk)
        .not('replied_at', 'is', null)
        .gte('replied_at', b.from).lt('replied_at', b.to));
      if (q.error) { if (!missing.includes('council_guidance_requests')) missing.push('council_guidance_requests'); break; }
      for (const r of q.rows) {
        const x = rec(records, byProfile.get(r.profile_id)); if (x) x.leadership.duties += 1;
      }
    }
  }

  // Hours accumulate as floats; round once, at the end.
  for (const x of records.values()) {
    x.activities.hours = Math.round(x.activities.hours * 100) / 100;
  }

  return { records, meetingsHeld: meetings.length, missing, bounds: b };
}

/**
 * One member's activity timeline for a year — the individual entries behind
 * the counts, so a figure can always be traced to the things that produced it.
 *
 * The caller supplies the member id. The member route supplies its own
 * caller's; the admin route supplies the one being viewed.
 */
export async function memberTimeline(memberId, year) {
  if (!memberId) return { items: [], missing: [] };
  const sb = supabaseAdmin();
  const b = yearBounds(year);
  const items = [];
  const missing = [];

  // Meetings the member was invited to, with what happened.
  const att = await pageAll(() => sb.from('meeting_attendance')
    .select('meeting_id, attendance_status, total_duration_seconds, first_joined_at')
    .eq('member_id', memberId)
    .gte('first_joined_at', b.from).lt('first_joined_at', b.to));
  if (att.error) missing.push('meeting_attendance');

  const mIds = [...new Set(att.rows.map(r => r.meeting_id))];
  const titles = new Map();
  for (let i = 0; i < mIds.length; i += 100) {
    const { data } = await sb.from('meetings')
      .select('id, title, scheduled_at, meeting_type')
      .in('id', mIds.slice(i, i + 100));
    for (const m of data || []) titles.set(m.id, m);
  }
  for (const r of att.rows) {
    const m = titles.get(r.meeting_id);
    if (!m) continue;
    items.push({
      kind: 'meeting', at: m.scheduled_at,
      title: m.title,
      detail: `${r.attendance_status} · ${Math.round((r.total_duration_seconds || 0) / 60)} min`,
      status: r.attendance_status,
    });
  }

  const ops = await pageAll(() => sb.from('opinions')
    .select('title, published_title, published_at')
    .eq('member_id', memberId).eq('status', 'published')
    .gte('published_at', b.from).lt('published_at', b.to));
  if (ops.error) missing.push('opinions');
  for (const o of ops.rows) {
    items.push({ kind: 'opinion', at: o.published_at,
      title: o.published_title || o.title, detail: 'Opinion published' });
  }

  const acts = await pageAll(() => sb.from('member_activities')
    .select('id, activity_type, title, description, activity_date, hours, location, verified_at, evidence_url')
    .eq('member_id', memberId)
    .gte('activity_date', b.fromDate).lte('activity_date', b.toDate));
  if (acts.error) missing.push('member_activities');
  for (const a of acts.rows) {
    items.push({
      kind: 'activity', id: a.id, at: `${a.activity_date}T12:00:00.000Z`,
      date: a.activity_date, activity_type: a.activity_type,
      title: a.title, detail: a.description || '',
      hours: a.hours, location: a.location,
      verified: !!a.verified_at, evidence_url: a.evidence_url,
    });
  }

  // Newest first. A timeline read from the top should start with what happened
  // most recently.
  items.sort((x, y) => new Date(y.at) - new Date(x.at));
  return { items, missing, bounds: b };
}
