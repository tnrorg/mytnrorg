/* Interview panels — the shared rules.
 *
 * Imported by the console and the API, so the number a panellist sees while
 * scoring and the number stored against a candidate are produced by the same
 * code. Browser-safe: no 'server-only'.
 */

// ── Criteria ───────────────────────────────────────────────────────────────
/* A starting set, editable per session before the panel begins.
 *
 * Four, not ten. A panel scoring ten criteria on thirty candidates makes 300
 * judgements in a day and stops distinguishing between them somewhere around
 * candidate nine — the later scores cluster and the whole exercise stops
 * separating anybody.
 */
export const DEFAULT_CRITERIA = [
  { key: 'motivation',    label: 'Motivation & commitment' },
  { key: 'communication', label: 'Communication' },
  { key: 'subject',       label: 'Subject knowledge' },
  { key: 'potential',     label: 'Potential to benefit' },
];

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

/* 1–10, and no zero.
 *
 * Zero would mean "scored, and worthless", which no panellist means and which
 * drags an average down harder than any real judgement. An unscored criterion
 * is ABSENT from the object, not zero — see averageFor(). */

export function cleanCriteria(list) {
  if (!Array.isArray(list)) return [...DEFAULT_CRITERIA];
  const out = [];
  const seen = new Set();
  for (const c of list) {
    /* Collapse runs of punctuation and trim the ends, so "Subject knowledge"
     * and "Subject knowledge!" produce the SAME key and the second is dropped
     * as the duplicate it is. Without the collapse they become
     * `subject_knowledge` and `subject_knowledge_`, and the panel scores what
     * looks like two criteria with one label. */
    const key = String(c?.key || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    const label = String(c?.label || '').trim().slice(0, 80);
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label });
    if (out.length >= 8) break;
  }
  return out.length ? out : [...DEFAULT_CRITERIA];
}

// ── Queue states ───────────────────────────────────────────────────────────
export const QUEUE_STATES = ['waiting', 'in_progress', 'done', 'no_show', 'skipped'];

export const STATE_LABEL = {
  waiting: 'Waiting',
  in_progress: 'In the room',
  done: 'Interviewed',
  /* "Did not attend", not "absent" or "failed".
   *
   * A candidate in Gilgit-Baltistan who loses power or signal at their slot
   * has not done anything wrong, and the word on their record should not
   * suggest they have. */
  no_show: 'Did not attend',
  skipped: 'Skipped for now',
};

export const STATE_TONE = {
  waiting: { bg: 'rgba(148,163,184,.18)', fg: '#475569' },
  in_progress: { bg: 'rgba(11,107,79,.16)', fg: '#0B6B4F' },
  done: { bg: 'rgba(34,197,94,.16)', fg: '#15803D' },
  no_show: { bg: 'rgba(245,158,11,.16)', fg: '#B45309' },
  skipped: { bg: 'rgba(148,163,184,.14)', fg: '#64748B' },
};

/** Queue positions are sparse so one candidate can be moved without a rewrite. */
export const POSITION_STEP = 10;

// ── Scoring ────────────────────────────────────────────────────────────────
/**
 * Validate one panellist's evaluation.
 *
 * @returns {{ ok:boolean, errors:Object, value:{scores:Object, notes:?string,
 *             recommendation:?string} }}
 */
export function validateEvaluation(input = {}, criteria = DEFAULT_CRITERIA) {
  const errors = {};
  const keys = new Set(cleanCriteria(criteria).map(c => c.key));
  const scores = {};

  for (const [k, raw] of Object.entries(input.scores || {})) {
    if (!keys.has(k)) continue;                    // a criterion not on this session
    if (raw === '' || raw === null || raw === undefined) continue;   // left blank, on purpose
    const n = Number(raw);
    if (!Number.isFinite(n) || n < SCORE_MIN || n > SCORE_MAX) {
      errors[`score_${k}`] = `Score ${k} between ${SCORE_MIN} and ${SCORE_MAX}.`;
      continue;
    }
    scores[k] = Math.round(n);
  }

  const rec = input.recommendation ? String(input.recommendation).trim() : null;
  if (rec && !['select', 'reject', 'undecided'].includes(rec)) {
    errors.recommendation = 'Choose Select, Reject or Undecided.';
  }

  const notes = input.notes === undefined ? undefined
    : (String(input.notes || '').trim().slice(0, 4000) || null);

  /* An evaluation with nothing in it is not saved.
   *
   * Otherwise a panellist who opens a candidate and clicks away leaves an
   * empty row that counts as "one panellist has scored", and the coverage
   * figure the chair reads before deciding becomes a lie. */
  const empty = !Object.keys(scores).length && !rec && !notes;
  if (empty) errors.empty = 'Add at least one score, a note, or a recommendation.';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { scores, notes, recommendation: rec },
  };
}

