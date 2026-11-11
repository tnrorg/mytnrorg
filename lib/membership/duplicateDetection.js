import { supabaseAdmin } from '@/lib/supabaseServer';
import { compareRecords, ageFromDob, THRESHOLDS, DETECTION_VERSION } from './duplicateMatch';

/* ── Duplicate detection — server side only ──────────────────────────────────
 *
 * SERVER ONLY. This module imports supabaseAdmin, which carries the
 * service-role key, so importing it from a client component would ship that
 * key to the browser. Nothing here may be imported by anything under
 * components/.
 *
 * What it does: given one record, compare it against the existing roll and
 * store a flag for every pair that scores high enough to deserve a human
 * glance. It does not decide anything. It never writes to
 * membership_applications or membership_members.
 */

/* Fields selected explicitly, never `*`.
 *
 * Two reasons. One, PostgREST rejects the WHOLE query if a single named column
 * is missing, so an explicit list fails loudly on a database that has not run
 * its migrations instead of silently comparing undefined against undefined and
 * reporting everyone as unique. Two, this is the data-minimisation boundary:
 * the comparison needs seven fields, so it is handed seven fields, and a
 * mobile number or a photo path cannot leak out of a layer that never loaded
 * one. */
const MEMBER_COLS =
  'id, membership_id, full_name, village, union_council, education_level, ' +
  'field_of_study, current_position, application_id, status';

const APP_COLS =
  'id, reference_no, full_name, village, union_council, age, date_of_birth, ' +
  'education_level, field_of_study, current_position, organization_name, status';

/* Applications that still represent a live claim on a membership. A rejected
 * or withdrawn application is not a duplicate of anything. */
const LIVE_APP = ['pending_review', 'under_review', 'correction_requested', 'approved'];

/* Beyond this many records we stop comparing and say so.
 *
 * The comparison is every-record-against-the-new-one, which is linear and fine
 * for a community of this size — but it runs inside a registration request, so
 * it needs a ceiling it will reach loudly rather than by timing out. If TNR
 * ever passes this, the fix is a blocking key (compare only within a village,
 * or only where a name token matches) rather than a bigger number. */
const SCAN_CAP = 20000;

/** One record, reduced to just the comparable fields. */
function subjectFromMember(m, app) {
  return {
    kind: 'member',
    id: m.id,
    label: m.membership_id,
    full_name: m.full_name,
    village: m.village,
    union_council: m.union_council,
    /* Members carry neither an age nor a university of their own — both live
       on the application they were approved from, so this reaches through
       `application_id`. A member with no linked application (an older record,
       or one created by hand) simply has fewer comparable fields, which the
       engine's coverage figure then reports rather than hides. */
    age: app ? (app.age ?? ageFromDob(app.date_of_birth)) : null,
    university: app?.organization_name || null,
    education: m.education_level,
    profession: m.field_of_study || m.current_position,
  };
}

function subjectFromApplication(a) {
  return {
    kind: 'application',
    id: a.id,
    label: a.reference_no,
    full_name: a.full_name,
    village: a.village,
    union_council: a.union_council,
    age: a.age ?? ageFromDob(a.date_of_birth),
    university: a.organization_name || null,
    education: a.education_level,
    profession: a.field_of_study || a.current_position,
  };
}

/* Stable key for a pair, independent of which side was discovered first, so
 * the unique index can stop the same pair being flagged twice. */
