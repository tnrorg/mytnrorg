import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import {
  memberSelect, publicStatus, acceptingApplications,
  validateAnswers, cleanAnswers, PROFILE_FETCH, CATEGORIES,
} from '@/lib/opportunities';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* Opportunities for a signed-in member.
 *
 * requireMember runs before anything else on every method here, so the full
 * details — eligibility, benefits, instructions, terms, the application URL —
 * are unreachable without a valid member session. The public endpoint cannot
 * return them at all; this one is the only route that can, and it is gated.
 *
 * Backwards compatible: the old save/unsave behaviour on saved_opportunities
 * still works, because the portal page already uses it.
 */

/** The member's profile, in the shape the application form expects. */
async function profileFor(sb, member) {
  // member_profiles holds address and a few extras; the core row holds the rest.
  const { data: prof } = await sb.from('member_profiles')
    .select('address, city, country').eq('member_id', member.id).maybeSingle();

  const current = [prof?.address, prof?.city, prof?.country].filter(Boolean).join(', ');
  return {
    full_name: member.full_name || [member.first_name, member.last_name].filter(Boolean).join(' '),
    membership_id: member.membership_id || '',
    date_of_birth: member.date_of_birth || '',
    gender: member.gender || '',
    email: member.email || '',
    mobile: member.mobile || '',
    education_level: member.education_level || '',
    profession: member.profession || member.field_of_study || member.current_position || '',
    current_address: current,
    // The membership record keeps one address. Village and union council are
    // the closest thing to a permanent one, and are shown as such rather than
    // asking a member to retype something the committee already holds.
    permanent_address: [member.village, member.union_council].filter(Boolean).join(', '),
  };
}

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const p = new URL(req.url).searchParams;
  const id = (p.get('id') || '').trim();
  const cat = (p.get('category') || '').trim();

  // ── One opportunity, in full ──
  if (id) {
    const { data: o, error } = await sb.from('opportunities')
      .select(memberSelect()).eq('id', id).maybeSingle();
    if (error || !o) return fail('NOT_FOUND', 404, { message: 'Opportunity not found.' });
    // Drafts and archives are not visible to members either — only admins see
    // work in progress.
    if (!['published', 'closed'].includes(o.status))
      return fail('NOT_FOUND', 404, { message: 'Opportunity not found.' });

    const { data: app } = await sb.from('opportunity_applications')
      .select('id, status, submitted_at, updated_at, interview')
      .eq('opportunity_id', id).eq('member_id', member.id).maybeSingle();

    return ok({
      opportunity: { ...o, state: publicStatus(o) },
      accepting: acceptingApplications(o),
      application: app || null,
      profile: await profileFor(sb, member),
      profile_fields: PROFILE_FETCH,
    });
  }

  // ── The board ──
  let q = sb.from('opportunities')
    .select(memberSelect())
    .in('status', ['published', 'closed'])
    .order('pinned', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(200);
  if (cat && CATEGORIES.includes(cat)) q = q.eq('category', cat);

  const [{ data: opps }, { data: saved }, { data: apps }] = await Promise.all([
    q,
    sb.from('saved_opportunities').select('*').eq('member_id', member.id),
    sb.from('opportunity_applications')
      .select('opportunity_id, status, submitted_at').eq('member_id', member.id),
  ]);

  const savedMap = Object.fromEntries((saved || []).map(s => [s.opportunity_id, s]));
  const appMap = Object.fromEntries((apps || []).map(a => [a.opportunity_id, a]));
  const now = Date.now();

  return ok({
    opportunities: (opps || []).map(o => ({
      ...o,
      state: publicStatus(o, now),
      accepting: acceptingApplications(o, now),
      saved: !!savedMap[o.id],
      application: appMap[o.id] || null,
    })),
    categories: CATEGORIES,
    // Every application this member holds, for the "My Applications" view.
    my_applications: apps || [],
  });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  // ── Save / unsave (existing behaviour, unchanged) ──
  if (b.action === 'unsave') {
    await sb.from('saved_opportunities').delete()
      .eq('member_id', member.id).eq('opportunity_id', b.opportunity_id);
    return ok({ saved: false });
  }
  if (b.action === 'save') {
    await sb.from('saved_opportunities').upsert({
      member_id: member.id, opportunity_id: b.opportunity_id,
      applied: !!b.applied, notes: b.notes || null,
    }, { onConflict: 'member_id,opportunity_id' });
    return ok({ saved: true });
  }

  // ── Apply ──
  if (b.action !== 'apply')
    return fail('BAD_ACTION', 400, { message: 'Unknown action.' });

  const oppId = String(b.opportunity_id || '').trim();
  if (!oppId) return fail('INVALID', 400, { message: 'Missing opportunity.' });

  const { data: o } = await sb.from('opportunities')
    .select('id, title, status, deadline, closes_at, application_type')
    .eq('id', oppId).maybeSingle();
  if (!o) return fail('NOT_FOUND', 404, { message: 'Opportunity not found.' });

  /* Re-checked on the server, not trusted from the page.
   *
   * The Apply button disappears when a deadline passes, but a form left open
   * in a tab overnight would still POST. The deadline is a rule, not a hint. */
  if (!acceptingApplications(o))
    return fail('CLOSED', 409, {
      message: 'Applications for this opportunity are closed.',
    });

  const answers = cleanAnswers(b.answers || {});
  const errors = validateAnswers(answers, !!b.declaration_accepted);
  if (Object.keys(errors).length)
    return fail('INVALID', 400, { errors, message: 'Please complete every question.' });

  /* Anything the member had to type because their profile lacked it.
   * Whitelisted against PROFILE_FETCH so a crafted request cannot write
   * arbitrary keys into the row. */
  const allowed = new Set(PROFILE_FETCH.map(f => f.key));
  const gaps = {};
  for (const [k, v] of Object.entries(b.profile_gaps || {})) {
    if (allowed.has(k) && String(v ?? '').trim()) gaps[k] = String(v).trim().slice(0, 300);
  }

  const { data: created, error } = await sb.from('opportunity_applications')
    .insert({
      opportunity_id: oppId,
      member_id: member.id,
      answers,
      profile_gaps: gaps,
      declaration_accepted: true,
      status: 'submitted',
    })
    .select('id, status, submitted_at').single();

  /* 23505 is the unique(opportunity_id, member_id) index doing its job.
   *
   * Two taps on a slow connection both arrive as valid requests, and a
   * "have they applied?" check followed by an insert has a gap between them
   * where both can pass. The constraint closes that gap; this turns it into a
   * calm answer rather than a server error. */
  if (error) {
    if (error.code === '23505')
      return fail('ALREADY_APPLIED', 409, {
        message: 'You have already applied for this opportunity.',
      });
    return fail('APPLY_FAILED', 500, {
      message: /opportunity_applications/i.test(error.message || '')
        ? 'Applications are not set up yet. Run migration_opportunities_v2.sql.'
        : 'Could not submit your application. Please try again.',
      detail: error.message,
    });
  }

  await sb.from('opportunity_application_history').insert({
    application_id: created.id, opportunity_id: oppId, member_id: member.id,
    from_status: null, to_status: 'submitted', changed_by: 'member',
    email_status: 'not_required',
  });

  return ok({ application: created, message: 'Application Submitted Successfully' });
}
