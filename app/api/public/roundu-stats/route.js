import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail } from '@/lib/api';
import { ACTIVE_STATUSES } from '@/lib/membershipStats';
import { areaKey, preferredSpelling, canonicalAreaNames } from '@/lib/membership/areaName';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Statistics derived from TNR membership records.
//
// IMPORTANT: these describe TNR's MEMBERS, not the population of Roundu.
// Members are self-selected, so this is not a census and must never be
// presented as one — the page labels every figure accordingly. District-level
// facts (population, literacy rate, tourism, school counts) cannot come from
// here and need an official source.
//
// Aggregate counts only: no names, no contact details, nothing identifying.
export async function GET() {
  const sb = supabaseAdmin();
  try {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('membership_members')
        .select('membership_id, gender, education_level, field_of_study, ' +
                'current_position, contribution_areas, union_council, village')
        .in('status', ACTIVE_STATUSES).is('deleted_at', null)
        .range(from, from + 999);
      if (error) return fail('READ_FAILED', 500, { message: error.message });
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    const total = rows.length;
    const canonical = await canonicalAreaNames(sb);

    /**
     * Count a field, largest first, ignoring blanks.
     *
     * `canon` is the admin-managed spelling for area fields. Without it the
     * label was whichever spelling happened to be read first, so one member
     * typing "hardass" in lower case renamed the village for everyone.
     */
    const tally = (fn, canon) => {
      const m = new Map();
      for (const r of rows) {
        for (const raw of [].concat(fn(r) || [])) {
          const v = String(raw || '').trim();
          if (!v) continue;
          const k = areaKey(v);
          if (!m.has(k)) m.set(k, { label: v, count: 0 });
          const entry = m.get(k);
          entry.label = preferredSpelling(entry.label, v);
          entry.count++;
        }
      }
      return [...m.entries()]
        .map(([k, x]) => ({ ...x, label: canon?.get(k) || x.label }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map(x => ({ ...x, percent: total ? Math.round((x.count / total) * 1000) / 10 : 0 }));
    };

    /** Build a fixed set of buckets (order preserved), dropping empty ones. */
    const groups = (defs) => defs
      .map(([label, test]) => ({ label, count: rows.filter(test).length }))
      .filter(g => g.count > 0)
      .map(g => ({ ...g, percent: total ? Math.round((g.count / total) * 1000) / 10 : 0 }));

    // "Student" is what people type in the current position field, so it is the
    // only reliable signal available. Anyone who left the field blank is shown
    // as "Not stated" rather than being quietly counted as unemployed — the
    // form never asked whether they have a job.
    const pos = (r) => String(r.current_position || '').trim();
    const isStudent = (r) => /student/i.test(pos(r));

    return ok({
      total,
      employmentStatus: groups([
        ['In work or self-employed', r => pos(r) && !isStudent(r)],
        ['Studying',                 isStudent],
        ['Not stated',               r => !pos(r)],
      ]),
      educationRecorded: groups([
        ['Qualification recorded', r => String(r.education_level || '').trim()],
        ['Not stated',             r => !String(r.education_level || '').trim()],
      ]),
      // Only sections member records can actually answer.
      education:     tally(r => r.education_level),
      fieldOfStudy:  tally(r => r.field_of_study),
      professions:   tally(r => r.current_position),
      gender:        tally(r => r.gender),
      contribution:  tally(r => r.contribution_areas),
      unionCouncils: tally(r => r.union_council, canonical.councils),
      villages:      tally(r => r.village, canonical.villages),
      generatedAt:   new Date().toISOString(),
    });
  } catch (e) {
    return fail('STATS_FAILED', 500, { message: e.message });
  }
}
