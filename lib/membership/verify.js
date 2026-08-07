// Public verification helpers — server only.
// Returns ONLY the fields a stranger is allowed to see. Never email,
// mobile, address, documents, application answers or admin notes.
import { supabaseAdmin } from '@/lib/supabaseServer';

export const VERIFY_STATES = {
  active: 'Verified and Active', approved: 'Verified and Active',
  suspended: 'Suspended', inactive: 'Inactive', expired: 'Expired',
};

export function publicView(m, cert) {
  const state = VERIFY_STATES[m.status] || 'Not Found';
  const valid = ['approved', 'active'].includes(m.status);
  return {
    found: true,
    valid,
    state,
    membership_id: m.membership_id,
    full_name: m.full_name,
    // Photo only when the member has allowed public visibility.
    // Hidden only when an admin has explicitly withheld the member.
    photo_url: m.public_visible === false ? null : (m.photo_url || null),
    category: m.category_name || null,
    village: m.village || null,
    union_council: m.union_council || null,
    issued_at: m.issued_at || m.approved_at || null,
    expires_at: m.expires_at || null,
    certificate_no: cert?.certificate_no || null,
    certificate_revoked: cert ? !!cert.revoked_at : false,
  };
}

export async function findForVerification(lookup) {
  const sb = supabaseAdmin();
  const q = String(lookup || '').trim().toUpperCase();
  if (!q) return null;

  // Certificate number → member
  if (q.includes('CERT')) {
    const { data: cert } = await sb.from('membership_certificates')
      .select('*').eq('certificate_no', q).maybeSingle();
    if (!cert) return null;
    const { data: m } = await sb.from('membership_members')
      .select('*').eq('id', cert.member_id).is('deleted_at', null).maybeSingle();
    return m ? { member: m, cert } : null;
  }

  // Membership ID
  const { data: m } = await sb.from('membership_members')
    .select('*').eq('membership_id', q).is('deleted_at', null).maybeSingle();
  if (!m) return null;
  const { data: cert } = await sb.from('membership_certificates')
    .select('*').eq('member_id', m.id).eq('type', 'membership')
    .order('issued_at', { ascending: false }).limit(1).maybeSingle();
  return { member: m, cert };
}

export async function generateCertificateNo() {
  const year = new Date().getFullYear();
  let seq = null;
  try {
    const { data } = await supabaseAdmin().rpc('nextval_text', { seq_name: 'membership_cert_seq' });
    if (data != null) seq = Number(data);
  } catch {}
  // Fallback must be random, not time-based: two requests in the same second
  // would otherwise generate the identical number and collide.
  if (seq == null || Number.isNaN(seq)) seq = Math.floor(Math.random() * 900000) + 100000;
  return `TNR-CERT-${year}-${String(seq).padStart(6, '0')}`;
}
