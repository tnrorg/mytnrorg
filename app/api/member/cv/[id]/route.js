import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
const FIELDS = ['title', 'template', 'content', 'visible_sections', 'section_order', 'show_photo'];

// Every query is scoped by member_id — a member can only reach their own CVs.
export async function GET(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const { data } = await supabaseAdmin().from('cv_documents')
    .select('*').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!data) return fail('NOT_FOUND', 404, { message: 'CV not found.' });
  return ok({ cv: data });
}

export async function PATCH(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };
  FIELDS.forEach(f => { if (b[f] !== undefined) patch[f] = b[f]; });

  const { data, error } = await supabaseAdmin().from('cv_documents')
    .update(patch).eq('id', params.id).eq('member_id', member.id).select('*').maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'CV not found.' });
  return ok({ cv: data });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const { error } = await supabaseAdmin().from('cv_documents')
    .delete().eq('id', params.id).eq('member_id', member.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete.' });
  return ok({ deleted: true });
}

// POST — duplicate this CV.
export async function POST(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const sb = supabaseAdmin();
  const { data: src } = await sb.from('cv_documents')
    .select('*').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!src) return fail('NOT_FOUND', 404, { message: 'CV not found.' });

  const { id, created_at, updated_at, ...copy } = src;
  const { data, error } = await sb.from('cv_documents')
    .insert({ ...copy, title: `${src.title} (copy)`, is_default: false }).select('*').single();
  if (error) return fail('COPY_FAILED', 500, { message: 'Could not duplicate.' });
  return ok({ cv: data });
}
