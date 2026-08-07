import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const { data } = await supabaseAdmin().from('support_tickets')
    .select('*').eq('member_id', member.id).order('updated_at', { ascending: false });
  return ok({ tickets: data || [] });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const subject = String(b.subject || '').trim();
  const message = String(b.message || '').trim();
  if (!subject || !message) return fail('INVALID', 400, { message: 'Subject and message are required.' });

  const sb = supabaseAdmin();
  const { data: seq } = await sb.rpc('nextval_text', { seq_name: 'support_ticket_seq' });
  const ticket_no = `TNR-SUP-${new Date().getFullYear()}-${String(seq ?? Date.now() % 100000).padStart(5, '0')}`;

  const { data: t, error } = await sb.from('support_tickets').insert({
    member_id: member.id, ticket_no, category: b.category || 'General Inquiry', subject,
  }).select('*').single();
  if (error) return fail('CREATE_FAILED', 500, { message: 'Could not create the ticket.' });

  await sb.from('support_messages').insert({
    ticket_id: t.id, sender: 'member', sender_name: member.full_name, message,
  });
  return ok({ ticket: t });
}
