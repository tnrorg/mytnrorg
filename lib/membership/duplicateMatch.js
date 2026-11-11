/* ── TNR smart duplicate detection — normalisation and scoring ───────────────
 *
 * Pure functions, no database, no network, no randomness. Everything here is
 * deterministic: the same two records always produce the same score and the
 * same reasons. That is a requirement, not a preference — an admin is going to
 * refuse somebody's membership partly on this number, and "the algorithm said
 * 87" is only defensible if it says 87 every time and can show its working.
 *
 * WHAT THIS CAN AND CANNOT DO
 *
 * It compares names, villages, Union Councils, ages, universities, education
 * and professions. None of those is an identifier. Two different men called
 * Muhammad Ali, both 25, both from the same village, both at COMSATS, are
 * indistinguishable here and will score very high — and in Roundu that is a
 * realistic combination, not a contrived one. A score is a reason to LOOK,
 * never a reason to reject. Phase 8 of the brief says the same thing, and the
 * API enforces it: nothing in this system rejects an application by itself.
 *
 * SCORING IS RELATIVE TO WHAT WE ACTUALLY HAVE. Points are only available for
 * a field when BOTH records carry it, so a pair sharing only a name cannot
 * reach 100 by default — see `coverage` below, which is the guard against the
 * artificially high percentages the brief warns about.
 */

/** Bump when the maths changes, so stored results stay interpretable. */
export const DETECTION_VERSION = 1;

/* Weights from the brief. Centralised so thresholds can be calibrated against
 * real records without hunting through the comparison code. */
export const WEIGHTS = {
  name: 45,
  village: 18,
  union_council: 10,
  age: 10,
  university: 9,
  education: 4,
  profession: 4,
};
export const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0); // 100

export const THRESHOLDS = {
  possible: 65,          // 65–84 → possible duplicate
  high: 85,              // 85+   → high similarity
  /* A high-risk verdict REQUIRES the names to actually look alike. Without
   * this, two different people from one small village with the same degree
   * and job could clear 85 on circumstance alone. */
  highRequiresName: 0.82,
  /* Below this much of the 100 points being available, we do not trust a
   * percentage at all — comparing two records that share only a name and a
   * village is 63 points of evidence pretending to be a verdict. */
  minCoverage: 55,
};

// ── Text normalisation ──────────────────────────────────────────────────────

/** Lowercase, strip accents, collapse punctuation and whitespace. */
export function normText(s) {
  return String(s ?? '')
    .normalize('NFKD')                   // split accented characters
    .replace(/[̀-ͯ]/g, '')     // drop the combining marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')        // punctuation → space, keeps "M." safe
    .replace(/\s+/g, ' ')
    .trim();
}

/* Spelling variants that are the SAME name in Roman script.
 *
 * Transliteration from Urdu has no single correct spelling, so the same person
 * is Muhammad, Mohammad, Mohammed or Md depending on who typed the form. Each
 * group collapses to one canonical token before comparison.
 *
 * Deliberately conservative: only variants that are genuinely the same name.
 * Hassan and Hussain are NOT in one group — they are different names, and the
 * brief's third test case exists precisely to stop that conflation. */
const NAME_VARIANTS = [
  ['muhammad', 'mohammad', 'mohammed', 'muhamad', 'mohamad', 'mohamed', 'mohd', 'md', 'muhammed'],
  ['ahmad', 'ahmed', 'ahmd'],
  ['ali', 'aly'],
  ['hussain', 'hussein', 'husain', 'hussian'],
  ['hassan', 'hasan'],
  ['abdul', 'abdal', 'abd'],
  ['syed', 'sayed', 'sayyed', 'said'],
  ['sheikh', 'shaikh', 'shaykh'],
  ['khan', 'khaan'],
  ['fatima', 'fatimah', 'fathima'],
  ['aisha', 'ayesha', 'aysha'],
  ['zahra', 'zehra', 'zahraa'],
  ['batool', 'batul'],
  ['iqbal', 'ikbal'],
  ['rehman', 'rahman', 'rehmaan'],
  ['ullah', 'ulah', 'allah'],
];
const CANON = new Map();
for (const group of NAME_VARIANTS) for (const v of group) CANON.set(v, group[0]);

/* The canonical form of each group — i.e. the set of names this table RECOGNISES.
 *
 * This set does double duty, and the second job matters more than the first.
 * The table says which spellings are the same name; by implication it also says
 * which names are DIFFERENT. Hassan and Hussain sit in separate groups on
 * purpose, yet they are 0.86 apart by Jaro–Winkler, so without this the fuzzy
 * fallback quietly re-merged the two names the table had just separated and
 * reported two different men as a high-risk duplicate.
 *
 * So: when both tokens resolve to recognised-but-different names, the answer is
 * zero, not a similarity score. A token the table does not know ("hussayn")
 * still goes to the fuzzy path and will match Hussain, which is what we want —
 * this only overrides the fuzzy result where the table actually has an opinion.
 *
 * That makes NAME_VARIANTS load-bearing: adding a name here asserts it is
 * distinct from every other canonical name. Add spellings to an existing group
 * freely; think before creating a new group. */
