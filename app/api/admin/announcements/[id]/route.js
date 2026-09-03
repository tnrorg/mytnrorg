import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 160;

function cleanHref(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (s.startsWith('/')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };

  if ('text' in b) {
    const text = String(b.text || '').trim();
    if (!text) return fail('INVALID', 400, { message: 'Announcement text is required.' });
    if (text.length > MAX_TEXT)
      return fail('TOO_LONG', 400, { message: `Keep it under ${MAX_TEXT} characters.` });
    patch.text = text;
  }
  if ('href' in b) patch.href = cleanHref(b.href);
  if ('active' in b) patch.active = !!b.active;
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 0;
  if ('starts_at' in b) patch.starts_at = b.starts_at || null;
  if ('ends_at' in b) patch.ends_at = b.ends_at || null;

  const { data, error } = await supabaseAdmin()
    .from('announcements').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });

  await logAudit({ action: 'ANNOUNCEMENT_UPDATED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({ item: data });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
  const { error } = await supabaseAdmin().from('announcements').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'ANNOUNCEMENT_DELETED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({ deleted: true });
}
