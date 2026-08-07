/* Shared vocabulary and roll-ups for the education institutions register.
 *
 * The staffing terms are deliberate and are used verbatim on the public page:
 *
 *   Posted here        — teachers whose first-appointment posting is this
 *                        school. Their parent station on paper.
 *   Serving here       — of those, how many actually teach here.
 *   Serving elsewhere  — posted here on paper, on duty at another station.
 *   Attached in        — posted elsewhere, actually teaching here.
 *
 * "Teachers present" is therefore serving_here + attached_in + community
 * teachers, and that is the number a parent standing at the gate cares about.
 */

export const KINDS = [
  ['school',          'School'],
  ['college',         'College'],
  ['training_centre', 'Training Centre'],
  ['other',           'Other'],
];

export const LEVELS = [
  ['primary',          'Primary'],
  ['middle',           'Middle'],
  ['high',             'High'],
  ['higher_secondary', 'Higher Secondary'],
  ['degree',           'Degree'],
  ['vocational',       'Vocational / Technical'],
  ['other',            'Other'],
];

export const SERVES = [['boys', 'Boys'], ['girls', 'Girls'], ['co_ed', 'Co-education']];

export const SECTORS = [
  ['government', 'Government'],
  ['private',    'Private'],
  ['community',  'Community-run'],
  ['other',      'Other'],
];

export const KIND_LABEL   = Object.fromEntries(KINDS);
export const LEVEL_LABEL  = Object.fromEntries(LEVELS);
export const SERVES_LABEL = Object.fromEntries(SERVES);
export const SECTOR_LABEL = Object.fromEntries(SECTORS);

export const blankInstitution = () => ({
  name: '', kind: 'school', level: 'primary', serves: 'co_ed', sector: 'government',
  union_council: '', village: '',
  sanctioned_posts: 0, posted_here: 0, serving_here: 0, serving_elsewhere: 0,
  attached_in: 0, teachers_needed: 0, community_teachers: 0,
  community_fee_monthly: 0, fee_note: '',
  students_total: 0, students_boys: 0, students_girls: 0,
  head_teacher: '', contact: '', notes: '', source: '', last_verified: '',
  elsewhere_note: '',
  image_url: null, gallery: [], published: true, sort_order: 0,
});

export const PUBLIC_INSTITUTION_COLUMNS = [
  'id', 'name', 'kind', 'level', 'serves', 'sector', 'union_council', 'village',
  'sanctioned_posts', 'posted_here', 'serving_here', 'serving_elsewhere',
  'attached_in', 'teachers_needed', 'community_teachers',
  'community_fee_monthly', 'fee_note',
  'students_total', 'students_boys', 'students_girls', 'elsewhere_note',
  'head_teacher', 'notes', 'source', 'last_verified', 'image_url', 'gallery', 'sort_order',
  // `contact` is deliberately omitted — a phone number on a public page invites
  // nuisance calls to a head teacher who never agreed to publish it.
].join(', ');

const n = (v) => Number(v) || 0;

/** Teachers actually in the classroom, whatever their paperwork says. */
export const teachersPresent = (i) =>
  n(i.serving_here) + n(i.attached_in) + n(i.community_teachers);

/** Posted here but not teaching here. The number this page exists to surface. */
export const absentFromPost = (i) => n(i.serving_elsewhere);

/** Students per teacher actually present, or null when either side is unknown. */
export function pupilTeacherRatio(i) {
  const t = teachersPresent(i);
  const s = n(i.students_total);
  return t > 0 && s > 0 ? Math.round(s / t) : null;
}

export function summarise(list) {
  const sum = (field) => list.reduce((a, i) => a + n(i[field]), 0);
  const total = list.length;
  const pct = (x) => (total ? Math.round((x / total) * 1000) / 10 : 0);

  const tallyBy = (fn, labels) => {
    const m = new Map();
    for (const i of list) {
      const raw = fn(i);
      const v = String(raw ?? '').trim();
      if (!v) continue;
      const label = labels ? (labels[v] || v) : v;
      const k = label.toLowerCase();
      if (!m.has(k)) m.set(k, { label, count: 0 });
      m.get(k).count++;
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map(x => ({ ...x, percent: pct(x.count) }));
  };

  /** Area rows carry the staffing gap, which is what makes them worth reading. */
  const byArea = (field) => {
    const m = new Map();
    for (const i of list) {
      const v = String(i[field] || '').trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (!m.has(k)) {
        m.set(k, {
          label: v, count: 0, sanctioned: 0, posted: 0, present: 0,
          elsewhere: 0, needed: 0, community: 0, students: 0,
        });
      }
      const g = m.get(k);
      g.count++;
      g.sanctioned += n(i.sanctioned_posts);
      g.posted     += n(i.posted_here);
      g.present    += teachersPresent(i);
      g.elsewhere  += n(i.serving_elsewhere);
      g.needed     += n(i.teachers_needed);
      g.community  += n(i.community_teachers);
      g.students   += n(i.students_total);
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map(g => ({ ...g, percent: pct(g.count) }));
  };

  const present = list.reduce((a, i) => a + teachersPresent(i), 0);
  const students = sum('students_total');
  const charging = list.filter(i => n(i.community_fee_monthly) > 0);

  return {
    total,
    schools:  list.filter(i => i.kind === 'school').length,
    colleges: list.filter(i => i.kind === 'college').length,
    centres:  list.filter(i => i.kind === 'training_centre').length,

    sanctioned: sum('sanctioned_posts'),
    postedHere: sum('posted_here'),
    servingHere: sum('serving_here'),
    servingElsewhere: sum('serving_elsewhere'),
    attachedIn: sum('attached_in'),
    communityTeachers: sum('community_teachers'),
    teachersNeeded: sum('teachers_needed'),
    present,

    students,
    studentsBoys: sum('students_boys'),
    studentsGirls: sum('students_girls'),
    ratio: present > 0 && students > 0 ? Math.round(students / present) : null,

    // Institutions where families are paying to cover a staffing gap.
    feeCharging: charging.length,
    feeAverage: charging.length
      ? Math.round(charging.reduce((a, i) => a + n(i.community_fee_monthly), 0) / charging.length)
      : 0,

    byKind:   tallyBy(i => i.kind, KIND_LABEL),
    byLevel:  tallyBy(i => i.level, LEVEL_LABEL),
    bySector: tallyBy(i => i.sector, SECTOR_LABEL),
    byServes: tallyBy(i => i.serves, SERVES_LABEL),
    byCouncil: byArea('union_council'),
    byVillage: byArea('village'),
  };
}
