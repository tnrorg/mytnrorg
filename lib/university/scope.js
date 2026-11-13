/* ── University Ambassador scope rules ───────────────────────────────────────
 *
 * Pure functions: no database, no request. Everything that decides WHO AN
 * AMBASSADOR MAY SEE lives here, so it can be tested on its own with any
 * number of universities, campuses and ambassadors, and so the API routes
 * cannot each invent a slightly different version of the rule.
 *
 * Safe to import anywhere (it holds no secrets) — but importing it into the
 * browser decides nothing. The server applies these rules; the portal page
 * only displays what the server already chose to send.
 *
 * THE RULE
 *
 *   An ambassador may see a member when ALL of these hold:
 *     • the ambassador's role is university_ambassador;
 *     • the ambassador holds an ACTIVE assignment to the member's university;
 *     • that assignment covers the whole university, or the member has been
 *       placed on the assignment's campus;
 *     • the member is approved and active, and not deleted.
 *
 *   The member's university is read from membership_members.university_id —
 *   the live column the database keeps in step with what the member typed —
 *   never from a copy, a cache, or anything the browser sends.
 */

/** Statuses visible in the portal. Pending applications never appear: a
 *  person becomes visible to their ambassador after approval, not before. */
export const VISIBLE_STATUSES = ['active', 'approved'];

export const FOLLOWUP_STATUSES = [
  ['none', 'No follow-up'],
  ['needs_followup', 'Needs follow-up'],
  ['contacted', 'Contacted'],
  ['resolved', 'Resolved'],
];
export const FOLLOWUP_KEYS = FOLLOWUP_STATUSES.map(([k]) => k);
export const followupLabel = (k) =>
  (FOLLOWUP_STATUSES.find(([key]) => key === k) || FOLLOWUP_STATUSES[0])[1];

export const REQUEST_KINDS = [
  ['correction', 'Correction to a member record'],
  ['support', 'Support for a member'],
  ['other', 'Something else'],
];
export const REQUEST_KEYS = REQUEST_KINDS.map(([k]) => k);

/**
 * The scope for one university, from an ambassador's active assignments.
 *
 * Returns null when none of the assignments covers that university — the
 * caller turns null into a 403, and must not say whether the university
 * exists, so the portal cannot be used to probe the roll.
 *
 * `campusIds` is null for "the whole university". If ANY assignment for this
 * university is campus-less, the whole university is visible — a broader
 * grant is never narrowed by a narrower one held alongside it.
 */
export function buildScope(assignments, universityId) {
  const mine = (assignments || []).filter(a => a && a.active !== false && a.university_id === universityId);
  if (!universityId || !mine.length) return null;
  const whole = mine.some(a => !a.campus_id);
  return {
    universityId,
    campusIds: whole ? null : [...new Set(mine.map(a => a.campus_id))],
    assignments: mine,
  };
}

/** Is this member inside the scope? Used as a second check after every fetch. */
export function memberInScope(m, scope) {
  if (!m || !scope) return false;
  if (m.deleted_at) return false;
  if (!VISIBLE_STATUSES.includes(m.status)) return false;
  if (m.university_id !== scope.universityId) return false;
  if (scope.campusIds && !scope.campusIds.includes(m.university_campus_id)) return false;
  return true;
}

/* Contact details (email, mobile) are shown only when an admin switched them
 * on for an assignment that covers THIS member. A contact-enabled assignment
 * for one campus does not reveal contact details at another. */
export function contactAllowed(m, scope) {
  if (!memberInScope(m, scope)) return false;
  return scope.assignments.some(a =>
    a.can_view_contact && (!a.campus_id || a.campus_id === m.university_campus_id));
}

/** Is the member currently studying? Only data we actually hold: their stated
 *  position. "Not studying" covers alumni AND staff — TNR records neither
 *  graduation nor employment at the university, so the two cannot honestly be
 *  told apart and are not presented as if they could. */
export const isStudent = (m) => m?.current_position === 'Student';

/**
 * Strip a search string down to characters that are safe inside a PostgREST
 * `.or()` filter. Commas, brackets, dots-with-operators and quotes there are
 * syntax, not text: "a,status.eq.suspended" would otherwise add a filter of
 * the caller's choosing. Letters, digits, spaces and hyphens are all a name or
 * a membership ID ever needs.
 */
export function sanitizeSearch(q) {
  return String(q || '').replace(/[^\p{L}\p{N} \-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/* What an ambassador's directory row may contain. Built field by field — never
 * by spreading the database row — so a column added to membership_members
 * tomorrow cannot leak through this view by default. */
export function toDirectoryRow(m, { followup = 'none', campusName = null } = {}) {
  return {
    id: m.id,
    membership_id: m.membership_id,
    full_name: m.full_name,
    /* The member's own photo setting, respected here exactly as on the public
       site: photo_public false means no photo, to anyone. */
    photo_url: m.photo_public === false ? null : (m.photo_url || null),
    campus: campusName,
    department: m.profession === 'Other'
      ? (m.profession_other || m.field_of_study || null)
      : (m.profession || m.field_of_study || null),
    program: m.education_level || null,
    position: m.current_position || null,
    student: isStudent(m),
    status: m.status,
    joined_at: m.approved_at || m.created_at || null,
    followup,
  };
}

/** Members approved in the last N days. */
export const isNew = (m, days = 30, now = Date.now()) => {
  const t = Date.parse(m.approved_at || m.created_at || '');
  return Number.isFinite(t) && now - t <= days * 86400000;
};

/** Registrations per month for the last 12 months, oldest first. */
export function monthlyTrend(members, now = new Date()) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), count: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const m of members) {
    const k = String(m.approved_at || m.created_at || '').slice(0, 7);
    if (idx.has(k)) months[idx.get(k)].count++;
  }
  return months;
}
