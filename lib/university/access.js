import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { fail } from '@/lib/api';
import { buildScope, VISIBLE_STATUSES } from './scope';

/* ── University Ambassador guard — SERVER ONLY ───────────────────────────────
 *
 * Imports supabaseAdmin (service-role key). Never import this from anything
 * under components/ or from a 'use client' page.
 *
 * Every /api/member/university route starts with requireUniversityAmbassador.
 * It re-establishes, from the database and on every request:
 *
 *   1. who the caller is          — requireMember: signed JWT, live member row,
 *                                   active status, session epoch;
 *   2. that they are an ambassador — role === 'university_ambassador', read
 *                                   from the row, never from the token;
 *   3. what they may see          — their ACTIVE assignments, read now.
 *
 * Nothing is cached between requests, so removing an assignment, changing the
 * role, or suspending the member takes effect on the very next click.
 */

export const SCHEMA_HINT = 'Administrator: run supabase/migration_university_portal.sql.';

/* The only member columns the ambassador portal ever loads. Email and mobile
 * are NOT here: they are fetched separately, one member at a time, and only
 * when an admin has allowed it — see CONTACT_COLS. CNIC, date of birth,
 * address, password hash and the rest are never selected at all. */
export const MEMBER_COLS =
  'id, membership_id, full_name, photo_url, photo_public, university_id, university_campus_id, ' +
  'profession, profession_other, field_of_study, education_level, current_position, ' +
  'status, approved_at, created_at, deleted_at';

export const CONTACT_COLS = 'id, email, mobile';

const missing = (e) => /does not exist|schema cache|relation .* not found/i.test(e?.message || '');

/**
 * Guard. `universityId` is what the request asked for; when absent, the
 * ambassador's first assignment is used so the portal can open without one.
 *
 * Returns { member, scope, assignments, universities, res }. When `res` is set
 * the route must return it unchanged.
 */
export async function requireUniversityAmbassador(req, universityId) {
  const { member, res } = await requireMember(req);
  if (res) return { res };

  if (member.role !== 'university_ambassador') {
    return { res: fail('FORBIDDEN', 403, {
      message: 'This area is for University Ambassadors.' }) };
  }

  const sb = supabaseAdmin();
  const { data: rows, error } = await sb.from('university_ambassador_assignments')
    .select('id, university_id, campus_id, can_view_contact, active')
    .eq('ambassador_id', member.id)
    .eq('active', true);

  if (error) {
    if (missing(error)) return { res: fail('SCHEMA_OUT_OF_DATE', 500, {
      message: 'The ambassador portal is not set up yet.', hint: SCHEMA_HINT }) };
    return { res: fail('LOAD_FAILED', 500, { message: 'Could not load your assignment.' }) };
  }

  if (!rows?.length) {
    return { res: fail('NOT_ASSIGNED', 403, {
      message: 'You have not been assigned to a university yet. The TNR administration will assign you.' }) };
  }

  const target = String(universityId || '').trim() || rows[0].university_id;
  const scope = buildScope(rows, target);
  /* Same answer whether the university does not exist or is simply not yours,
     so this endpoint cannot be used to discover which universities have
     members or ambassadors. */
  if (!scope) {
    return { res: fail('FORBIDDEN', 403, { message: 'You are not assigned to that university.' }) };
  }

  // Names for the switcher and the header — the ambassador's own universities only.
  const uniIds = [...new Set(rows.map(r => r.university_id))];
  const campusIds = [...new Set(rows.map(r => r.campus_id).filter(Boolean))];
  const [{ data: unis }, { data: camps }] = await Promise.all([
    sb.from('tnr_universities').select('id, name').in('id', uniIds),
    campusIds.length
      ? sb.from('tnr_university_campuses').select('id, name, university_id').in('id', campusIds)
      : Promise.resolve({ data: [] }),
  ]);
  const uniName = new Map((unis || []).map(u => [u.id, u.name]));
  const campName = new Map((camps || []).map(c => [c.id, c.name]));

  const universities = uniIds.map(id => ({
    id,
    name: uniName.get(id) || id,
    campuses: rows.filter(r => r.university_id === id)
      .map(r => (r.campus_id ? campName.get(r.campus_id) || 'Campus' : null)),
  }));

  return { member, scope, assignments: rows, universities, res: null };
}

/**
 * A members query already restricted to the scope. Every list, count and
 * statistic in the portal is built on this, so there is one place where the
 * restriction is applied and no route can forget a clause of it.
 */
export function scopedMembers(sb, scope, cols = MEMBER_COLS, opts = undefined) {
  let q = sb.from('membership_members').select(cols, opts)
    .eq('university_id', scope.universityId)
    .in('status', VISIBLE_STATUSES)
    .is('deleted_at', null);
  if (scope.campusIds) q = q.in('university_campus_id', scope.campusIds);
  return q;
}

/** Record an ambassador action. Best effort — never fails the request. */
export async function logActivity({ member, universityId, action, target = null, detail = {}, ip = null }) {
  try {
    await supabaseAdmin().from('university_ambassador_activity').insert({
      ambassador_id: member.id,
      ambassador_name: member.full_name,
      university_id: universityId,
      action,
      target_member_id: target,
      detail,
      ip,
    });
  } catch { /* an audit hiccup must not block the ambassador's work */ }
}
