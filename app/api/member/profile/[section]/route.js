import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { SECTIONS, ALLOWED, pick } from '@/lib/membership/profile';

export const dynamic = 'force-dynamic';

const resolve = (section) => SECTIONS[section] ? { table: SECTIONS[section].table, allow: ALLOWED[section] } : null;

// POST — add a row to a repeatable section.
export async function POST(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const cfg = resolve(params.section);
  if (!cfg) return fail('BAD_SECTION', 400, { message: 'Unknown profile section.' });

  const b = await readJson(req);
  const row = { ...pick(b, cfg.allow), member_id: member.id };   // member_id forced from the token
  const { data, error } = await supabaseAdmin().from(cfg.table).insert(row).select('*').single();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });
  return ok({ item: data });
}

// PATCH — edit one row. IDOR-safe: the update is scoped to this member's id.
export async function PATCH(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const cfg = resolve(params.section);
  if (!cfg) return fail('BAD_SECTION', 400, { message: 'Unknown profile section.' });

  const b = await readJson(req);
  if (!b.id) return fail('INVALID', 400, { message: 'Missing record id.' });

  const { data, error } = await supabaseAdmin().from(cfg.table)
    .update(pick(b, cfg.allow))
    .eq('id', b.id).eq('member_id', member.id)     // ← ownership enforced here
    .select('*').maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Record not found.' });
  return ok({ item: data });
}

// DELETE — remove one row, again scoped to the owner.
export async function DELETE(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const cfg = resolve(params.section);
  if (!cfg) return fail('BAD_SECTION', 400, { message: 'Unknown profile section.' });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('INVALID', 400, { message: 'Missing record id.' });

  const { error } = await supabaseAdmin().from(cfg.table)
    .delete().eq('id', id).eq('member_id', member.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete.', detail: error.message });
  return ok({ deleted: true });
}
