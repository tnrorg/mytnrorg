import { ENTRIES, SUGGESTIONS } from '@/lib/ai/knowledge';
import { getMembershipStats } from '@/lib/membershipStats';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Grounded assistant: answers come from the TNR Governance Handbook and live
// membership figures, never from a language model. On an official site an
// assistant that invents an answer about the organisation is worse than one
// that admits it does not know — so an unmatched question says so and offers
// a page or a human instead.

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
  const { question } = await readJson(req);
  const q = String(question || '').trim();
  if (!q) return ok({ answer: 'Ask me anything about TNR — membership, leadership or governance.', suggestions: SUGGESTIONS });
  if (q.length > 300) return fail('TOO_LONG', 400, { message: 'Please keep your question shorter.' });

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

    if (!best || best.s < 6) {
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

export async function GET() {
  return ok({ suggestions: SUGGESTIONS });
}
