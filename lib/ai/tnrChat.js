import 'server-only';
import { chat, MODELS } from './provider';

/* The TNR AI Assistant — the words it is given, and the limits on them.
 *
 * THIS IS A FALLBACK, NOT A REPLACEMENT. /api/public/ask still answers from
 * the Governance Handbook first, and that answer wins whenever there is one.
 * The model is reached only when the handbook has nothing to match — the
 * Roman Urdu phrasings, the follow-ups, the questions asked sideways — and
 * even then the matched handbook text is handed to it as the source.
 *
 * That ordering is the whole design. The original route carried a deliberate
 * decision: on an official site an assistant that invents an answer about the
 * organisation is worse than one that admits it does not know. Putting a
 * language model in front of the handbook would have thrown that away. Putting
 * it behind keeps the guarantee and fixes the cases where the handbook simply
 * said nothing useful.
 */

const IDENTITY = `
You are the TNR AI Assistant on the official website of Tehreek-e-Nojawanan
Roundu (TNR), a youth organisation in Roundu, Gilgit-Baltistan, Pakistan.

You help visitors and members understand and navigate the TNR Digital
Platform: the organisation itself, membership and how to join, the Member
Portal, the Central Executive Committee, the Advisory Council, Union Council
teams, opportunities, scholarships and fellowships, events, announcements,
meetings in the TNR Virtual Hall, the digital membership card, volunteering,
and where to find things on the site.`.trim();

/* The rule that matters most, stated first and stated bluntly.
 *
 * A model asked to "be helpful" about an organisation it knows nothing about
 * will produce fluent, confident, wrong governance. The instruction has to be
 * about what NOT to do, and it has to give an acceptable alternative — "say
 * you don't know and point at a page" — or the model will fill the gap anyway. */
const GROUNDING = `
ABSOLUTE RULES — these override helpfulness:

1. NEVER invent facts about TNR. Not office bearers, not dates, not fees, not
   rules, not eligibility criteria, not statistics, not deadlines.
2. Answer ONLY from the TNR REFERENCE below and the conversation. If the
   reference does not cover it, say plainly that you do not have that detail
   and point the person to the relevant page or to Contact Us.
3. Never guess a number. If you were not given a figure, do not produce one.
4. Never state who currently holds a position unless the reference says so.
5. You cannot see any member's private record. Never claim to know someone's
   membership status, application, or personal details. If asked, tell them to
   sign in to the Member Portal, where their own record is shown.
6. Never ask for or repeat a password, CNIC, or payment detail.

If the reference is empty, you may still help with general navigation and
process questions in a way that is obviously generic, and say that the exact
detail should be confirmed on the site or with the office.`.trim();

const STYLE = `
LANGUAGE — match the person:
- English question, English answer.
- Urdu script question, Urdu script answer.
- Roman Urdu question, Roman Urdu answer. This matters: most TNR members write
  Roman Urdu, and replying in formal Urdu script or English reads as being
  corrected. Write the way they wrote.
- Mixed Urdu and English, reply the same way.

TONE: warm, brief, practical. Two or three short sentences is usually right.
This is a youth organisation, not a bank — do not be stiff, and do not pad an
answer to look thorough. When a page on the site answers it, name the page.`.trim();

export function buildSystemPrompt({ reference, memberContext, stats }) {
  return [
    IDENTITY,
    GROUNDING,
    STYLE,
    stats ? `\nLIVE TNR FIGURES (accurate as of now):\n${stats}` : '',
    reference ? `\nTNR REFERENCE (the handbook material closest to this question):\n${reference}`
      : '\nTNR REFERENCE: (nothing matched — be explicit that you do not have the detail)',
    /* Member context is added ONLY for a signed-in member asking about their
     * own record, and carries no contact details. See the route. */
    memberContext ? `\nTHE SIGNED-IN MEMBER ASKING (their own record, safe to discuss with them):\n${memberContext}`
      : '',
  ].filter(Boolean).join('\n\n');
}

/**
 * Ask the model, with the handbook as its source.
 *
 * @param {object}   o
 * @param {string}   o.question
 * @param {Array}    o.history   recent turns, already trimmed by the caller
 * @param {string}   o.reference handbook entries the matcher found
 * @param {string}   [o.memberContext]
 * @param {string}   [o.stats]
 */
export async function answer({ question, history = [], reference, memberContext, stats }) {
  const text = await chat({
    system: buildSystemPrompt({ reference, memberContext, stats }),
    messages: [...history, { role: 'user', content: question }],
    model: MODELS.chat,
    maxTokens: 420,          // a website answer, not an essay
    temperature: 0.25,       // low: this is factual territory
  });
  return text;
}

/* How much of the conversation goes to the model.
 *
 * Six turns is enough for "and what about the fees?" to make sense, and small
 * enough that a long session cannot grow the prompt without limit — which is
 * both a cost problem and a way to push the system rules out of the model's
 * attention. Content is clamped too, so one pasted essay cannot fill it. */
export const HISTORY_TURNS = 6;
export const MAX_QUESTION_CHARS = 500;

export function trimHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-HISTORY_TURNS)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 600) }));
}
