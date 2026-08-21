/* Tidy a person's name into the form the platform displays everywhere:
 * "shabbir hussain", "SHABBIR HUSSAIN" and "ShAbBiR hUsSaIn" all become
 * "Shabbir Hussain".
 *
 * Applied on save rather than only at render, so the tidy version is what is
 * stored — the membership card, the certificate, the exported spreadsheet and
 * the public directory all read the same column, and formatting in one of them
 * would leave the others looking careless.
 *
 * WHAT IT DELIBERATELY LEAVES ALONE
 *
 *   Non-Latin script. Urdu, Balti and Arabic have no concept of upper and
 *   lower case; running a capitaliser over them can only damage them, so any
 *   word without a Latin letter is returned untouched.
 *
 *   Particles like bin, bint, al- and ul. "Muhammad bin Qasim" is correct;
 *   "Muhammad Bin Qasim" is not. These stay lowercase unless they open the
 *   name, where a capital is right.
 *
 *   Initials and short forms. "M." stays "M." and does not become "M".
 *
 * WHAT IT HANDLES
 *   Hyphens      — "abdul-rehman" → "Abdul-Rehman"
 *   Apostrophes  — "d'souza" → "D'Souza",  "o'brien" → "O'Brien"
 *   Mc and Mac   — "mcdonald" → "McDonald"
 *   Extra spaces — "  ali   shahid " → "Ali Shahid"
 */

/* Kept lowercase inside a name. Short, and only genuinely conventional ones —
 * a long list starts mangling names that merely resemble a particle. */
const PARTICLES = new Set([
  'bin', 'bint', 'ibn', 'al', 'ul', 'ud', 'us', 'ur', 'e',
  'van', 'von', 'der', 'den', 'de', 'del', 'di', 'da', 'du', 'la', 'le', 'ter',
]);

const hasLatin = (s) => /[a-z]/i.test(s);

/** Capitalise one word, respecting internal hyphens and apostrophes. */
function capWord(word) {
  if (!hasLatin(word)) return word;                 // Urdu / Balti / Arabic

  // Split on hyphens and apostrophes but KEEP them, so "abdul-rehman" and
  // "o'brien" rebuild exactly as they were, only cased.
  return word.split(/([-'’])/).map(part => {
    if (part === '-' || part === "'" || part === '’') return part;
    if (!part) return part;
    if (!hasLatin(part)) return part;

    const lower = part.toLowerCase();

    // Mc / Mac: the letter after the prefix is capital too.
    if (/^mc[a-z]{2,}$/.test(lower)) return 'Mc' + lower[2].toUpperCase() + lower.slice(3);
    if (/^mac[a-z]{3,}$/.test(lower)) return 'Mac' + lower[3].toUpperCase() + lower.slice(4);

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

/**
 * @param {string} raw
 * @returns {string} the tidied name, or '' when there is nothing to tidy.
 */
export function toNameCase(raw) {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';

  const words = s.split(' ');
  return words.map((w, i) => {
    const lower = w.toLowerCase();

    // A particle keeps its lowercase form — unless it is the first word, where
    // a capital is correct ("Al Hassan" as a given name).
    if (i > 0 && PARTICLES.has(lower) && hasLatin(w)) return lower;

    return capWord(w);
  }).join(' ');
}

/** Convenience for the first/last pair, plus the combined display name. */
export function nameParts({ first_name, last_name } = {}) {
  const first = toNameCase(first_name);
  const last = toNameCase(last_name);
  return { first_name: first, last_name: last, full_name: [first, last].filter(Boolean).join(' ') };
}
