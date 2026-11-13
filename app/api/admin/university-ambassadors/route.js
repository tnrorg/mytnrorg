import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { logMembershipAudit } from '@/lib/membership/core';
import { normUni } from '@/lib/edu/pakistanUniversities';
import { VISIBLE_STATUSES, sanitizeSearch, isStudent } from '@/lib/university/scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* Admin side of the University Ambassador portal. Scope: `membership` (see
 * lib/adminScopes.js) — the same office bearers who already see full member
 * records, because every action here decides who can see whom.
 *
 * Admins can: assign and remove ambassadors, switch contact visibility on or
 * off per assignment, add universities, aliases and campuses, map a member to
 * a university by hand, re-run matching, answer ambassador requests and read
 * the ambassador activity log. Every write is audited. */

const HINT = 'Run supabase/migration_university_portal.sql.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = (e) => /does not exist|schema cache/i.test(e?.message || '');
const schemaFail = () => fail('SCHEMA_OUT_OF_DATE', 500, { message: 'The university portal is not set up yet.', hint: HINT });

const slugify = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110);

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const p = new URL(req.url).searchParams;
  const view = p.get('view') || 'overview';

  if (view === 'universities') {
    const [{ data: unis, error }, { data: camps }] = await Promise.all([
      sb.from('tnr_universities').select('id, name, province, source, active').order('name'),
      sb.from('tnr_university_campuses').select('id, university_id, name').order('name'),
    ]);
    if (error) return missing(error) ? schemaFail() : fail('LOAD_FAILED', 500, { message: 'Could not load universities.' });
    return ok({ universities: unis || [], campuses: camps || [] });
  }

  if (view === 'members') {
    /* Members needing a mapping (unmatched), or a search across everyone so an
       admin can CORRECT an existing mapping. Only the fields needed to decide
       which university someone belongs to. */
    const q = sanitizeSearch(p.get('q'));
    let query = sb.from('membership_members')
      .select('id, membership_id, full_name, organization_name, current_position, university_id, university_campus_id, university_source, status')
      .in('status', VISIBLE_STATUSES).is('deleted_at', null).order('full_name').limit(100);
    if (q) query = query.or(`full_name.ilike.%${q}%,membership_id.ilike.%${q}%,organization_name.ilike.%${q}%`);
    else query = query.is('university_id', null).not('organization_name', 'is', null);
    const { data, error } = await query;
    if (error) return missing(error) ? schemaFail() : fail('LOAD_FAILED', 500, { message: 'Could not load members.' });
    /* A blank-but-not-null organisation is not something to map. */
    return ok({ members: (data || []).filter(m => q || String(m.organization_name || '').trim()) });
  }

  if (view === 'requests') {
    const { data, error } = await sb.from('university_ambassador_requests')
      .select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return missing(error) ? schemaFail() : fail('LOAD_FAILED', 500, { message: 'Could not load requests.' });
    const memberIds = [...new Set((data || []).map(r => r.member_id).filter(Boolean))];
    const { data: ms } = memberIds.length
      ? await sb.from('membership_members').select('id, membership_id, full_name').in('id', memberIds)
      : { data: [] };
    const mBy = new Map((ms || []).map(m => [m.id, m]));
    return ok({ requests: (data || []).map(r => ({ ...r, member: mBy.get(r.member_id) || null })) });
  }

  if (view === 'activity') {
    const { data, error } = await sb.from('university_ambassador_activity')
      .select('id, ambassador_name, university_id, action, target_member_id, detail, created_at')
      .order('created_at', { ascending: false }).limit(200);
    if (error) return missing(error) ? schemaFail() : fail('LOAD_FAILED', 500, { message: 'Could not load activity.' });
    return ok({ activity: data || [] });
  }

  // ── overview ──
  const [assignRes, ambRes, memRes, uniRes, campRes, reqRes] = await Promise.all([
    sb.from('university_ambassador_assignments')
      .select('id, ambassador_id, university_id, campus_id, can_view_contact, note, assigned_by, assigned_at')
      .eq('active', true).order('assigned_at', { ascending: false }),
    sb.from('membership_members')
      .select('id, membership_id, full_name, organization_name, university_id, status')
      .eq('role', 'university_ambassador').is('deleted_at', null).order('full_name'),
    sb.from('membership_members')
      .select('university_id, current_position, organization_name')
      .in('status', VISIBLE_STATUSES).is('deleted_at', null).limit(20000),
    sb.from('tnr_universities').select('id, name'),
    sb.from('tnr_university_campuses').select('id, name'),
    sb.from('university_ambassador_requests').select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
  ]);
  if (assignRes.error) return missing(assignRes.error) ? schemaFail()
    : fail('LOAD_FAILED', 500, { message: 'Could not load assignments.' });

  const uniName = new Map((uniRes.data || []).map(u => [u.id, u.name]));
  const campName = new Map((campRes.data || []).map(c => [c.id, c.name]));
  const ambBy = new Map((ambRes.data || []).map(a => [a.id, a]));

  // Per-university counts, from the live member table.
  const per = new Map();
  let unmatched = 0;
  for (const m of memRes.data || []) {
    if (!m.university_id) { if (String(m.organization_name || '').trim()) unmatched++; continue; }
    const s = per.get(m.university_id) || { members: 0, students: 0, ambassadors: 0 };
    s.members++; if (isStudent(m)) s.students++;
    per.set(m.university_id, s);
  }
  for (const a of assignRes.data || []) {
    const s = per.get(a.university_id) || { members: 0, students: 0, ambassadors: 0 };
    s.ambassadors++; per.set(a.university_id, s);
  }

  return ok({
    assignments: (assignRes.data || []).map(a => ({
      ...a,
      ambassador: ambBy.get(a.ambassador_id) || null,
      university: uniName.get(a.university_id) || a.university_id,
      campus: a.campus_id ? campName.get(a.campus_id) || null : null,
    })),
    ambassadors: (ambRes.data || []).map(a => ({
      ...a,
      // The ambassador's own university, already matched by the database —
      // offered as the default when assigning them.
      suggested_university: a.university_id || null,
      suggested_name: a.university_id ? uniName.get(a.university_id) || null : null,
    })),
    stats: [...per.entries()]
      .map(([id, s]) => ({ id, name: uniName.get(id) || id, ...s }))
      .sort((a, b) => b.members - a.members),
    unmatched,
    open_requests: reqRes.count || 0,
  });
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const ip = clientIp(req);
  const audit = (action, target_id, new_value, previous_value = null, reason = null) =>
    logMembershipAudit({ admin_name: admin.username, action, target_type: 'university_portal',
      target_id, previous_value, new_value, reason, ip });

  const uniExists = async (id) => {
    if (!id) return null;
    const { data } = await sb.from('tnr_universities').select('id, name, active').eq('id', id).maybeSingle();
    return data;
  };
  const campusOf = async (campusId, universityId) => {
    if (!campusId) return null;
    if (!UUID.test(campusId)) return false;
    const { data } = await sb.from('tnr_university_campuses').select('id, university_id').eq('id', campusId).maybeSingle();
    return data && data.university_id === universityId ? data : false;
  };

  switch (b.op) {
    // ── Assign an ambassador ──
    case 'assign': {
      if (!UUID.test(String(b.ambassador_id || ''))) return fail('BAD_MEMBER', 400, { message: 'Choose an ambassador.' });
      const { data: amb } = await sb.from('membership_members')
        .select('id, membership_id, full_name, role, status').eq('id', b.ambassador_id).is('deleted_at', null).maybeSingle();
      /* Only someone who already holds the role. Granting the role is a
         separate, deliberate step in Leadership — this screen cannot turn an
         ordinary member into someone who can see other members' records. */
      if (!amb || amb.role !== 'university_ambassador')
        return fail('NOT_AMBASSADOR', 400, { message: 'That member is not a University Ambassador. Give them the role in Leadership first.' });
      if (!VISIBLE_STATUSES.includes(amb.status))
        return fail('NOT_ACTIVE', 400, { message: 'That membership is not active.' });

      const uni = await uniExists(b.university_id);
      if (!uni || !uni.active) return fail('BAD_UNIVERSITY', 400, { message: 'Choose a university.' });
      const camp = await campusOf(b.campus_id || null, uni.id);
      if (camp === false) return fail('BAD_CAMPUS', 400, { message: 'That campus does not belong to this university.' });

      const { data: a, error } = await sb.from('university_ambassador_assignments').insert({
        ambassador_id: amb.id, university_id: uni.id, campus_id: camp?.id || null,
        can_view_contact: !!b.can_view_contact, note: String(b.note || '').trim().slice(0, 500) || null,
        assigned_by: admin.username,
      }).select('id').single();
      if (error) {
        if (error.code === '23505') return fail('ALREADY_ASSIGNED', 409, { message: 'This ambassador is already assigned there.' });
        return missing(error) ? schemaFail() : fail('SAVE_FAILED', 500, { message: 'Could not assign.' });
      }
      await audit('UNI_AMBASSADOR_ASSIGNED', amb.membership_id,
        { university: uni.id, campus: camp?.id || null, can_view_contact: !!b.can_view_contact });
      return ok({ id: a.id });
    }

    // ── Remove (soft) ──
    case 'remove': {
      if (!UUID.test(String(b.assignment_id || ''))) return fail('BAD_ID', 400, { message: 'Which assignment?' });
      const { data: a } = await sb.from('university_ambassador_assignments')
        .select('id, ambassador_id, university_id, campus_id, active').eq('id', b.assignment_id).maybeSingle();
      if (!a || !a.active) return fail('NOT_FOUND', 404, { message: 'Assignment not found.' });
      await sb.from('university_ambassador_assignments').update({
        active: false, removed_by: admin.username, removed_at: new Date().toISOString(),
      }).eq('id', a.id);
      await audit('UNI_AMBASSADOR_REMOVED', a.ambassador_id, null, { university: a.university_id, campus: a.campus_id });
      return ok({ removed: true });
    }

    // ── Contact visibility ──
    case 'set_contact': {
      if (!UUID.test(String(b.assignment_id || ''))) return fail('BAD_ID', 400, { message: 'Which assignment?' });
      const { data: a } = await sb.from('university_ambassador_assignments')
        .select('id, ambassador_id, can_view_contact').eq('id', b.assignment_id).eq('active', true).maybeSingle();
      if (!a) return fail('NOT_FOUND', 404, { message: 'Assignment not found.' });
      await sb.from('university_ambassador_assignments').update({ can_view_contact: !!b.can_view_contact }).eq('id', a.id);
      await audit('UNI_AMBASSADOR_CONTACT', a.ambassador_id,
        { can_view_contact: !!b.can_view_contact }, { can_view_contact: a.can_view_contact });
      return ok({ can_view_contact: !!b.can_view_contact });
    }

    // ── Map one member by hand ──
    case 'map_member': {
      if (!UUID.test(String(b.member_id || ''))) return fail('BAD_MEMBER', 400, { message: 'Which member?' });
      const { data: m } = await sb.from('membership_members')
        .select('id, membership_id, university_id, university_campus_id').eq('id', b.member_id).maybeSingle();
      if (!m) return fail('NOT_FOUND', 404, { message: 'Member not found.' });

      let uniId = null, campId = null;
      if (b.university_id) {
        const uni = await uniExists(b.university_id);
        if (!uni) return fail('BAD_UNIVERSITY', 400, { message: 'Unknown university.' });
        uniId = uni.id;
        const camp = await campusOf(b.campus_id || null, uniId);
        if (camp === false) return fail('BAD_CAMPUS', 400, { message: 'That campus does not belong to this university.' });
        campId = camp?.id || null;
      }
      /* Writes ONLY the mapping columns. The member's own organization_name —
         what they typed — is left exactly as it was. Marked 'admin' so that
         re-running automatic matching can never undo it. */
      const { error } = await sb.from('membership_members').update({
        university_id: uniId, university_campus_id: campId,
        university_source: uniId ? 'admin' : null, university_mapped_at: new Date().toISOString(),
      }).eq('id', m.id);
      if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save the mapping.' });
      await audit('UNI_MEMBER_MAPPED', m.membership_id, { university: uniId, campus: campId },
        { university: m.university_id, campus: m.university_campus_id });
      return ok({ mapped: true });
    }

    // ── Universities, aliases, campuses ──
    case 'add_university': {
      const name = String(b.name || '').trim().replace(/\s+/g, ' ');
      if (name.length < 3 || name.length > 160) return fail('BAD_NAME', 400, { message: 'Enter the university name.' });
      const alias = normUni(name);
      const { data: clash } = await sb.from('tnr_university_aliases')
        .select('university_id').eq('alias_norm', alias).maybeSingle();
      if (clash) return fail('EXISTS', 409, { message: `That name already matches an existing university (${clash.university_id}).` });

      let id = slugify(name) || 'university';
      for (let i = 2; (await uniExists(id)) && i < 50; i++) id = `${slugify(name)}-${i}`;
      const { error } = await sb.from('tnr_universities').insert({
        id, name, province: String(b.province || '').trim() || null,
        country: String(b.country || 'Pakistan').trim() || 'Pakistan', source: 'admin',
      });
      if (error) return missing(error) ? schemaFail() : fail('SAVE_FAILED', 500, { message: 'Could not add the university.' });
      await sb.from('tnr_university_aliases').insert({ alias_norm: alias, university_id: id, source: 'admin' });
      const { data: remapped } = await sb.rpc('tnr_remap_universities');
      await audit('UNI_ADDED', id, { name, province: b.province || null });
      return ok({ id, remapped: remapped ?? 0 });
    }

    case 'add_alias': {
      const uni = await uniExists(b.university_id);
      if (!uni) return fail('BAD_UNIVERSITY', 400, { message: 'Choose a university.' });
      const alias = normUni(b.alias);
      if (!alias || alias.length < 2) return fail('BAD_ALIAS', 400, { message: 'Enter the spelling to accept.' });
      const { error } = await sb.from('tnr_university_aliases')
        .insert({ alias_norm: alias, university_id: uni.id, source: 'admin' });
      if (error) {
        if (error.code === '23505') {
          const { data: owner } = await sb.from('tnr_university_aliases').select('university_id').eq('alias_norm', alias).maybeSingle();
          return fail('ALIAS_TAKEN', 409, { message: `"${b.alias}" already means ${owner?.university_id || 'another university'}.` });
        }
        return fail('SAVE_FAILED', 500, { message: 'Could not add the spelling.' });
      }
      const { data: remapped } = await sb.rpc('tnr_remap_universities');
      await audit('UNI_ALIAS_ADDED', uni.id, { alias });
      return ok({ remapped: remapped ?? 0 });
    }

    case 'add_campus': {
      const uni = await uniExists(b.university_id);
      if (!uni) return fail('BAD_UNIVERSITY', 400, { message: 'Choose a university.' });
      const name = String(b.name || '').trim().replace(/\s+/g, ' ');
      if (name.length < 2 || name.length > 120) return fail('BAD_NAME', 400, { message: 'Enter the campus name.' });
      const { data, error } = await sb.from('tnr_university_campuses')
        .insert({ university_id: uni.id, name, created_by: admin.username }).select('id').single();
      if (error) {
        if (error.code === '23505') return fail('EXISTS', 409, { message: 'That campus already exists.' });
        return fail('SAVE_FAILED', 500, { message: 'Could not add the campus.' });
      }
      await audit('UNI_CAMPUS_ADDED', uni.id, { campus: name });
      return ok({ id: data.id });
    }

    case 'remap': {
      const { data, error } = await sb.rpc('tnr_remap_universities');
      if (error) return missing(error) ? schemaFail() : fail('REMAP_FAILED', 500, { message: 'Could not re-run matching.' });
      await audit('UNI_REMAP', null, { changed: data ?? 0 });
      return ok({ changed: data ?? 0 });
    }

    // ── Answer an ambassador request ──
    case 'answer_request': {
      if (!UUID.test(String(b.id || ''))) return fail('BAD_ID', 400, { message: 'Which request?' });
      if (!['open', 'in_progress', 'resolved', 'declined'].includes(b.status))
        return fail('BAD_STATUS', 400, { message: 'Unknown status.' });
      const { data: r } = await sb.from('university_ambassador_requests')
        .select('id, ambassador_id, subject, status').eq('id', b.id).maybeSingle();
      if (!r) return fail('NOT_FOUND', 404, { message: 'Request not found.' });

      const reply = String(b.admin_reply || '').trim().slice(0, 2000) || null;
      await sb.from('university_ambassador_requests').update({
        status: b.status, admin_reply: reply, handled_by: admin.username, handled_at: new Date().toISOString(),
      }).eq('id', r.id);

      // Let the ambassador know, through the same notification bell.
      if (r.ambassador_id) {
        await sb.from('membership_notifications').insert({
          member_id: r.ambassador_id,
          title: `Your request: ${b.status.replace('_', ' ')}`,
          body: `${r.subject}${reply ? `\n\n${reply}` : ''}`,
          link: '/member/university',
          category: 'university',
        }).then(() => {}, () => {});
      }
      await audit('UNI_REQUEST_ANSWERED', r.id, { status: b.status }, { status: r.status });
      return ok({ updated: true });
    }

    default:
      return fail('BAD_OP', 400, { message: 'Unknown operation.' });
  }
}
