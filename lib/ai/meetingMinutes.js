import 'server-only';
import { chat, transcribe, MODELS, MAX_AUDIO_BYTES, AiError } from './provider';

/* Turning a recording into a draft set of minutes.
 *
 * TWO STEPS, both server side:
 *   audio  → Whisper       → transcript, in the language it was spoken
 *   transcript → text model → structured minutes
 *
 * The output is a DRAFT and is labelled one everywhere it appears. A committee
 * adopts its minutes; software does not. Nothing here writes to the published
 * minutes — it fills a draft that a human edits and approves.
 */

/* Names Whisper would otherwise mangle.
 *
 * Without a hint, "Roundu" comes back as "Rondo" or "around you", and
 * "Tehreek-e-Nojawanan" as approximate English. A short prompt of proper nouns
 * costs nothing and fixes most of it. */
const VOCAB_HINT =
  'Tehreek-e-Nojawanan Roundu, TNR, Roundu, Gilgit-Baltistan, Skardu, '
  + 'Central Executive Committee, Advisory Council, Union Council, '
  + 'Quaid-e-Azam Fellowship, membership, quorum, agenda, minutes.';

/**
 * Transcribe one audio file.
 *
 * Language is deliberately NOT pinned. TNR meetings switch between Urdu and
 * English inside a single sentence, and telling Whisper the language makes it
 * translate rather than transcribe — which loses the exact words a committee
 * needs quoted back. Auto-detection keeps the meeting in the language it
 * actually happened in.
 */
export async function transcribeAudio({ buffer, filename = 'meeting.ogg', mime = 'audio/ogg' }) {
  if (!buffer?.byteLength) throw new AiError('AUDIO_EMPTY', 'The recording is empty.', 400);

  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    const mb = (buffer.byteLength / 1024 / 1024).toFixed(0);
    const cap = (MAX_AUDIO_BYTES / 1024 / 1024).toFixed(0);
    throw new AiError('AUDIO_TOO_LARGE',
      `The recording is ${mb} MB and the transcription service accepts about ${cap} MB. `
      + 'Long meetings need to be split before they can be transcribed.', 413);
  }

  const file = new File([buffer], filename, { type: mime });
  const r = await transcribe({ file, prompt: VOCAB_HINT });

  if (!r.text) throw new AiError('TRANSCRIPT_EMPTY',
    'Nothing could be heard in the recording — it may be silent or corrupted.', 422);

  return r;
}

/* The shape the summariser must return. Kept as a constant so the prompt, the
 * validator and the UI cannot drift apart. */
export const SUMMARY_SHAPE = {
  title: '',
  summary: '',
  key_discussions: [],
  decisions: [],
  action_items: [],          // { task, assigned_to, deadline }
  unresolved_issues: [],
  important_dates: [],
  follow_up_required: [],
};

export const UNCLEAR = 'Not clearly stated';

/* The instruction that decides whether these minutes are usable.
 *
 * A model asked to summarise a meeting will confidently produce decisions
 * nobody made and assign tasks to people who never spoke — because a tidy set
 * of minutes is what "summarise a meeting" looks like in its training data.
 * The prompt therefore spends most of its words on what NOT to produce, and
 * gives an explicit escape hatch, because a model with no way to say "unclear"
 * will invent rather than leave a field empty.
 */
function summaryPrompt(language) {
  return `
You produce DRAFT meeting minutes for Tehreek-e-Nojawanan Roundu (TNR), a
youth organisation in Roundu, Gilgit-Baltistan. A human secretary will review
and correct everything you write before it becomes official.

WHAT YOU MUST NOT DO — these matter more than completeness:
- Do NOT invent decisions. If the transcript does not clearly record a
  decision, do not record one.
- Do NOT invent names. Only name a person if the transcript names them.
- Do NOT invent deadlines or dates. Only give a date the transcript states.
- Do NOT assign an action item to someone unless the transcript says so.
- Do NOT infer votes, agreement or approval that was not spoken.
- Do NOT smooth over confusion. If a discussion ended unresolved, that belongs
  in unresolved_issues, not in decisions.

When something is unclear, write exactly "${UNCLEAR}" instead of guessing.
For assigned_to and deadline, use null when the transcript does not say.
An empty array is a correct answer. Short and true beats full and invented.

LANGUAGE: write the minutes in ${language}. The transcript may be in Urdu,
English, Roman Urdu or a mixture — read all of it either way. Keep proper
nouns and any quoted wording as spoken.

Return ONLY a JSON object with exactly these keys:
{
  "title": "a short factual title for this meeting",
  "summary": "one paragraph on what the meeting covered and what came of it",
  "key_discussions": ["the substance of what was discussed"],
  "decisions": ["only decisions actually taken"],
  "action_items": [{ "task": "", "assigned_to": null, "deadline": null }],
  "unresolved_issues": ["raised but not settled"],
  "important_dates": ["dates stated in the meeting"],
  "follow_up_required": ["what needs to happen before the next meeting"]
}`.trim();
}

