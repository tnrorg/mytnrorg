import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Thread — ownership enforced, internal admin notes never returned.
export async function GET(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('support_tickets')
    .select('*').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!t) return fail('NOT_FOUND', 404, { message: 'Ticket not found.' });

  const { data: msgs } = await sb.from('support_messages')
    .select('*').eq('ticket_id', t.id).eq('internal', false).order('created_at');
  return ok({ ticket: t, messages: msgs || [] });
}

// Reply or close.
export async function POST(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();
  const { data: t } = await sb.from('support_tickets')
    .select('id').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!t) return fail('NOT_FOUND', 404, { message: 'Ticket not found.' });

  if (b.action === 'close') {
    await sb.from('support_tickets').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', t.id);
    return ok({ closed: true });
  }
  const message = String(b.message || '').trim();
  if (!message) return fail('INVALID', 400, { message: 'Message is required.' });
  await sb.from('support_messages').insert({
    ticket_id: t.id, sender: 'member', sender_name: member.full_name, message,
  });
  await sb.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', t.id);
  return ok({ sent: true });
}
