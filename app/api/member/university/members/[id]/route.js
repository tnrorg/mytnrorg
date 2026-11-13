import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import {
  requireUniversityAmbassador, scopedMembers, logActivity, CONTACT_COLS,
} from '@/lib/university/access';
import {
  memberInScope, contactAllowed, toDirectoryRow, FOLLOWUP_KEYS, followupLabel,
} from '@/lib/university/scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Same 404 whether the member does not exist, belongs to another university,
 * sits on another campus, or is suspended. An ambassador must not be able to
 * tell "not mine" from "not real" by trying ids. */
const notFound = () => fail('NOT_FOUND', 404, { message: 'Member not found in your university.' });

/** Load one member, inside the scope, or nothing. */
async function loadInScope(sb, scope, id) {
  if (!UUID.test(String(id || ''))) return null;
  const { data: m } = await scopedMembers(sb, scope).eq('id', id).maybeSingle();
  /* The query already carried the scope; this re-checks the row that came
     back against the same rule. Two independent checks, so a mistake in
     either one alone does not leak a record. */
  return m && memberInScope(m, scope) ? m : null;
}

// GET — one member's details, follow-up status and coordination notes.
export async function GET(req, props) {
  const { id } = await props.params;
  const u = new URL(req.url).searchParams.get('u');
  const { member: amb, scope, res } = await requireUniversityAmbassador(req, u);
  if (res) return res;

  const sb = supabaseAdmin();
  const m = await loadInScope(sb, scope, id);
  if (!m) return notFound();

  const [{ data: fu }, { data: notes }, { data: uni }, { data: camp }] = await Promise.all([
    sb.from('university_member_followups').select('status, updated_at')
      .eq('university_id', scope.universityId).eq('member_id', m.id).maybeSingle(),
    sb.from('university_member_notes').select('id, author_name, body, created_at')
      .eq('university_id', scope.universityId).eq('member_id', m.id)
      .order('created_at', { ascending: false }).limit(50),
    sb.from('tnr_universities').select('name').eq('id', scope.universityId).maybeSingle(),
    m.university_campus_id
      ? sb.from('tnr_university_campuses').select('name').eq('id', m.university_campus_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  /* Contact details: only with an admin's explicit permission for an
     assignment covering this member, fetched separately so they never ride
     along on the directory query, and logged every time they are shown. */
  let contact = null;
  if (contactAllowed(m, scope)) {
    const { data: c } = await sb.from('membership_members').select(CONTACT_COLS).eq('id', m.id).maybeSingle();
    if (c) {
      contact = { email: c.email || null, mobile: c.mobile || null };
      await logActivity({ member: amb, universityId: scope.universityId, action: 'CONTACT_VIEWED',
        target: m.id, ip: clientIp(req) });
    }
  }

  await logActivity({ member: amb, universityId: scope.universityId, action: 'MEMBER_VIEWED',
    target: m.id, ip: clientIp(req) });

  return ok({
    member: {
      ...toDirectoryRow(m, { followup: fu?.status || 'none', campusName: camp?.name || null }),
      university: uni?.name || null,
    },
    contact,
    contact_permitted: !!contact,
    followup_updated_at: fu?.updated_at || null,
    notes: notes || [],
  });
}

/* POST — record coordination.
 *   { u, action: 'followup', status }   set the follow-up status
 *   { u, action: 'note', body }         add an internal note
 *
 * These are the ONLY writes an ambassador can make about a member, and both
 * land in coordination tables. Nothing here can touch membership_members:
 * no name, no status, no membership ID, no university. A correction to the
 * record itself goes to an administrator as a request. */
export async function POST(req, props) {
  const { id } = await props.params;
  const b = await readJson(req);
  const { member: amb, scope, res } = await requireUniversityAmbassador(req, b.u);
  if (res) return res;

  const sb = supabaseAdmin();
  const m = await loadInScope(sb, scope, id);
  if (!m) return notFound();
  const ip = clientIp(req);

  if (b.action === 'followup') {
    if (!FOLLOWUP_KEYS.includes(b.status))
      return fail('BAD_STATUS', 400, { message: 'Unknown follow-up status.' });

    const { data: prev } = await sb.from('university_member_followups').select('status')
      .eq('university_id', scope.universityId).eq('member_id', m.id).maybeSingle();

    const { error } = await sb.from('university_member_followups').upsert({
      university_id: scope.universityId, member_id: m.id, status: b.status,
      updated_by: amb.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'university_id,member_id' });
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save the follow-up.' });

    await logActivity({ member: amb, universityId: scope.universityId, action: 'FOLLOWUP_SET',
      target: m.id, detail: { from: prev?.status || 'none', to: b.status }, ip });
    return ok({ status: b.status, label: followupLabel(b.status) });
  }

  if (b.action === 'note') {
    const body = String(b.body || '').trim();
    if (!body) return fail('NOTE_EMPTY', 400, { message: 'Write something first.' });
    if (body.length > 2000) return fail('NOTE_TOO_LONG', 400, { message: 'Keep notes under 2,000 characters.' });

    const { data: note, error } = await sb.from('university_member_notes').insert({
      university_id: scope.universityId, member_id: m.id,
      author_id: amb.id, author_name: amb.full_name, body,
    }).select('id, author_name, body, created_at').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save the note.' });

    /* The activity log records THAT a note was written, not what it said —
       the note itself is already stored, and copying it into a second table
       would double the places a private remark lives. */
    await logActivity({ member: amb, universityId: scope.universityId, action: 'NOTE_ADDED',
      target: m.id, detail: { length: body.length }, ip });
    return ok({ note });
  }

  return fail('BAD_ACTION', 400, { message: 'Unknown action.' });
}
