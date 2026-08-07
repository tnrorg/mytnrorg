import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Published opportunities + this member's saved/applied flags.
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const cat = new URL(req.url).searchParams.get('category') || '';

  let q = sb.from('opportunities').select('*').eq('status', 'published')
    .order('deadline', { ascending: true, nullsFirst: false }).limit(200);
  if (cat) q = q.eq('category', cat);

  const [{ data: opps }, { data: saved }] = await Promise.all([
    q, sb.from('saved_opportunities').select('*').eq('member_id', member.id),
  ]);
  const map = Object.fromEntries((saved || []).map(s => [s.opportunity_id, s]));
  return ok({
    opportunities: (opps || []).map(o => ({ ...o, saved: !!map[o.id], applied: !!map[o.id]?.applied })),
    categories: [...new Set((opps || []).map(o => o.category))].sort(),
  });
}

// Save / unsave / mark applied.
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  if (b.action === 'unsave') {
    await sb.from('saved_opportunities').delete()
      .eq('member_id', member.id).eq('opportunity_id', b.opportunity_id);
    return ok({ saved: false });
  }
  await sb.from('saved_opportunities').upsert({
    member_id: member.id, opportunity_id: b.opportunity_id,
    applied: !!b.applied, notes: b.notes || null,
  }, { onConflict: 'member_id,opportunity_id' });
  return ok({ saved: true, applied: !!b.applied });
}
