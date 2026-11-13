import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { requireUniversityAmbassador, scopedMembers, logActivity } from '@/lib/university/access';
import { memberInScope, REQUEST_KEYS } from '@/lib/university/scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Requests from an ambassador to the TNR administration — "this member's name
 * is misspelt", "this person has moved to another campus", "this member needs
 * help with X".
 *
 * This is how an ambassador gets a record CHANGED: they ask, an administrator
 * decides and acts. The ambassador never edits a member record themselves. */

// GET — this ambassador's own requests and their replies.
export async function GET(req) {
  const u = new URL(req.url).searchParams.get('u');
  const { member, scope, res } = await requireUniversityAmbassador(req, u);
  if (res) return res;

  const { data } = await supabaseAdmin().from('university_ambassador_requests')
    .select('id, kind, subject, message, status, admin_reply, handled_at, created_at, member_id')
    .eq('ambassador_id', member.id).eq('university_id', scope.universityId)
    .order('created_at', { ascending: false }).limit(50);

  return ok({ requests: data || [] });
}

// POST — raise a request, optionally about one member in scope.
export async function POST(req) {
  const b = await readJson(req);
  const { member, scope, res } = await requireUniversityAmbassador(req, b.u);
  if (res) return res;

  const kind = REQUEST_KEYS.includes(b.kind) ? b.kind : 'correction';
  const subject = String(b.subject || '').trim().replace(/\s+/g, ' ');
  const message = String(b.message || '').trim();
  if (subject.length < 3 || subject.length > 160)
    return fail('BAD_SUBJECT', 400, { message: 'The subject should be 3 to 160 characters.' });
  if (message.length < 5 || message.length > 3000)
    return fail('BAD_MESSAGE', 400, { message: 'Describe the request in 5 to 3,000 characters.' });

  const sb = supabaseAdmin();

  /* A request may only name a member this ambassador can already see — so it
     cannot be used to attach a remark to someone at another university. */
  let memberId = null;
  if (b.member_id) {
    if (!UUID.test(String(b.member_id))) return fail('BAD_MEMBER', 400, { message: 'Unknown member.' });
    const { data: m } = await scopedMembers(sb, scope).eq('id', b.member_id).maybeSingle();
    if (!m || !memberInScope(m, scope))
      return fail('NOT_FOUND', 404, { message: 'Member not found in your university.' });
    memberId = m.id;
  }

  // Ten open requests at a time is plenty, and stops a flood of the admin queue.
  const { count } = await sb.from('university_ambassador_requests')
    .select('id', { count: 'exact', head: true })
    .eq('ambassador_id', member.id).in('status', ['open', 'in_progress']);
  if ((count || 0) >= 10) return fail('TOO_MANY_OPEN', 429, {
    message: 'You have 10 open requests. Please wait for some to be answered.' });

  const { data: r, error } = await sb.from('university_ambassador_requests').insert({
    ambassador_id: member.id, ambassador_name: member.full_name,
    university_id: scope.universityId, member_id: memberId,
    kind, subject, message,
  }).select('id, kind, subject, status, created_at').single();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not send the request.' });

  await logActivity({ member, universityId: scope.universityId, action: 'REQUEST_RAISED',
    target: memberId, detail: { request_id: r.id, kind }, ip: clientIp(req) });

  return ok({ request: r });
}