export function pairKey(a, b) {
  const x = `${a.kind}:${a.id}`;
  const y = `${b.kind}:${b.id}`;
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/**
 * Load everything the new record will be compared against.
 * Returns { subjects, truncated }.
 */
async function loadRoll(sb, exclude) {
  const [{ data: members }, { data: apps }] = await Promise.all([
    sb.from('membership_members').select(MEMBER_COLS)
      .is('deleted_at', null).limit(SCAN_CAP),
    sb.from('membership_applications').select(APP_COLS)
      .in('status', LIVE_APP).limit(SCAN_CAP),
  ]);

  const appById = new Map((apps || []).map(a => [a.id, a]));
  const subjects = [];

  for (const m of members || []) {
    if (exclude.kind === 'member' && m.id === exclude.id) continue;
    subjects.push(subjectFromMember(m, m.application_id ? appById.get(m.application_id) : null));
  }
  /* Applications already approved into a member would otherwise appear twice —
     once as the member and once as the application behind it — and the pair
     would flag against itself at 100%. */
  const approvedAppIds = new Set(
    (members || []).map(m => m.application_id).filter(Boolean));

  for (const a of apps || []) {
    if (exclude.kind === 'application' && a.id === exclude.id) continue;
    if (approvedAppIds.has(a.id)) continue;
    subjects.push(subjectFromApplication(a));
  }

  const truncated = (members || []).length >= SCAN_CAP || (apps || []).length >= SCAN_CAP;
  return { subjects, truncated };
}

/**
 * Compare one record against the roll and persist any flags.
 *
 * `kind` is 'application' or 'member'; `id` is its uuid.
 *
 * Returns { checked, flagged, highest, truncated } — COUNTS AND A SCORE, never
 * the matched people. The caller decides who is allowed to see detail, and the
 * public registration route is not allowed to see any.
 *
 * Never throws. Detection failing must not fail a registration: somebody
 * joining TNR should not be turned away because a background comparison hit a
 * missing table.
 */
export async function runDuplicateCheck({ kind, id }) {
  const empty = { checked: 0, flagged: 0, highest: 0, truncated: false, ok: false };
  if (!kind || !id) return empty;

  try {
    const sb = supabaseAdmin();

    let subject = null;
    if (kind === 'member') {
      const { data: m } = await sb.from('membership_members')
        .select(MEMBER_COLS).eq('id', id).maybeSingle();
      if (!m) return empty;
      const { data: app } = m.application_id
        ? await sb.from('membership_applications').select(APP_COLS).eq('id', m.application_id).maybeSingle()
        : { data: null };
      subject = subjectFromMember(m, app);
    } else {
      const { data: a } = await sb.from('membership_applications')
        .select(APP_COLS).eq('id', id).maybeSingle();
      if (!a) return empty;
      subject = subjectFromApplication(a);
    }

    const { subjects, truncated } = await loadRoll(sb, { kind, id });

    const rows = [];
    let highest = 0;
    for (const other of subjects) {
      const r = compareRecords(subject, other);
      if (r.score > highest) highest = r.score;
      if (r.risk === 'low') continue;
      rows.push({
        left_kind: subject.kind, left_id: subject.id,
        right_kind: other.kind, right_id: other.id,
        pair_key: pairKey(subject, other),
        score: r.score, risk: r.risk, coverage: r.coverage,
        name_similarity: r.nameSimilarity,
        reasons: r.reasons,
        detector_version: DETECTION_VERSION,
      });
    }

    if (rows.length) {
      /* onConflict on pair_key with ignoreDuplicates: re-running detection must
         not reopen a flag an admin has already reviewed, and must not overwrite
         their note with a fresh 'open' row. A changed score on an
         already-judged pair is not worth losing a human decision over. */
      await sb.from('membership_duplicate_flags')
        .upsert(rows, { onConflict: 'pair_key', ignoreDuplicates: true });
    }

    return {
      checked: subjects.length,
      flagged: rows.length,
      highest,
      truncated,
      ok: true,
    };
  } catch {
    /* Swallowed on purpose, and the caller is told nothing happened via
       ok:false. The alternative — letting this propagate — means a fault in
       duplicate detection becomes a failed registration. */
    return empty;
  }
}

/**
 * Highest OPEN flag score for each of many records → Map(id → score).
 *
 * Batched rather than per-record on purpose: this badges a list of up to 500
 * applications, and a per-row lookup would be 500 round trips to decorate one
 * screen. One query, filtered in memory.
 *
 * Only open flags count. A pair an admin has already judged "different people"
 * must stop warning about itself, or the badge trains reviewers to ignore it.
 *
 * Returns an empty Map on any failure — a missing migration or a broken query
 * should cost a badge, never the list it decorates.
 */
export async function openFlagScores(kind, ids) {
  const out = new Map();
  if (!ids?.length) return out;
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from('membership_duplicate_flags')
      .select('score, left_kind, left_id, right_kind, right_id')
      .eq('review_status', 'open');

    const want = new Set(ids);
    for (const f of data || []) {
      for (const [k, id] of [[f.left_kind, f.left_id], [f.right_kind, f.right_id]]) {
        if (k !== kind || !want.has(id)) continue;
        if ((out.get(id) || 0) < f.score) out.set(id, f.score);
      }
    }
  } catch { /* badge is cosmetic */ }
  return out;
}

export { THRESHOLDS };
