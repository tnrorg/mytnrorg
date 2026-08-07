// Membership core helpers — server only.
// SINGLE SOURCE OF TRUTH for the member count used everywhere on the site.
import { supabaseAdmin } from '@/lib/supabaseServer';

export const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
export const normalizeMobile = (v) => {
  const s = String(v || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+')) return s;
  if (s.startsWith('00')) return '+' + s.slice(2);
  if (s.startsWith('0')) return '+92' + s.slice(1);      // default country code
  if (s.startsWith('92')) return '+' + s;
  return s ? '+' + s : '';
};
export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

// ── THE centralized active-member count. Never hardcode a total anywhere. ──
export async function getActiveMemberCount() {
  const { count } = await supabaseAdmin()
    .from('membership_members')
    .select('*', { count: 'exact', head: true })
    .in('status', ['approved', 'active'])
    .is('deleted_at', null);
  return count || 0;
}

export async function getMembershipStats() {
  const sb = supabaseAdmin();
  const [members, apps] = await Promise.all([
    sb.from('membership_members').select('status, union_council, public_visible, deleted_at'),
    sb.from('membership_applications').select('status'),
  ]);
  const m = (members.data || []).filter(x => !x.deleted_at);
  const a = apps.data || [];
  const by = (rows, key) => rows.reduce((o, r) => { const k = r[key] || 'Unspecified'; o[k] = (o[k] || 0) + 1; return o; }, {});
  return {
    active_members:    m.filter(x => ['approved', 'active'].includes(x.status)).length,
    suspended:         m.filter(x => x.status === 'suspended').length,
    inactive:          m.filter(x => x.status === 'inactive').length,
    expired:           m.filter(x => x.status === 'expired').length,
    // Public by default: everyone approved is listed unless an admin has
    // explicitly hidden them.
    public_profiles:   m.filter(x => x.public_visible !== false && ['approved', 'active'].includes(x.status)).length,
    total_applications: a.length,
    pending_review:    a.filter(x => x.status === 'pending_review').length,
    under_review:      a.filter(x => x.status === 'under_review').length,
    approved_apps:     a.filter(x => x.status === 'approved').length,
    rejected:          a.filter(x => x.status === 'rejected').length,
    by_union_council:  by(m.filter(x => ['approved', 'active'].includes(x.status)), 'union_council'),
  };
}

// ── Server-side reference generation (never on the client) ──
async function nextSeq(seqName) {
  const { data, error } = await supabaseAdmin().rpc('nextval_text', { seq_name: seqName });
  if (error || data == null) return null;
  return Number(data);
}

/**
 * The reference an applicant is given on submission — and the membership
 * number they keep if approved. ONE series, TNR-MN-0001 upward.
 *
 * It was briefly split into a separate TNR-APP series so a rejected
 * application would not consume a membership number. That kept the membership
 * register gapless, but it meant an applicant was quoted one number on
 * submission and issued a different one on approval, which is confusing for
 * everybody and makes support enquiries hard to trace. A gap where an
 * application was rejected is the cheaper problem, so the single series wins.
 *
 * The number is drawn from `membership_id_seq`, and approval reuses the
 * reference already on the application rather than drawing a second one.
 */
export async function generateApplicationRef() {
  return generateMembershipId();
}

// Draws the next TNR-MN number. Called once per application, at submission —
// approval reuses that same number rather than calling this again.
// A failed submission never touches it: the row is inserted with a placeholder
// first, and the number is only drawn once the insert has succeeded.
//
// To restart after clearing test data — MINVALUE is 1, so 0 is rejected:
//   select setval('membership_id_seq', 1, false);
export async function generateMembershipId() {
  const sb = supabaseAdmin();

  // Skip forward over numbers already in use.
  //
  // A sequence can fall behind the data — resetting it after clearing test
  // records, or restoring a backup, leaves it pointing at numbers that already
  // exist. It then hands out a duplicate and the insert fails with a unique
  // violation the applicant sees as "could not submit". Checking costs one
  // cheap indexed lookup per attempt and removes a whole class of outage.
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = await nextSeq('membership_id_seq');
    if (n == null) break;
    const candidate = `TNR-MN-${String(n).padStart(4, '0')}`;

    const [{ data: m }, { data: a }] = await Promise.all([
      sb.from('membership_members').select('id').eq('membership_id', candidate).limit(1),
      sb.from('membership_applications').select('id').eq('reference_no', candidate).limit(1),
    ]);
    if (!m?.length && !a?.length) return candidate;
  }

  // Sequence unavailable, or 50 consecutive numbers were taken. A timestamp is
  // ugly but unique, and issuing an odd-looking number beats losing the
  // application entirely.
  return `TNR-MN-${Date.now() % 1000000}`;
}

export async function logMembershipAudit(entry) {
  try { await supabaseAdmin().from('membership_audit_logs').insert(entry); } catch {}
}
