import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { normalizePhone } from '@/lib/phone';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { rows, default_status } = await readJson(req);
  if (!Array.isArray(rows) || !rows.length) return fail('NO_ROWS', 400, { message: 'No rows to import.' });

  const { data: unions } = await sb.from('unions').select('id, union_name, union_code');
  const unionByName = {};
  (unions || []).forEach(u => { unionByName[(u.union_name || '').toLowerCase()] = u.id; unionByName[(u.union_code || '').toLowerCase()] = u.id; });

  const pick = (r, keys) => {
    for (const k of keys) {
      const hit = Object.keys(r).find(x => x.toLowerCase().trim() === k);
      if (hit && r[hit] != null && String(r[hit]).trim() !== '') return String(r[hit]).trim();
    }
    return null;
  };
  const forcedStatus = ['Approved', 'Pending', 'Blocked'].includes(default_status) ? default_status : null;

  let inserted = 0, skipped = 0;
  const errors = [];
  const prepared = [];
  for (const r of rows) {
    const full_name = pick(r, ['full name', 'name', 'fullname', 'member name']);
    const mobile = pick(r, ['mobile', 'mobile number', 'phone', 'registered mobile number', 'mobile/whatsapp number', 'mobile / whatsapp number', 'contact', 'contact number']);
    if (!full_name || !mobile) { skipped++; continue; }
    const uref = (pick(r, ['union', 'union council']) || '').toLowerCase();
    const waRaw = pick(r, ['whatsapp', 'whatsapp number']);
    const normMobile = normalizePhone(mobile);
    prepared.push({
      full_name,
      member_code: pick(r, ['tnr-mn', 'tnr mn', 'member code', 'member no', 'member id', 'code', 'id']),
      father_name: pick(r, ['father name', 'father']),
      cnic: pick(r, ['cnic', 'cnic/id', 'id card', 'nic']),
      mobile: normMobile,
      whatsapp: waRaw ? normalizePhone(waRaw) : normMobile,
      email: pick(r, ['email', 'email address', 'e-mail']),
      village: pick(r, ['village', 'area', 'village/area']),
      union_id: unionByName[uref] || null,
      gender: pick(r, ['gender']),
      status: forcedStatus || pick(r, ['status']) || 'Pending',
    });
  }

  for (const row of prepared) {
    const { error } = await sb.from('members').insert(row);
    if (error) {
      if (error.code === '23505') skipped++;
      else { errors.push(row.mobile + ': ' + error.message); skipped++; }
    } else inserted++;
  }
  await logAudit({ action: 'MEMBERS_IMPORTED', actor: admin.username, details: inserted + ' added, ' + skipped + ' skipped' + (forcedStatus ? ' as ' + forcedStatus : ''), ip: clientIp(req) });
  return ok({ inserted, skipped, errors: errors.slice(0, 20) });
}
