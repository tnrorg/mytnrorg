import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseServer';

/* "Who is the Technical Coordinator?"
 *
 * WHY THIS EXISTS: the Governance Handbook describes what the Central
 * Executive Committee and the Advisory Council ARE — it contains no names,
 * because names change and a handbook baked into the code would go stale the
 * first time someone was elected. So every question about who holds a post
 * fell through to "I could not find that", which is the single most obvious
 * thing to ask an assistant on an organisation's website.
 *
 * The names live in leadership_profiles and are maintained by an admin. This
 * reads them live, the same way membership figures are read live. It is not an
 * AI answer and does not go near the model: an office bearer is a fact, and a
 * fact the database already holds should never be paraphrased by a model that
 * might get it wrong.
 *
 * PUBLIC-SAFE. Only the fields already published on /about/executive-committee
 * and /about/advisory-council are read — no contact details, no member record.
 */

const PUBLIC_FIELDS = 'name, designation, body, qualification, field, affiliation, summary, slug';

/* Does this look like a question about who holds a position?
 *
 * Two halves, both required. "Who is" alone matches "who is eligible to join";
 * a designation word alone matches "what does the president do", which the
 * handbook answers better. Needing both keeps this narrow. */
const ASKS_WHO = /\b(who|kon|kaun|kis|naam|name of)\b/i;
const ROLE_WORDS = new RegExp([
  'president', 'vice president', 'chairman', 'chairperson',
  'secretary', 'general secretary', 'joint secretary',
  'treasurer', 'finance secretary',
  'coordinator', 'co-ordinator', 'technical', 'information', 'media',
  'organiser', 'organizer', 'spokesperson',
  'convener', 'convenor', 'advisor', 'adviser',
  'office bearer', 'office holder', 'head of', 'in charge', 'incharge',
  'cec', 'executive committee', 'advisory council', 'leadership',
  'sadar', 'sarparast', 'nazim',      // Urdu / Roman Urdu
].join('|'), 'i');

export const asksAboutLeadership = (q) => ASKS_WHO.test(q) && ROLE_WORDS.test(q);

/**
 * Answer from the live leadership table.
 *
 * Returns null when nothing sensible matches, so the caller falls through to
 * the handbook and then to the AI — this never blocks a better answer.
 */
export async function lookupLeadership(question) {
  let rows;
  try {
    const { data } = await supabaseAdmin().from('leadership_profiles')
      .select(PUBLIC_FIELDS).eq('active', true)
      .order('body').order('sort_order');
    rows = data || [];
  } catch {
    return null;                       // table missing or unreachable
  }
  if (!rows.length) return null;

  const q = String(question).toLowerCase();

  /* Score each profile on how much of its designation the question contains.
   *
   * Word-by-word rather than whole-string, because "technical coordinator" and
   * "coordinator technical" and "technical co-ordinator" are the same question
   * and an exact match would catch only one of them. */
  const scored = rows.map(r => {
    const d = String(r.designation || '').toLowerCase();
    if (!d) return { r, s: 0 };
    if (q.includes(d)) return { r, s: 100 };            // whole title present
    const words = d.split(/[^a-z]+/).filter(w => w.length > 3);
    const hits = words.filter(w => q.includes(w)).length;
    return { r, s: words.length ? (hits / words.length) * 60 + hits * 8 : 0 };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);

  const best = scored[0];

  /* A specific post was asked about and matched well. */
  if (best && best.s >= 45) {
    const p = best.r;
    const body = p.body === 'advisory' ? 'Advisory Council' : 'Central Executive Committee';
    const href = p.body === 'advisory' ? '/about/advisory-council' : '/about/executive-committee';

    /* A vacant post is a real answer and must be given as one. Saying nothing
     * would look like the assistant is broken; inventing a holder would be
     * far worse. */
    if (!p.name || !p.name.trim()) {
      return {
        answer: `The position of ${p.designation} (${body}) is currently vacant — no one has been `
          + `announced for it yet. You can see the full ${body} on the leadership page.`,
        links: [[body, href]],
        source: 'TNR leadership records',
      };
    }

    const extra = [
      p.qualification, p.field, p.affiliation,
    ].filter(Boolean).join(', ');

    return {
      answer: `${p.name} is the ${p.designation} of TNR${p.body === 'advisory' ? "'s Advisory Council" : "'s Central Executive Committee"}.`
        + (extra ? `\n\n${p.name.split(' ')[0]} — ${extra}.` : '')
        + (p.summary ? `\n\n${p.summary}` : ''),
      links: [[body, href]],
      source: 'TNR leadership records',
    };
  }

  /* No single post matched, but they clearly asked about a body — list it.
   * "Who is in the Advisory Council" is a reasonable question and the roster
   * is the answer. */
  const wantsBody = /advisory/i.test(q) ? 'advisory'
    : /(executive|cec)/i.test(q) ? 'executive' : null;

  if (wantsBody) {
    const list = rows.filter(r => r.body === wantsBody && r.name?.trim());
    if (!list.length) return null;

    const body = wantsBody === 'advisory' ? 'Advisory Council' : 'Central Executive Committee';
    const href = wantsBody === 'advisory' ? '/about/advisory-council' : '/about/executive-committee';

    return {
      answer: `The TNR ${body} currently has ${list.length} member${list.length === 1 ? '' : 's'}:\n\n`
        + list.slice(0, 12).map(r => `• ${r.name}${r.designation ? ` — ${r.designation}` : ''}`).join('\n')
        + (list.length > 12 ? `\n\n…and ${list.length - 12} more on the ${body} page.` : ''),
      links: [[body, href]],
      source: 'TNR leadership records',
    };
  }

  return null;
}

/** The same facts, as compact text the AI can be given as source material. */
export async function leadershipContext() {
  try {
    const { data } = await supabaseAdmin().from('leadership_profiles')
      .select('name, designation, body').eq('active', true)
      .order('body').order('sort_order').limit(60);
    if (!data?.length) return '';
    return data
      .filter(r => r.designation)
      .map(r => `${r.designation} (${r.body === 'advisory' ? 'Advisory Council' : 'CEC'}): ${r.name || 'vacant'}`)
      .join('\n');
  } catch { return ''; }
}
