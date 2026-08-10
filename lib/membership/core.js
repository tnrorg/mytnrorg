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

const ACTIVE_MEMBER_STATUSES = ['approved', 'active'];

/* Tally members per Union Council.
 *
 * This is the one figure that genuinely needs rows rather than a count, since
 * it groups. Supabase returns at most 1000 rows per request, so it is read in
 * pages until a short page arrives — without that the chart would simply stop
 * growing at a thousand members and look like a plateau in recruitment.
 */
async function unionCouncilTally(sb) {
  const PAGE = 1000;
  const tally = {};
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('membership_members')
      .select('union_council')
      .is('deleted_at', null)
      .in('status', ACTIVE_MEMBER_STATUSES)
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[membership stats] union council tally failed:', error.message);
      break;
    }
    if (!data?.length) break;
    for (const r of data) {
      const k = r.union_council || 'Unspecified';
      tally[k] = (tally[k] || 0) + 1;
    }
    if (data.length < PAGE) break;      // last page
  }
  return tally;
}

/* Dashboard figures.
 *
 * Counted BY THE DATABASE, not in JavaScript.
 *
 * This previously selected every member row and every application row and
 * counted them here with .filter().length. Supabase caps a request at 1000
 * rows, so past a thousand members every one of these numbers would quietly
 * stop rising — no error, no warning, just a dashboard that says growth
 * stopped. For a membership organisation that intends to grow, a wrong number
 * that reports itself as fine is worse than a broken page.
 *
 * `head: true` sends no rows at all: the answer is a count in a header. That
 * also stops shipping every member's status across the wire to produce six
 * integers.
 */
export async function getMembershipStats() {
  const sb = supabaseAdmin();

  const members = (apply) => {
    const q = sb.from('membership_members')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);
    return apply ? apply(q) : q;
  };
  const apps = (apply) => {
    const q = sb.from('membership_applications')
      .select('id', { count: 'exact', head: true });
    return apply ? apply(q) : q;
  };

  const [
    active, suspended, inactive, expired, publicProfiles,
    totalApps, pending, under, approvedApps, rejected,
    byCouncil,
  ] = await Promise.all([
    members(q => q.in('status', ACTIVE_MEMBER_STATUSES)),
    members(q => q.eq('status', 'suspended')),
    members(q => q.eq('status', 'inactive')),
    members(q => q.eq('status', 'expired')),
    // Public by default: everyone approved is listed unless an admin has
    // explicitly hidden them. `not is false` keeps NULL counted as visible.
    members(q => q.in('status', ACTIVE_MEMBER_STATUSES).not('public_visible', 'is', false)),
    apps(),
    apps(q => q.eq('status', 'pending_review')),
    apps(q => q.eq('status', 'under_review')),
    apps(q => q.eq('status', 'approved')),
    apps(q => q.eq('status', 'rejected')),
    unionCouncilTally(sb),
  ]);

  // A failed count must not silently read as zero — a dashboard showing 0
  // members looks like a catastrophe, and looks identical to a broken query.
  const n = (res, label) => {
    if (res?.error) console.error(`[membership stats] ${label} failed:`, res.error.message);
    return res?.count ?? 0;
  };

  return {
    active_members:     n(active, 'active_members'),
    suspended:          n(suspended, 'suspended'),
    inactive:           n(inactive, 'inactive'),
    expired:            n(expired, 'expired'),
    public_profiles:    n(publicProfiles, 'public_profiles'),
    total_applications: n(totalApps, 'total_applications'),
    pending_review:     n(pending, 'pending_review'),
    under_review:       n(under, 'under_review'),
    approved_apps:      n(approvedApps, 'approved_apps'),
    rejected:           n(rejected, 'rejected'),
    by_union_council:   byCouncil,
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
