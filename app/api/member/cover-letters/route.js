import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const { data } = await supabaseAdmin().from('cover_letters')
    .select('id, title, target_position, company, updated_at')
    .eq('member_id', member.id).order('updated_at', { ascending: false });
  return ok({ letters: data || [] });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const { data, error } = await supabaseAdmin().from('cover_letters').insert({
    member_id: member.id,
    title: String(b.title || 'Cover Letter').slice(0, 120),
    template: b.template || 'professional',
    cv_id: b.cv_id || null,
    sign_off: 'Sincerely',
  }).select('*').single();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not create the letter.', detail: error.message });
  return ok({ letter: data });
}
