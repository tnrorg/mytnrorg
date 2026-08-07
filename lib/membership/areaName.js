/**
 * Tidy an area name before it is stored.
 *
 * Names are typed by hand and end up on the public site, on membership cards
 * and in every chart, so small inconsistencies are visible everywhere:
 * "UC BAGORDO /BAGHIZA" has a stray space before the slash, and a trailing
 * space would make an otherwise identical name count as a separate village.
 *
 * Deliberately conservative — it fixes whitespace and punctuation spacing
 * only. Capitalisation is left exactly as typed, because real names are not
 * predictable ("UC", "Talu Broq", "Nawasher/Nageghot") and auto-casing would
 * do more damage than it prevents.
 */
export function cleanAreaName(input) {
  return String(input || '')
    .replace(/\s+/g, ' ')            // collapse repeated whitespace
    .replace(/\s*\/\s*/g, '/')       // "A / B" and "A /B" → "A/B"
    .replace(/\s*-\s*/g, '-')        // same for hyphenated names
    .replace(/\s*,\s*/g, ', ')       // normalise comma spacing
    .trim();
}

/** The grouping key. Two spellings of one place must collapse to one row. */
export const areaKey = (input) => cleanAreaName(input).toLowerCase();

/**
 * Choose which spelling of a name to SHOW when members have typed it several
 * ways — "Hardass", "hardass", "HARDASS".
 *
 * Grouping used to display whichever spelling happened to be read first, so a
 * single member who typed in lower case decided how the village appeared to
 * everyone. This picks deterministically instead:
 *
 *   1. Mixed case wins        — "Hardass" over "HARDASS" or "hardass",
 *                               because that is how a place name is written.
 *   2. Then Title Case        — a capital on every word.
 *   3. Then anything but all-lower-case.
 *   4. Ties break alphabetically, so the result never depends on row order.
 *
 * Auto-capitalising instead was rejected: it mangles "UC", "Nawasher/Nageghot"
 * and "Gianmakaxy (Jamshed Abad)". Choosing between spellings a human actually
 * typed is safe; inventing one is not.
 */
function spellingScore(name) {
  const s = cleanAreaName(name);
  if (!s) return -1;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters) return 0;
  const allUpper = letters === letters.toUpperCase();
  const allLower = letters === letters.toLowerCase();
  // Every word starts with a capital and is not shouting.
  const titled = !allUpper && s.split(/[\s/-]+/).filter(Boolean)
    .every(w => !/^[a-z]/.test(w));
  if (titled) return 3;
  if (!allUpper && !allLower) return 2;
  if (allUpper) return 1;
  return 0;                               // all lower case
}

export function preferredSpelling(a, b) {
  if (!a) return cleanAreaName(b);
  if (!b) return cleanAreaName(a);
  const A = cleanAreaName(a), B = cleanAreaName(b);
  const sa = spellingScore(A), sb = spellingScore(B);
  if (sa !== sb) return sa > sb ? A : B;
  return A.localeCompare(B) <= 0 ? A : B;   // stable, order-independent
}

/**
 * Canonical spellings from the admin-managed Areas list, keyed by lower case.
 *
 * This is the authority: whatever an admin typed under Membership → Areas is
 * how the place is named on the public site, regardless of how any individual
 * member spelled it on their application. Server-only — it reads the database.
 */
export async function canonicalAreaNames(supabase) {
  const out = { councils: new Map(), villages: new Map() };
  try {
    const [{ data: ucs }, { data: villages }] = await Promise.all([
      supabase.from('membership_union_councils').select('name'),
      supabase.from('membership_villages').select('name'),
    ]);
    for (const u of ucs || []) out.councils.set(areaKey(u.name), cleanAreaName(u.name));
    for (const v of villages || []) out.villages.set(areaKey(v.name), cleanAreaName(v.name));
  } catch { /* areas not migrated yet — fall back to member spellings */ }
  return out;
}
