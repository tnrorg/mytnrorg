import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const [{ data: events }, { data: regs }] = await Promise.all([
    sb.from('events').select('*').eq('status', 'published').order('starts_at').limit(200),
    sb.from('event_registrations').select('*').eq('member_id', member.id),
  ]);
  const map = Object.fromEntries((regs || []).map(r => [r.event_id, r]));
  return ok({
    events: (events || []).map(e => ({ ...e, registered: !!map[e.id], attended: !!map[e.id]?.attended })),
  });
}

// Register / cancel.
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  if (b.action === 'cancel') {
    await sb.from('event_registrations').delete()
      .eq('member_id', member.id).eq('event_id', b.event_id);
    return ok({ registered: false });
  }

  const { data: ev } = await sb.from('events').select('*').eq('id', b.event_id).maybeSingle();
  if (!ev || ev.status !== 'published') return fail('NOT_FOUND', 404, { message: 'Event not available.' });
  if (ev.registration_deadline && new Date(ev.registration_deadline) < new Date())
    return fail('CLOSED', 400, { message: 'Registration for this event has closed.' });

  if (ev.capacity) {
    const { count } = await sb.from('event_registrations')
      .select('*', { count: 'exact', head: true }).eq('event_id', ev.id);
    if ((count || 0) >= ev.capacity) return fail('FULL', 409, { message: 'This event is full.' });
  }

  const { error } = await sb.from('event_registrations')
    .upsert({ event_id: ev.id, member_id: member.id }, { onConflict: 'event_id,member_id' });
  if (error) return fail('REGISTER_FAILED', 500, { message: 'Could not register.' });
  return ok({ registered: true });
}
