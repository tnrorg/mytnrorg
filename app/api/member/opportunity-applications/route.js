import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { canReviewOpportunityApplications } from '@/lib/membership/roles';
import { ok, fail } from '@/lib/api';
import { FELLOWSHIP_QUESTIONS, APP_STATUSES } from '@/lib/opportunities';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Scholarship and fellowship applications, for the selection panel to read in
 * their own portal.
 *
 * THREE RULES, all enforced here rather than in the UI, so they hold for a
 * request made directly to this endpoint:
 *
 *   1. READ ONLY. There is no POST, PATCH or DELETE in this file, so a
 *      reviewer cannot change a status however they call it. Decisions belong
 *      to admins, where each one is confirmed, emailed and recorded in the
 *      audit history. Two places that can move an application is one too many.
 *
 *   2. Only the three named reviewers in lib/membership/roles.js may read it
 *      at all. NOT role-based: a seat on the Advisory Council or the Executive
 *      Committee does not carry access, so the panel stays the same size when
 *      those committees change membership.
 *
 *   3. Contact details are withheld. A reviewer is here to judge the
 *      application; a phone number and a home address are not part of that
 *      judgement, and there is no reason for every panel member to end up
 *      holding a list of applicants' mobile numbers. The admin panel has them
 *      for the people who actually need to make contact.
 */

// Note what is ABSENT: email, mobile, date_of_birth, village, union_council.
const APPLICANT_COLUMNS =
  'id, membership_id, full_name, photo_url, photo_public, gender, ' +
  'education_level, profession, field_of_study, current_position';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  if (!canReviewOpportunityApplications(member)) {
    return fail('FORBIDDEN', 403, {
      message: 'You are not on the selection panel for these applications.',
    });
  }

  const p = new URL(req.url).searchParams;
  const oppId = (p.get('opportunity_id') || '').trim();
  const status = (p.get('status') || '').trim();

  const sb = supabaseAdmin();
  let q = sb.from('opportunity_applications')
    // `profile_gaps` is deliberately not selected — it holds whatever the
    // applicant had to type because their profile lacked it, which is exactly
    // the contact detail this view withholds.
    .select('id, opportunity_id, member_id, answers, status, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(500);
  if (oppId) q = q.eq('opportunity_id', oppId);
  if (status && APP_STATUSES.includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return ok({
    applications: [], opportunities: [], stats: {}, questions: FELLOWSHIP_QUESTIONS,
    hint: 'Administrator: run supabase/migration_opportunities_v2.sql.',
  });

  const rows = data || [];
  let people = {}, opps = {};
  if (rows.length) {
    const [{ data: mem }, { data: op }] = await Promise.all([
      sb.from('membership_members').select(APPLICANT_COLUMNS)
        .in('id', [...new Set(rows.map(r => r.member_id))]),
      sb.from('opportunities').select('id, title, category, organization, deadline')
        .in('id', [...new Set(rows.map(r => r.opportunity_id))]),
    ]);
    people = Object.fromEntries((mem || []).map(m => [m.id, {
      membership_id: m.membership_id,
      full_name: m.full_name,
      // photo_public honoured exactly as everywhere else. Applying for a
      // scholarship is not consent to show your face to the panel.
      photo_url: m.photo_public === false ? null : (m.photo_url || null),
      gender: m.gender,
      education_level: m.education_level,
      profession: m.profession || m.field_of_study || m.current_position || null,
    }]));
    opps = Object.fromEntries((op || []).map(o => [o.id, o]));
  }

  const stats = { total: rows.length };
  for (const s of APP_STATUSES) stats[s] = rows.filter(r => r.status === s).length;

  return ok({
    stats,
    questions: FELLOWSHIP_QUESTIONS,
    // The opportunities represented here, so the page can offer a filter
    // without a second request.
    opportunities: Object.values(opps),
    applications: rows.map(a => ({
      id: a.id,
      opportunity: opps[a.opportunity_id] || null,
      applicant: people[a.member_id] || null,
      answers: a.answers || {},
      status: a.status,
      submitted_at: a.submitted_at,
    })),
    // Told plainly, so a reviewer does not go looking for buttons that are not
    // there and conclude the page is broken.
    read_only: true,
  });
}
