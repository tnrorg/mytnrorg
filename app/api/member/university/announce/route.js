import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { requireUniversityAmbassador, scopedMembers, logActivity } from '@/lib/university/access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* University announcements, delivered through the portal's existing
 * notification system (membership_notifications) — the same bell every member
 * already has. No new channel, no email, no SMS.
 *
 * Limited to DAILY_LIMIT per ambassador per 24 hours. An ambassador can reach
 * hundreds of people with one click, and the notification bell is only useful
 * while members still read it; a limit is what keeps one enthusiastic sender
 * from teaching an entire university to ignore it. */
const DAILY_LIMIT = 3;
const TITLE_MAX = 120;
const BODY_MAX = 1000;

// GET — this ambassador's recent announcements, for the history list.
export async function GET(req) {
  const u = new URL(req.url).searchParams.get('u');
  const { member, scope, res } = await requireUniversityAmbassador(req, u);
  if (res) return res;

  const { data } = await supabaseAdmin().from('university_ambassador_activity')
    .select('detail, created_at')
    .eq('ambassador_id', member.id).eq('university_id', scope.universityId)
    .eq('action', 'ANNOUNCEMENT_SENT')
    .order('created_at', { ascending: false }).limit(20);

  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await supabaseAdmin().from('university_ambassador_activity')
    .select('id', { count: 'exact', head: true })
    .eq('ambassador_id', member.id).eq('action', 'ANNOUNCEMENT_SENT').gte('created_at', since);

  return ok({
    history: (data || []).map(r => ({
      title: r.detail?.title, recipients: r.detail?.recipients, sent_at: r.created_at })),
    remaining_today: Math.max(0, DAILY_LIMIT - (count || 0)),
    limit: DAILY_LIMIT,
  });
}

// POST — send one announcement to every member in scope.
export async function POST(req) {
  const b = await readJson(req);
  const { member, scope, universities, res } = await requireUniversityAmbassador(req, b.u);
  if (res) return res;

  const title = String(b.title || '').trim().replace(/\s+/g, ' ');
  const body = String(b.body || '').trim();
  if (title.length < 3) return fail('TITLE_REQUIRED', 400, { message: 'Add a short title.' });
  if (title.length > TITLE_MAX) return fail('TITLE_TOO_LONG', 400, { message: `Keep the title under ${TITLE_MAX} characters.` });
  if (body.length < 5) return fail('BODY_REQUIRED', 400, { message: 'Write the announcement.' });
  if (body.length > BODY_MAX) return fail('BODY_TOO_LONG', 400, { message: `Keep it under ${BODY_MAX} characters.` });

  const sb = supabaseAdmin();

  // Rate limit, counted across ALL the ambassador's universities.
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await sb.from('university_ambassador_activity')
    .select('id', { count: 'exact', head: true })
    .eq('ambassador_id', member.id).eq('action', 'ANNOUNCEMENT_SENT').gte('created_at', since);
  if ((count || 0) >= DAILY_LIMIT) {
    return fail('RATE_LIMITED', 429, {
      message: `You can send ${DAILY_LIMIT} announcements in 24 hours. Please try again later.` });
  }

  const { data: rows, error } = await scopedMembers(sb, scope, 'id').limit(10000);
  if (error) return fail('LOAD_FAILED', 500, { message: 'Could not load recipients.' });

  // Not to themselves — they wrote it.
  const recipients = (rows || []).map(r => r.id).filter(id => id !== member.id);
  if (!recipients.length) return fail('NO_RECIPIENTS', 400, { message: 'There are no members to send this to yet.' });

  /* Signed. Members are told who sent it and in what capacity, so an
     announcement can never pass itself off as coming from the TNR
     administration. */
  const uniName = universities.find(x => x.id === scope.universityId)?.name || 'your university';
  const signed = `${body}\n\n— ${member.full_name}, University Ambassador, ${uniName}`;

  // Inserted in chunks so a large university is not one oversized request.
  let delivered = 0;
  for (let i = 0; i < recipients.length; i += 500) {
    const chunk = recipients.slice(i, i + 500).map(id => ({
      member_id: id, title, body: signed, category: 'university',
    }));
    const { error: insErr } = await sb.from('membership_notifications').insert(chunk);
    if (!insErr) delivered += chunk.length;
  }

  await logActivity({
    member, universityId: scope.universityId, action: 'ANNOUNCEMENT_SENT',
    detail: { title, recipients: delivered, campus_scoped: !!scope.campusIds },
    ip: clientIp(req),
  });

  return ok({ delivered });
}
