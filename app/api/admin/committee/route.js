import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const { data } = await supabaseAdmin().from('committee_members').select('*').order('sort_order').order('created_at');
  return ok({ members: data || [] });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  if (!b.full_name) return fail('MISSING', 400, { message: 'Name is required.' });
  let photo_url = b.photo_url || null;
  if (b.photo_data) { try { photo_url = await uploadDataUrl(b.photo_data, 'committee'); } catch (e) { console.error('committee photo upload failed:', e.message); photo_url = null; } }
  const row = {
    full_name: b.full_name, role: b.role || null, photo_url,
    phone: b.phone || null, email: b.email || null, bio: b.bio || null,
    sort_order: Number(b.sort_order) || 0, active: b.active !== false,
  };
  const { data, error } = await sb.from('committee_members').insert(row).select().maybeSingle();
  if (error) return fail('INSERT_FAILED', 500, { message: error.message });
  await logAudit({ action: 'COMMITTEE_MEMBER_ADDED', actor: admin.username, details: b.full_name, ip: clientIp(req) });
  return ok({ member: data });
}