const CANON_SET = new Set(NAME_VARIANTS.map(g => g[0]));

/* Honorifics and qualifications carry no identity. "Dr Shahida Batool" and
 * "Shahida Batool" are one person; leaving the title in costs a token of
 * similarity for no reason. */
const NAME_NOISE = new Set([
  'dr', 'doctor', 'prof', 'professor', 'engr', 'eng', 'engineer',
  'mr', 'mrs', 'ms', 'miss', 'hafiz', 'qari', 'maulana', 'advocate',
  'phd', 'msc', 'bsc', 'ma', 'mba', 'mphil',
]);

/** Name → canonical, de-noised tokens. */
export function nameTokens(s) {
  return normText(s)
    .split(' ')
    .filter(t => t && !NAME_NOISE.has(t))
    .map(t => CANON.get(t) || t);
}

// ── String similarity ───────────────────────────────────────────────────────

/** Jaro–Winkler. Standard, cheap, and good on short human names. */
export function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aF = new Array(a.length).fill(false);
  const bF = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - m); j < Math.min(b.length, i + m + 1); j++) {
      if (bF[j] || a[i] !== b[j]) continue;
      aF[i] = bF[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aF[i]) continue;
    while (!bF[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;
  const jaro = (matches / a.length + matches / b.length + (matches - t) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/* Two tokens match if they are the same word, or one is an initial of the
 * other. "M. Ali" vs "Muhammad Ali" is the case this exists for — but an
 * initial is weak evidence, so it scores lower than a real token match. */
function tokenSim(a, b) {
  if (a === b) return 1;
  if ((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b))) return 0.6;
  /* Two names the variant table knows, and knows to be different — see
   * CANON_SET. Hassan is not a misspelling of Hussain. */
  if (CANON_SET.has(a) && CANON_SET.has(b)) return 0;
  const jw = jaroWinkler(a, b);
  /* Short tokens are dangerous: "ali" and "adil" are 0.78 by Jaro–Winkler and
   * are different people. Require near-identity below five characters. */
  if (Math.min(a.length, b.length) < 5 && jw < 0.92) return 0;
  return jw >= 0.86 ? jw : 0;
}

/** 0–1 similarity between two personal names, order-independent. */
export function nameSimilarity(a, b) {
  const A = nameTokens(a), B = nameTokens(b);
  if (!A.length || !B.length) return 0;

  /* Greedy best-match pairing rather than position-by-position: "Ali Shahid"
   * and "Shahid Ali" are the same name written in the other order, which the
   * brief explicitly asks us to catch. */
  const used = new Set();
  let total = 0;
  for (const t of A) {
    let best = 0, bestIdx = -1;
    B.forEach((u, i) => {
      if (used.has(i)) return;
      const s = tokenSim(t, u);
      if (s > best) { best = s; bestIdx = i; }
    });
    if (bestIdx >= 0) { used.add(bestIdx); total += best; }
  }
  /* Divide by the LONGER name, so "Ali" against "Muhammad Ali Khan" scores
   * 0.33 rather than a perfect 1 — a single shared token is not a match. */
  return total / Math.max(A.length, B.length);
}

// ── University ──────────────────────────────────────────────────────────────

/* NOTE FOR WHOEVER EXTENDS THIS. The brief assumed a verified universities
 * table with IDs, aliases and campus identifiers. The audit found none: the
 * only university data in this database is `organization_name`, one free-text
 * column shared with employers. So this is text matching on hand-typed data,
 * and it is weighted at 9 of 100 for that reason. It is supporting evidence.
 * If a real institution table is added later, prefer its IDs over this. */
const UNI_ALIASES = [
  ['comsats university islamabad', 'comsats', 'cui', 'comsats university'],
  ['national university of modern languages', 'numl'],
  ['quaid e azam university', 'qau', 'quaid i azam university'],
  ['university of the punjab', 'punjab university', 'pu'],
  ['international islamic university islamabad', 'iiui', 'iiu'],
  ['national university of sciences and technology', 'nust'],
  ['karakoram international university', 'kiu'],
  ['university of baltistan skardu', 'uobs', 'university of baltistan'],
  ['allama iqbal open university', 'aiou'],
  ['virtual university of pakistan', 'virtual university', 'vu'],
];
const UNI_CANON = new Map();
for (const g of UNI_ALIASES) for (const v of g) UNI_CANON.set(v, g[0]);

const UNI_NOISE = /\b(the|of|and|university|universitas|college|institute|campus)\b/g;

export function normUniversity(s) {
  const base = normText(s);
  if (!base) return '';
  if (UNI_CANON.has(base)) return UNI_CANON.get(base);
  const stripped = base.replace(UNI_NOISE, ' ').replace(/\s+/g, ' ').trim();
  return UNI_CANON.get(stripped) || base;
}

/** 0–1. Never 1 unless the canonical forms are identical. */
export function universitySimilarity(a, b) {
  const A = normUniversity(a), B = normUniversity(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const jw = jaroWinkler(A, B);
  return jw >= 0.9 ? jw : 0;
}

// ── Field comparisons ───────────────────────────────────────────────────────

/** Exact match after normalisation. Villages are NEVER fuzzily merged: two
 *  similarly spelled villages are routinely different places. */
const exact = (a, b) => (normText(a) && normText(a) === normText(b) ? 1 : 0);

/** Age from a date of birth, or null. */
export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/* Ages are compared with tolerance: the same person can be recorded a year
 * apart simply because a birthday fell between two registrations. */
function ageSimilarity(a, b) {
  if (a == null || b == null) return null;
  const d = Math.abs(a - b);
  if (d === 0) return 1;
  if (d === 1) return 0.8;
  if (d === 2) return 0.4;
  return 0;
}

// ── The comparison ──────────────────────────────────────────────────────────

/**
 * Compare two people. Each side is a plain object:
 *   { full_name, village, union_council, age, university, education, profession }
 * Any field may be null/undefined.
 *
 * Returns { score, risk, nameSimilarity, universitySimilarity, coverage,
 *           reasons[], version } — never throws.
 */
export function compareRecords(left = {}, right = {}, weights = WEIGHTS) {
  const reasons = [];
  let earned = 0;      // points actually scored
  let available = 0;   // points that were in play at all

  const add = (key, sim, label, detail) => {
    /* BOTH sides must have the field for it to be worth points. Two records
     * that are both missing a university have not agreed about anything. */
    if (sim === null) return;
    const w = weights[key] || 0;
    available += w;
    const got = w * sim;
    earned += got;
    if (sim > 0) {
      reasons.push({
        field: key, similarity: Number(sim.toFixed(3)),
        points: Number(got.toFixed(1)), of: w, label, detail,
      });
    }
  };

  const bothHave = (a, b) => (a != null && String(a).trim() && b != null && String(b).trim());

  // Name — the only field heavy enough to drive a verdict.
  const nSim = bothHave(left.full_name, right.full_name)
    ? nameSimilarity(left.full_name, right.full_name) : null;
  add('name', nSim, 'Name', nSim ? `"${left.full_name}" vs "${right.full_name}"` : null);

  add('village', bothHave(left.village, right.village) ? exact(left.village, right.village) : null,
    'Village', `${left.village || '—'} vs ${right.village || '—'}`);

  add('union_council',
    bothHave(left.union_council, right.union_council) ? exact(left.union_council, right.union_council) : null,
    'Union Council', `${left.union_council || '—'} vs ${right.union_council || '—'}`);

  add('age', ageSimilarity(left.age ?? null, right.age ?? null),
    'Age', `${left.age ?? '—'} vs ${right.age ?? '—'}`);

  const uSim = bothHave(left.university, right.university)
    ? universitySimilarity(left.university, right.university) : null;
  add('university', uSim, 'University', `${left.university || '—'} vs ${right.university || '—'}`);

  add('education', bothHave(left.education, right.education) ? exact(left.education, right.education) : null,
    'Education', `${left.education || '—'} vs ${right.education || '—'}`);

  add('profession', bothHave(left.profession, right.profession) ? exact(left.profession, right.profession) : null,
    'Profession', `${left.profession || '—'} vs ${right.profession || '—'}`);

  /* The score is a percentage OF WHAT WAS COMPARABLE, not of 100. Two records
   * sharing only a name and village have 63 points in play; scoring them out
   * of 100 would permanently cap them at 63 and hide real duplicates, while
   * scoring them out of 63 alone would call a single shared name "100%".
   * Reporting both the score and the coverage is what makes it honest. */
  const score = available > 0 ? Math.round((earned / available) * 100) : 0;
  const coverage = Math.round((available / MAX_SCORE) * 100);

  /* Risk.
   *
   * Thin evidence can never be "high", however well the few fields agree —
   * that is the brief's "avoid artificially high percentages" rule, and the
   * reason a name-only pair lands in "possible" for a human to look at
   * rather than in a queue of confident accusations. */
  let risk = 'low';
  const thin = coverage < THRESHOLDS.minCoverage;
  const namesAgree = (nSim ?? 0) >= THRESHOLDS.highRequiresName;

  if (score >= THRESHOLDS.high && namesAgree && !thin) risk = 'high';
  else if (score >= THRESHOLDS.possible && (nSim ?? 0) > 0.5) risk = 'possible';

  if (thin && score >= THRESHOLDS.possible) {
    reasons.push({
      field: 'coverage', similarity: null, points: 0, of: 0,
      label: 'Limited data',
      detail: `Only ${coverage}% of the comparable fields were present on both records.`,
    });
  }

  return {
    score,
    risk,
    coverage,
    nameSimilarity: nSim == null ? null : Number(nSim.toFixed(3)),
    universitySimilarity: uSim == null ? null : Number(uSim.toFixed(3)),
    reasons,
    version: DETECTION_VERSION,
  };
}