/**
 * One panellist's average, over the criteria THEY scored.
 *
 * Returns null when they scored nothing — not 0, because a panellist who wrote
 * only a note has not rated the candidate badly, they have not rated them.
 */
export function panellistAverage(scores) {
  const vals = Object.values(scores || {}).map(Number).filter(Number.isFinite);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

/**
 * The candidate's overall figure, across the panel.
 *
 * MEAN OF PANELLIST MEANS, not a mean of every individual score. Otherwise a
 * panellist who filled in all four criteria outweighs one who filled in two,
 * purely for being more thorough with the form — which is not a judgement
 * about the candidate at all.
 *
 * Also returns the SPREAD. Two panellists averaging 5 could be 5 and 5, or 2
 * and 8, and those are completely different conversations. A chair reading
 * only the mean would never know to have the second one.
 */
export function panelSummary(evaluations = [], criteria = DEFAULT_CRITERIA) {
  const perPanellist = evaluations
    .map(e => panellistAverage(e.scores))
    .filter(v => v !== null);

  const overall = perPanellist.length
    ? Math.round((perPanellist.reduce((a, b) => a + b, 0) / perPanellist.length) * 10) / 10
    : null;

  const spread = perPanellist.length > 1
    ? Math.round((Math.max(...perPanellist) - Math.min(...perPanellist)) * 10) / 10
    : 0;

  // Per criterion, across everyone who scored it.
  const byCriterion = {};
  for (const c of cleanCriteria(criteria)) {
    const vals = evaluations
      .map(e => Number(e.scores?.[c.key]))
      .filter(Number.isFinite);
    byCriterion[c.key] = vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      : null;
  }

  const recs = evaluations.map(e => e.recommendation).filter(Boolean);
  const counts = {
    select: recs.filter(r => r === 'select').length,
    reject: recs.filter(r => r === 'reject').length,
    undecided: recs.filter(r => r === 'undecided').length,
  };

  return {
    overall,
    spread,
    /* Flag a genuine disagreement rather than averaging it away. Three points
     * between panellists on a ten-point scale is not noise. */
    disagreement: spread >= 3,
    byCriterion,
    panellists: evaluations.length,
    scored: perPanellist.length,
    recommendations: counts,
    /* No automatic verdict. The counts are reported; what to do about
     * 2 select / 1 reject is a decision for the panel, not for this function,
     * and a computed "PASS" would quietly become the decision. */
  };
}

/** Progress through the day, for the console header. */
export function queueProgress(rows = []) {
  const by = (s) => rows.filter(r => r.state === s).length;
  return {
    total: rows.length,
    waiting: by('waiting'),
    in_progress: by('in_progress'),
    done: by('done'),
    no_show: by('no_show'),
    skipped: by('skipped'),
    seen: by('done'),
  };
}

/** The next candidate to call: lowest position still waiting. */
export function nextInQueue(rows = []) {
  return [...rows]
    .filter(r => r.state === 'waiting')
    .sort((a, b) => a.position - b.position)[0] || null;
}

export const fmtClock = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/** How long an interview took, for the record. */
export function durationMinutes(row) {
  if (!row?.started_at || !row?.ended_at) return null;
  const mins = (new Date(row.ended_at) - new Date(row.started_at)) / 60000;
  return mins > 0 ? Math.round(mins) : null;
}
