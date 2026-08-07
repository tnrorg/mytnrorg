import { supabaseAdmin } from './supabaseServer';
export async function logAudit({ action, actor = 'system', details = '', election_id = null, ip = null }) {
  try {
    await supabaseAdmin().from('audit_logs').insert({ action, actor, details, election_id, ip_address: ip });
  } catch (e) { console.error('audit log failed:', e.message); }
}
export function clientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || null;
}
