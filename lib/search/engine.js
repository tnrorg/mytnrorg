import { tabOf } from './types';

/* ── Search engine — matching and ranking ────────────────────────────────────
 *
 * Pure functions: no database, no network. Given a list of documents that are
 * ALREADY public, it finds and ranks the ones that match a query.
 *
 * It deliberately knows nothing about permissions. What may be searched is
 * decided earlier, in lib/search/providers.js, which only ever loads public
 * rows — so a ranking bug here can order results badly but cannot reveal a
 * record, because a private record was never handed to it.
 *
 * WHAT IT HANDLES
 *   partial words      "schol"        → Scholarship
 *   typing mistakes    "scholership"  → Scholarship   (bounded edit distance)
 *   several words      "software engineer" — every word must match
 *   alternative words  "wazifa", "funding" → scholarship   (SYNONYMS below)
 *   Urdu script        "گنجی" → Ganji   (consonant skeleton, see skeleton())
 */

// ── Normalisation ───────────────────────────────────────────────────────────

const AR = /[؀-ۿ]/;
export const hasUrdu = (s) => AR.test(String(s || ''));

/** Lowercase, strip accents and punctuation, unify Arabic-script variants. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ْٰـ]/g, '')   // Latin accents, Urdu diacritics, tatweel
    .replace(/[يى]/g, 'ی')                        // ي ى → ی
    .replace(/ك/g, 'ک')                                // ك → ک
    .replace(/[ةہۃه]/g, 'ہ')            // ة ہ ۃ ه → ہ
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim();
}
export const tokens = (s) => { const n = norm(s); return n ? n.split(' ') : []; };

/* Consonant skeleton — how an Urdu spelling is matched to a Roman one.
 *
 * TNR's village and Union Council names are stored in English only. Rather
 * than invent an Urdu spelling for each (and get some wrong), both scripts are
 * reduced to the consonants they share: "گنجی" → gnj, "Ganji" → gnj.
 * Vowels are dropped on both sides because Urdu usually does not write them.
 *
 * It is approximate by nature — two different names can share a skeleton — so
 * it is used ONLY when the query is in Urdu script, only against titles and
 * keywords, and it scores below a real match. */
const UR = {
  'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'c', 'ح': 'h', 'خ': 'k',
  'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'z', 'س': 's', 'ش': 's',
  'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z', 'غ': 'g', 'ف': 'f', 'ق': 'k', 'ک': 'k', 'گ': 'g',
  'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'ہ': 'h',
  // vowels, vowel carriers and the aspiration mark carry no consonant
  'ا': '', 'آ': '', 'و': '', 'ی': '', 'ے': '', 'ئ': '', 'ء': '', 'ع': '', 'ھ': '', 'ؤ': '',
};
export function skeleton(token) {
  const t = String(token || '');
  let out = '';
  if (hasUrdu(t)) {
    for (const ch of t) out += UR[ch] ?? '';
  } else {
    out = t
      .replace(/kh|q/g, 'k').replace(/sh/g, 's').replace(/ch/g, 'c').replace(/gh/g, 'g')
      .replace(/([tdpbjkg])h/g, '$1').replace(/x/g, 'ks')
      .replace(/[aeiouyw]/g, '').replace(/v/g, '').replace(/[0-9]/g, '');
  }
  return out.replace(/(.)\1+/g, '$1');          // collapse doubles: "ss" → "s"
}