export const SUMMARY_LANGUAGES = {
  english: 'English',
  urdu: 'Urdu (Urdu script)',
  both: 'English, with an Urdu translation of the summary field appended after it',
};

/**
 * Transcript → structured draft minutes.
 *
 * @param {string} transcript
 * @param {object} ctx  { title, type, date, participants } — helps the model
 *                      get names right without it having to guess them
 * @param {string} language  key of SUMMARY_LANGUAGES
 */
export async function summariseTranscript(transcript, ctx = {}, language = 'english') {
  const text = String(transcript || '').trim();
  if (!text) throw new AiError('TRANSCRIPT_EMPTY', 'There is no transcript to summarise.', 400);

  /* Long meetings get the END of the transcript, not the start.
   *
   * Decisions and action items are made at the end; the opening is
   * pleasantries and apologies for absence. Truncating from the front would
   * throw away precisely the part the minutes are for. */
  const LIMIT = 90_000;
  const body = text.length > LIMIT
    ? `[earlier part of the meeting omitted for length]\n\n${text.slice(-LIMIT)}`
    : text;

  /* The attendance list is given as context so the model can MATCH names it
   * hears, not so it can pick one. The prompt still forbids assigning a task
   * to anyone the transcript does not name. */
  const context = [
    ctx.title ? `Meeting: ${ctx.title}` : '',
    ctx.type ? `Type: ${ctx.type}` : '',
    ctx.date ? `Date: ${ctx.date}` : '',
    ctx.participants?.length
      ? `People present (for spelling names correctly — do not assign tasks to anyone the transcript does not name): ${ctx.participants.join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const raw = await chat({
    system: summaryPrompt(SUMMARY_LANGUAGES[language] || SUMMARY_LANGUAGES.english),
    messages: [{ role: 'user', content: `${context}\n\nTRANSCRIPT:\n${body}` }],
    model: MODELS.reasoning,
    maxTokens: 2400,
    temperature: 0.1,        // as close to deterministic as this gets
    json: true,
  });

  return normaliseSummary(raw);
}

/* Never trust the shape that comes back.
 *
 * response_format json_object guarantees valid JSON, not the right keys — a
 * model can and does return a string where an array belongs, or drop a field
 * entirely. Coercing here means the UI renders a partial answer instead of
 * throwing on `.map` of undefined. */
export function normaliseSummary(raw) {
  let o;
  try { o = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); }
  catch { throw new AiError('SUMMARY_UNREADABLE', 'The AI returned something unreadable. Try again.', 502); }

  const arr = (v) => Array.isArray(v)
    ? v.map(x => String(x ?? '').trim()).filter(Boolean)
    : (v ? [String(v).trim()] : []);

  const actions = Array.isArray(o.action_items) ? o.action_items : [];

  return {
    title: String(o.title || '').trim().slice(0, 200),
    summary: String(o.summary || '').trim(),
    key_discussions: arr(o.key_discussions),
    decisions: arr(o.decisions),
    action_items: actions.map(a => ({
      task: String(a?.task || a?.title || '').trim(),
      // "Not clearly stated" is normalised to null — a null renders as
      // "Unassigned", which is the truth, whereas the phrase in a name column
      // looks like somebody is called that.
      assigned_to: clean(a?.assigned_to),
      deadline: clean(a?.deadline),
    })).filter(a => a.task),
    unresolved_issues: arr(o.unresolved_issues),
    important_dates: arr(o.important_dates),
    follow_up_required: arr(o.follow_up_required),
  };
}

function clean(v) {
  const s = String(v ?? '').trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === UNCLEAR.toLowerCase()) return null;
  return s.slice(0, 160);
}

/** Draft minutes → the three text fields meeting_minutes already has. */
export function summaryToMinutes(s) {
  const bullets = (list) => list.map(x => `• ${x}`).join('\n');
  return {
    summary: s.summary || '',
    key_discussion: bullets(s.key_discussions),
    decisions: [
      bullets(s.decisions),
      s.unresolved_issues.length ? `\nUnresolved:\n${bullets(s.unresolved_issues)}` : '',
      s.follow_up_required.length ? `\nFollow-up required:\n${bullets(s.follow_up_required)}` : '',
    ].filter(Boolean).join('\n'),
  };
}
