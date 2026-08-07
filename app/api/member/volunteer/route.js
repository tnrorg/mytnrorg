import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const [{ data: opps }, { data: mine }, { data: hours }] = await Promise.all([
    sb.from('volunteer_opportunities').select('*').eq('status', 'published').order('created_at', { ascending: false }),
    sb.from('volunteer_assignments').select('*').eq('member_id', member.id),
    sb.from('volunteer_hours').select('hours').eq('member_id', member.id),
  ]);
  const map = Object.fromEntries((mine || []).map(a => [a.volunteer_opportunity_id, a]));
  return ok({
    opportunities: (opps || []).map(o => ({ ...o, assignment: map[o.id] || null })),
    assignments: mine || [],
    total_hours: (hours || []).reduce((s, h) => s + Number(h.hours || 0), 0),
  });
}

// Apply for a volunteer role.
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  await supabaseAdmin().from('volunteer_assignments').upsert({
    volunteer_opportunity_id: b.volunteer_opportunity_id, member_id: member.id, status: 'applied',
  }, { onConflict: 'volunteer_opportunity_id,member_id' });
  return ok({ applied: true });
}