// ── Synonyms ────────────────────────────────────────────────────────────────
//
// Alternative words a visitor might type, English and Roman Urdu. Each group
// is symmetric: any word finds the others. Add to it freely — these only widen
// what a query matches, they never change a stored name.
const SYNONYM_GROUPS = [
  ['scholarship', 'scholarships', 'wazifa', 'funding', 'bursary', 'stipend'],
  ['job', 'jobs', 'vacancy', 'career', 'naukri', 'employment'],
  ['news', 'khabar', 'khabrain', 'announcement', 'announcements', 'update', 'updates'],
  ['village', 'villages', 'gaon', 'gaun'],
  ['uc', 'council'],
  ['member', 'members', 'rukn', 'arkan'],
  ['education', 'taleem', 'talim'],
  ['youth', 'nojawan', 'naujawan', 'nojawanan'],
  ['cec', 'executive', 'cabinet'],
  ['university', 'universities', 'jamia'],
  ['statistics', 'stats', 'data', 'figures', 'numbers'],
  ['population', 'abadi', 'demographics'],
  ['school', 'schools', 'college', 'colleges'],
  ['constitution', 'dastoor', 'aain'],
];
const SYN = new Map();
for (const g of SYNONYM_GROUPS) for (const w of g) SYN.set(w, g.filter(x => x !== w));

const STOP = new Set(['the', 'of', 'in', 'a', 'an', 'and', 'for', 'to', 'on', 'at', 'ka', 'ki', 'ke', 'ko', 'se']);

// ── Typo tolerance ──────────────────────────────────────────────────────────

/** Edit distance with transpositions, abandoned once it exceeds `max`. */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[lb];
}
/* Short words get no tolerance at all: one edit turns "Ali" into "Adil", which
   is a different person, not a typo. */
const allowedEdits = (len) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);
/* Numbers are never "nearly" right. A membership ID, a year or a scheme number
   one digit off is a different record — TNR-MN-0003 must not find 0006. */
const HAS_DIGIT = /[0-9]/;

// ── Index ───────────────────────────────────────────────────────────────────

/**
 * Prepare documents for searching. Done once per index build, not per query.
 *
 * A document is:
 *   { id, type, title, description, url, thumbnail, updated_at,
 *     keywords?, body?, meta?, demote? }
 * `keywords` and `body` are matched but never sent to the browser.
 */
export function buildIndex(docs) {
  return (docs || []).filter(d => d && d.title && d.url && d.type).map(d => {
    const t = tokens(d.title);
    const k = tokens(`${d.keywords || ''} ${d.description || ''}`);
    return {
      doc: d,
      tn: ` ${t.join(' ')} `,
      t, k,
      kn: ` ${k.join(' ')} `,
      b: d.body ? ` ${norm(d.body)} ` : ' ',
      ts: t.map(skeleton), ks: k.map(skeleton),
      time: d.updated_at ? Date.parse(d.updated_at) || 0 : 0,
    };
  });
}

// ── Matching ────────────────────────────────────────────────────────────────

const W_TITLE = 1, W_KEY = 0.55, W_BODY = 0.25;

/** Best score (0–1) for one query word against one document. */
function wordScore(q, e, fuzzy) {
  let best = 0;
  const consider = (list, joined, w) => {
    if (best >= w) return;
    if (joined.includes(` ${q} `)) { best = Math.max(best, w); return; }
    if (joined.includes(` ${q}`)) { best = Math.max(best, w * 0.85); return; }
    if (q.length >= 3 && joined.includes(q)) { best = Math.max(best, w * 0.55); return; }
    if (fuzzy && !HAS_DIGIT.test(q)) {
      const max = allowedEdits(q.length);
      if (max) for (const tok of list) {
        if (Math.abs(tok.length - q.length) > max) continue;
        if (editDistance(q, tok, max) <= max) { best = Math.max(best, w * 0.5); break; }
      }
    }
  };
  consider(e.t, e.tn, W_TITLE);
  consider(e.k, e.kn, W_KEY);
  if (best < W_BODY) {
    if (e.b.includes(` ${q} `)) best = Math.max(best, W_BODY);
    else if (q.length >= 3 && e.b.includes(` ${q}`)) best = Math.max(best, W_BODY * 0.8);
  }
  return best;
}

/** Urdu-script word against Roman titles/keywords, by consonant skeleton. */
function skeletonScore(q, e) {
  const sk = skeleton(q);
  if (sk.length < 2) return 0;
  if (e.ts.includes(sk)) return 0.6;
  if (e.ks.includes(sk)) return 0.35;
  return 0;
}

