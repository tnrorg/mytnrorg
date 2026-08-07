import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { normalizePhone } from '@/lib/phone';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const union  = url.searchParams.get('union') || '';
  let q = sb.from('members').select('*').order('created_at', { ascending: false }).limit(2000);
  if (status) q = q.eq('status', status);
  if (union)  q = q.eq('union_id', Number(union));
  if (search) q = q.or(`full_name.ilike.%${search}%,mobile.ilike.%${search}%,cnic.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) return fail('QUERY_FAILED', 500, { message: error.message });
  return ok({ members: data || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  if (!b.full_name || !b.mobile) return fail('MISSING', 400, { message: 'Full name and mobile are required.' });
  const row = {
    full_name: b.full_name, member_code: b.member_code || null, father_name: b.father_name || null, cnic: b.cnic || null,
    mobile: normalizePhone(b.mobile), whatsapp: b.whatsapp ? normalizePhone(b.whatsapp) : null,
    email: b.email || null, village: b.village || null, union_id: b.union_id || null,
    gender: b.gender || null, status: b.status || 'Pending',
  };
  const { data, error } = await sb.from('members').insert(row).select().maybeSingle();
  if (error) {
    if (error.code === '23505') return fail('DUPLICATE', 409, { message: 'A member with this mobile number already exists.' });
    return fail('INSERT_FAILED', 500, { message: error.message });
  }
  await logAudit({ action: 'MEMBER_ADDED', actor: admin.username, details: `${row.full_name} (${row.mobile})`, ip: clientIp(req) });
  return ok({ member: data });
}
