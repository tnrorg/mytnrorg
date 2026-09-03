import { ENTRIES, SUGGESTIONS } from '@/lib/ai/knowledge';
import { getMembershipStats } from '@/lib/membershipStats';
import { ok, fail, readJson } from '@/lib/api';
import { aiConfigured } from '@/lib/ai/provider';
import { answer as aiAnswer, trimHistory, MAX_QUESTION_CHARS } from '@/lib/ai/tnrChat';
import { allowAsk } from '@/lib/ai/rateLimit';
import { clientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Grounded assistant.
 *
 * ORDER MATTERS AND HAS NOT CHANGED: live membership figures first, then the
 * TNR Governance Handbook. When either answers, that answer is returned
 * verbatim — official facts about the organisation are never paraphrased by a
 * model, because on an official site an assistant that invents an answer about
 * TNR is worse than one that admits it does not know.
 *
 * WHAT IS NEW is what happens when NEITHER matches. That used to be a dead end
 * — "I could not find that" — which was accurate and useless, and which every
 * Roman Urdu question and every follow-up hit. Those now go to the AI with the
 * closest handbook entries as its source and an explicit instruction to say it
 * does not know rather than guess.
 *
 * The AI can only ever replace a refusal, never a handbook answer. If it is
 * unconfigured, rate limited or failing, the refusal comes back exactly as it
 * did before. See tryAi() at the bottom. */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
// "tnr" is NOT a stop word: it is the subject of the single most likely
// question ("what is tnr"), and dropping it left that query with no content
// words at all.
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'of', 'to', 'in', 'for', 'and', 'how',
  'what', 'do', 'does', 'i', 'can', 'you', 'me', 'my', 'on', 'at', 'it', 'be', 'with',
  'please', 'tell', 'there', 'that', 'this']);

/** Score an entry against the question: phrase hits count for far more than
 *  single shared words, which keeps "how many members" off "membership type". */
function score(entry, q) {
  const nq = norm(q);
  if (!nq) return 0;
  // Phrase matching runs regardless of stop words — bailing early when every
  // word was a stop word meant "what is tnr" scored zero.
  const words = nq.split(' ').filter(w => w && !STOP.has(w));
  let s = 0;
  for (const phrase of entry.q) {
    const p = norm(phrase);
    if (nq.includes(p)) s += p.includes(' ') ? 12 : 6;
    for (const w of words) if (p.includes(w) && w.length > 2) s += 1.5;
  }
  return s;
}

/** Questions about numbers are answered from the live database, not the KB. */
const asksForNumbers = (q) =>
  /(how many|number of|total|count|statistic|figures)/i.test(q) &&
  /(member|village|area|council|people)/i.test(q);

export async function POST(req) {
  const body = await readJson(req);
  const q = String(body.question || '').trim();
  if (!q) return ok({ answer: 'Ask me anything about TNR — membership, leadership or governance.', suggestions: SUGGESTIONS });
  if (q.length > MAX_QUESTION_CHARS)
    return fail('TOO_LONG', 400, { message: 'Please keep your question shorter.' });

  try {
    if (asksForNumbers(q)) {
      const s = await getMembershipStats();
      if (s.total === 0) {
        return ok({
          answer: 'No memberships have been approved yet, so there are no figures to report. ' +
                  'Membership registration is open — you are welcome to apply.',
          links: [['Apply for Membership', '/membership/apply']],
          source: 'Live membership records',
        });
      }
      const top = s.top5.slice(0, 3).map(r => `${r.area} (${r.members})`).join(', ');
      return ok({
        answer:
          `TNR currently has ${s.total} active member${s.total === 1 ? '' : 's'} across ` +
          `${s.totalAreas} village${s.totalAreas === 1 ? '' : 's'} and areas of Roundu.` +
          (top ? `\n\nThe areas with the most members are ${top}.` : ''),
        links: [['Members Analytics', '/members'], ['Roundu Statistics', '/statistics']],
        source: 'Live membership records',
      });
    }

    const ranked = ENTRIES.map(e => ({ e, s: score(e, q) })).sort((a, b) => b.s - a.s);
    const best = ranked[0];

    /* ── Nothing in the handbook matched ──
     *
     * This is where the AI earns its place. The handbook is exact but literal:
     * it misses Roman Urdu, follow-ups, and anything asked sideways, and it
     * answered all of those with "I could not find that", which is accurate
     * and useless.
     *
     * The model gets the CLOSEST handbook entries as its source and an
     * instruction to say it does not know rather than invent — so the original
     * guarantee holds. A confident answer from the handbook still wins above;
     * this only runs when the alternative was no answer at all. */
    if (!best || best.s < 6) {
      const ai = await tryAi(req, q, body.history, ranked);
      if (ai) return ok(ai);

      return ok({
        answer:
          'I can only answer questions about TNR — membership, leadership, governance and the ' +
          'election portal — and I could not find that in our published information.\n\n' +
          'Try rephrasing, or pick one of the suggestions below.',
        suggestions: SUGGESTIONS,
        unmatched: true,
      });
    }

    return ok({
      answer: best.e.answer(),
      links: best.e.links || [],
      source: 'TNR Governance Handbook',
      // Neighbouring topics, so a near-miss still leads somewhere useful.
      related: ranked.slice(1, 3).filter(r => r.s > 3).map(r => r.e.q[0]),
    });
  } catch (e) {
    return fail('ASK_FAILED', 500, { message: 'Sorry — something went wrong. Please try again.' });
  }
}


/* ── The AI fallback ──────────────────────────────────────────────────────
 *
 * Returns null on ANY problem — not configured, rate limited, model down,
 * empty reply. The caller then falls through to the original "I could not
 * find that" answer, so a failure here degrades to exactly the behaviour the
 * site had before AI existed. The assistant never shows an error where it
 * used to show a polite refusal.
 */
async function tryAi(req, q, history, ranked) {
  if (!aiConfigured()) return null;

  // Rate limited by IP. This route is PUBLIC and unauthenticated — without a
  // limit it is an open, billable text generator pointed at someone else's
  // quota.
  if (!allowAsk(clientIp(req) || 'anon')) return null;

  /* The closest handbook entries become the source, even though none scored
   * high enough to answer outright. A question the matcher rated 4 is usually
   * about the right topic and phrased unusually — which is precisely what a
   * language model is good at bridging. */
  const reference = ranked
    .filter(r => r.s > 1).slice(0, 4)
    .map(r => `- ${r.e.q[0]}: ${r.e.answer()}`)
    .join('\n')
    .slice(0, 4000);

  try {
    const text = await aiAnswer({ question: q, history: trimHistory(history), reference });
    if (!text) return null;
    return {
      answer: text,
      source: 'TNR AI Assistant',
      ai: true,
      suggestions: ranked.slice(0, 3).filter(r => r.s > 1).map(r => r.e.q[0]),
    };
  } catch {
    return null;      // fall through to the handbook's own refusal
  }
}

export async function GET() {
  return ok({ suggestions: SUGGESTIONS });
}