function termScore(q, e, fuzzy) {
  let s = wordScore(q, e, fuzzy);
  if (s < 1) for (const alt of SYN.get(q) || []) s = Math.max(s, wordScore(alt, e, false) * 0.85);
  if (s === 0 && hasUrdu(q)) s = skeletonScore(q, e);
  return s;
}

const FRESH_MS = 90 * 86400000;

/**
 * Search a prepared index.
 *
 *   { tab = 'all', limit = 20, offset = 0, now }
 *
 * Returns { results, total, counts, tokens }.
 * `counts` is per tab across the WHOLE match set, for the tab badges.
 */
export function searchIndex(index, query, { tab = 'all', limit = 20, offset = 0, now = Date.now() } = {}) {
  let qs = tokens(String(query || '').slice(0, 80)).slice(0, 6);
  const meaningful = qs.filter(t => !STOP.has(t));
  if (meaningful.length) qs = meaningful;
  if (!qs.length || qs.join('').length < 2) return { results: [], total: 0, counts: {}, tokens: [] };
  const phrase = qs.join(' ');
  /* An Urdu query has no Roman phrase to compare with a title, so the "this
     title IS the query" bonus is judged on consonant skeletons instead —
     otherwise "گنجی" ranks the school in Ganji level with Ganji itself. */
  const urduPhrase = hasUrdu(phrase) ? qs.map(skeleton).join(' ') : null;

  const run = (fuzzy) => {
    const hits = [];
    for (const e of index) {
      let sum = 0, all = true;
      for (const q of qs) {
        const s = termScore(q, e, fuzzy);
        if (s === 0) { all = false; break; }       // every word must match
        sum += s;
      }
      if (!all) continue;
      let score = (sum / qs.length) * 10;
      if (e.tn === ` ${phrase} `) score += 6;                       // the title IS the query
      else if (urduPhrase && e.ts.join(' ') === urduPhrase) score += 6;
      else if (qs.length > 1 && e.tn.includes(` ${phrase} `)) score += 3;
      else if (e.tn.startsWith(` ${phrase}`)) score += 1.5;
      if (e.time && now - e.time < FRESH_MS) score += 1.5 * (1 - (now - e.time) / FRESH_MS);
      if (e.doc.demote) score -= 3;
      hits.push({ e, score });
    }
    return hits;
  };

  /* Exact, prefix and substring matching first. Typo tolerance is tried only
     when that finds nothing — so a correctly spelt query is never diluted
     with near-misses, and a misspelt one still gets an answer. */
  let hits = run(false);
  let corrected = false;
  if (!hits.length) { hits = run(true); corrected = hits.length > 0; }

  hits.sort((a, b) => b.score - a.score || b.e.time - a.e.time
    || a.e.doc.title.localeCompare(b.e.doc.title));

  const counts = { all: hits.length };
  for (const h of hits) { const t = tabOf(h.e.doc.type); counts[t] = (counts[t] || 0) + 1; }

  const inTab = tab && tab !== 'all' ? hits.filter(h => tabOf(h.e.doc.type) === tab) : hits;
  const page = inTab.slice(offset, offset + limit);

  return {
    total: inTab.length,
    counts,
    corrected,
    tokens: qs,
    results: page.map(({ e, score }) => toResult(e.doc, score, qs)),
  };
}

/** The unified result shape sent to the browser. keywords/body never leave. */
function toResult(d, score, qs) {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    description: d.body ? snippet(d.body, qs, d.description) : (d.description || ''),
    url: d.url,
    thumbnail: d.thumbnail || null,
    relevance: Math.max(0, Math.min(1, Number((score / 17.5).toFixed(3)))),
    updated_at: d.updated_at || null,
    meta: d.meta || null,
  };
}

/** A short excerpt around the first matching word, or the summary if none. */
export function snippet(body, qs, fallback = '') {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback || '';
  const low = text.toLowerCase();
  let at = -1;
  for (const q of qs) { const i = low.indexOf(q); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return fallback || text.slice(0, 170) + (text.length > 170 ? '…' : '');
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, start + 180);
  return (start ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}
