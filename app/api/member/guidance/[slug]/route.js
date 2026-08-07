import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const MIN_MESSAGE = 20;
const DAILY_LIMIT = 5;   // stops one member flooding the council

// A signed-in TNR member requests guidance from a council member. Nothing here
// exposes contact details in either direction — the council member reviews the
// request in their dashboard and decides whether to engage.
export async function POST(req, { params }) {
  const { member, res } = await requireMember(req);
  if (res) return res;

  const b = await readJson(req);
  const subject = String(b.subject || '').trim();
  const message = String(b.message || '').trim();
  const category = String(b.category || '').trim();

  if (!subject) return fail('INVALID', 400, { message: 'Please add a subject.' });
  if (!category) return fail('INVALID', 400, { message: 'Please choose a category.' });
  if (message.length < MIN_MESSAGE)
    return fail('INVALID', 400, { message: `Please write at least ${MIN_MESSAGE} characters.` });

  const sb = supabaseAdmin();
  const { data: profile } = await sb.from('leadership_profiles')
    .select('id, name, accepts_guidance, active')
    .eq('slug', params.slug).eq('body', 'advisory').maybeSingle();

  if (!profile || !profile.active)
    return fail('NOT_FOUND', 404, { message: 'This council member is not available.' });
  if (!profile.accepts_guidance)
    return fail('CLOSED', 403, { message: 'This member is not accepting guidance requests at the moment.' });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb.from('council_guidance_requests')
    .select('*', { count: 'exact', head: true })
    .eq('membership_id', member.membership_id).gte('created_at', since);
  if ((count || 0) >= DAILY_LIMIT)
    return fail('RATE_LIMITED', 429, {
      message: 'You have reached the daily limit for guidance requests. Please try again tomorrow.' });

  const { error } = await sb.from('council_guidance_requests').insert({
    profile_id: profile.id,
    membership_id: member.membership_id,
    requester_name: member.full_name,
    subject, category, message,
    preferred_contact: b.preferred_contact || null,
    status: 'pending',
  });
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not send your request. Please try again.' });

  return ok({ message: 'Request sent for review.' });
}

// A member's own requests to this council member, so the profile page can show
// "you already have a pending request" rather than inviting a duplicate.
export async function GET(req, { params }) {
  const { member, res } = await requireMember(req);
  if (res) return res;

  const sb = supabaseAdmin();
  const { data: profile } = await sb.from('leadership_profiles')
    .select('id').eq('slug', params.slug).eq('body', 'advisory').maybeSingle();
  if (!profile) return ok({ requests: [] });

  const { data } = await sb.from('council_guidance_requests')
    .select('id, subject, category, status, reply, created_at, replied_at')
    .eq('profile_id', profile.id).eq('membership_id', member.membership_id)
    .order('created_at', { ascending: false });
  return ok({ requests: data || [] });
}
