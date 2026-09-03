import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
const FIELDS = ['title','template','cv_id','target_position','company','hiring_manager',
  'company_address','job_description','relevant_skills','relevant_experience',
  'opening','body','closing','sign_off'];

export async function GET(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const { data } = await supabaseAdmin().from('cover_letters')
    .select('*').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!data) return fail('NOT_FOUND', 404, { message: 'Letter not found.' });
  return ok({ letter: data });
}

export async function PATCH(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };
  FIELDS.forEach(f => { if (b[f] !== undefined) patch[f] = b[f]; });
  const { data, error } = await supabaseAdmin().from('cover_letters')
    .update(patch).eq('id', params.id).eq('member_id', member.id).select('*').maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.' });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Letter not found.' });
  return ok({ letter: data });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  await supabaseAdmin().from('cover_letters').delete().eq('id', params.id).eq('member_id', member.id);
  return ok({ deleted: true });
}

export async function POST(req, props) {
  const params = await props.params;
  // duplicate
  const { member, res } = await requireMember(req);if (res) return res;
  const sb = supabaseAdmin();
  const { data: src } = await sb.from('cover_letters')
    .select('*').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!src) return fail('NOT_FOUND', 404, { message: 'Letter not found.' });
  const { id, created_at, updated_at, ...copy } = src;
  const { data } = await sb.from('cover_letters')
    .insert({ ...copy, title: `${src.title} (copy)` }).select('*').single();
  return ok({ letter: data });
}
