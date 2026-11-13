/* ── Hero headline: lines, words and gold accents ────────────────────────────
 *
 * Pure. Turns the one-line headline an admin types into the structure the hero
 * animates: lines, each made of words, each word either white or gold.
 *
 * THREE RULES, all of which an admin can see the effect of without knowing
 * they exist:
 *
 * 1. ONE SENTENCE PER LINE. "EMPOWERING YOUTH. UNITING ROUNDU. BUILDING THE
 *    FUTURE." is three statements and is set as three lines, each starting at
 *    the margin — rather than wrapping wherever the column happens to end,
 *    which strands a word like "THE" on a line of its own. A headline with no
 *    full stops stays as it is. A line break typed into the field is always
 *    respected and switches this rule off.
 *
 * 2. GOLD WHERE ASKED. Wrap words in asterisks — "EMPOWERING *YOUTH.*" — and
 *    exactly those words are gold.
 *
 * 3. GOLD BY DEFAULT ON THE CLOSE. With no asterisks, the last line of a
 *    multi-line headline is gold, or the last word of a one-line headline.
 *    The emphasis lands where a spoken sentence lands, and every existing
 *    slide gets an accent without anyone editing it.
 *
 * The asterisks are never shown, and `plain` is the headline without them —
 * use it for anything that is read rather than drawn (aria labels, the admin
 * list, a page title).
 */

const SENTENCE_END = /[.!?]["'’”)]?$/;

/* A full stop that does not end a sentence: titles and initials. Without this,
   "Dr. Ali joins TNR" is set as "Dr." on a line by itself. */
const ABBREVIATION = /^(?:dr|mr|mrs|ms|prof|engr|st|no|vs|etc|[a-z])\.$/i;
const endsSentence = (word) => SENTENCE_END.test(word) && !ABBREVIATION.test(word);

export function parseHeroTitle(title) {
  const raw = String(title ?? '').replace(/\r/g, '').trim();
  if (!raw) return { lines: [], plain: '', wordCount: 0 };

  /* Markers count only when they pair up. A single stray asterisk is far more
     likely a typo than half an instruction, so it is dropped and nothing is
     gilded by accident. */
  const stars = (raw.match(/\*/g) || []).length;
  const marked = stars >= 2 && stars % 2 === 0;
  const segments = marked
    ? raw.split('*').map((text, i) => ({ text, gold: i % 2 === 1 }))
    : [{ text: raw.replace(/\*/g, ''), gold: false }];

  let lines = [[]];
  let typedBreak = false;
  for (const seg of segments) {
    for (const part of seg.text.split(/(\n)/)) {
      if (part === '\n') { lines.push([]); typedBreak = true; continue; }
      for (const w of part.split(/\s+/).filter(Boolean)) {
        lines[lines.length - 1].push({ text: w, gold: seg.gold });
      }
    }
  }
  lines = lines.filter(l => l.length);
  if (!lines.length) return { lines: [], plain: '', wordCount: 0 };

  // Rule 1 — a sentence per line, unless the admin placed the breaks.
  if (!typedBreak && lines.length === 1) {
    const out = [[]];
    const words = lines[0];
    words.forEach((w, i) => {
      out[out.length - 1].push(w);
      if (endsSentence(w.text) && i < words.length - 1) out.push([]);
    });
    lines = out;
  }

  // Rule 3 — default accent, only when nothing was marked.
  if (!marked) {
    if (lines.length > 1) lines[lines.length - 1].forEach(w => { w.gold = true; });
    else if (lines[0].length > 1) lines[0][lines[0].length - 1].gold = true;
  }

  const flat = lines.flat();
  return { lines, plain: flat.map(w => w.text).join(' '), wordCount: flat.length };
}

/** The headline as plain text — no markers, single spaces. */
export const plainHeroTitle = (title) => parseHeroTitle(title).plain;
