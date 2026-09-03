import 'server-only';
import Groq from 'groq-sdk';

/* THE AI PROVIDER — one place, server only.
 *
 * GROQ_API_KEY is read here and nowhere else. It is never sent to the browser,
 * never embedded in a page, and there is no NEXT_PUBLIC_ variant of it. Every
 * AI call in this project goes through this file.
 *
 * WHY AN ABSTRACTION RATHER THAN CALLING GROQ DIRECTLY
 * The interface below is `chat()` and `transcribe()` — deliberately the shape
 * that OpenAI, Together, Anthropic and a self-hosted vLLM all expose too. When
 * TNR outgrows Groq's free tier, or Groq retires a model, the swap is this
 * file. Nothing in the routes or the UI names a vendor.
 *
 * MODELS ARE CONFIGURED, NOT HARD-CODED. Groq deprecates models on a few
 * weeks' notice; a model id compiled into six components is six emergencies.
 * Set them in the environment, and the fallbacks below are the current
 * production ids so the site keeps working if nobody does.
 */

let _client;
function client() {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AiError('AI_NOT_CONFIGURED',
    'The AI service is not configured. An administrator needs to add the API key.');
  _client = new Groq({ apiKey, maxRetries: 1, timeout: 30_000 });
  return _client;
}

export const aiConfigured = () => !!process.env.GROQ_API_KEY;

export const MODELS = {
  // Fast and cheap; enough for a website assistant answering from context.
  chat: process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant',
  // Larger, for structuring a whole meeting transcript into minutes.
  reasoning: process.env.GROQ_SUMMARY_MODEL || 'llama-3.3-70b-versatile',
  // Turbo is ~4x faster at a small accuracy cost. Meetings here are mixed
  // Urdu/English, where the larger model is noticeably better at code-switching,
  // so accuracy wins for transcription and speed wins for chat.
  transcribe: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3',
};

/** One error type, so routes can map a cause to a message a person can act on. */
export class AiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/* Turn whatever the SDK throws into something the UI can say out loud.
 * "Request failed with status code 429" helps nobody; "the assistant is busy,
 * try again in a minute" tells a member what to do. */
function wrap(e) {
  if (e instanceof AiError) return e;
  const status = e?.status || e?.response?.status;
  if (status === 401 || status === 403) return new AiError('AI_KEY_REJECTED',
    'The AI service rejected our credentials. An administrator needs to check the API key.', 502);
  if (status === 429) return new AiError('AI_RATE_LIMITED',
    'The assistant is busy right now. Please try again in a minute.', 429);
  if (status === 413) return new AiError('AI_TOO_LARGE',
    'That is too large to process in one go.', 413);
  if (/timeout|ETIMEDOUT|aborted/i.test(e?.message || '')) return new AiError('AI_TIMEOUT',
    'The assistant took too long to respond. Please try again.', 504);
  if (/model.*(not found|decommissioned|deprecated)/i.test(e?.message || ''))
    return new AiError('AI_MODEL_GONE',
      'The configured AI model is no longer available. An administrator needs to update it.', 502);
  return new AiError('AI_FAILED', 'The assistant is unavailable right now. Please try again.', 502);
}

/**
 * Chat completion.
 *
 * @param {object}   o
 * @param {string}   o.system      the instruction block
 * @param {Array}    o.messages    [{ role: 'user'|'assistant', content }]
 * @param {string}   [o.model]
 * @param {number}   [o.maxTokens]
 * @param {boolean}  [o.json]      ask for a JSON object back
 */
export async function chat({ system, messages, model, maxTokens = 700, temperature = 0.3, json = false }) {
  try {
    const res = await client().chat.completions.create({
      model: model || MODELS.chat,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: maxTokens,
      // Low by default. This assistant answers questions about an
      // organisation's rules; invention is the failure mode to avoid, not
      // dullness.
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    });
    return res.choices?.[0]?.message?.content?.trim() || '';
  } catch (e) { throw wrap(e); }
}

/**
 * Speech to text.
 *
 * `verbose_json` returns segments with timestamps, which is what lets a long
 * recording be stitched back together in order. `language` is deliberately
 * left unset unless asked: TNR meetings switch between Urdu and English
 * mid-sentence, and pinning a language makes Whisper translate rather than
 * transcribe — which loses exactly the words a committee needs quoted.
 *
 * @param {object} o
 * @param {File|Blob} o.file
 * @param {string} [o.language]  ISO code, only when the meeting really is
 *                               single-language and accuracy matters more
 */
export async function transcribe({ file, language, prompt, model }) {
  try {
    const res = await client().audio.transcriptions.create({
      file,
      model: model || MODELS.transcribe,
      response_format: 'verbose_json',
      ...(language ? { language } : {}),
      // A hint improves proper nouns enormously — without it "Roundu" and
      // "Nojawanan" come back as approximate English words.
      ...(prompt ? { prompt } : {}),
    });
    return {
      text: String(res.text || '').trim(),
      language: res.language || null,
      duration: res.duration || null,
      segments: (res.segments || []).map(s => ({
        start: s.start, end: s.end, text: String(s.text || '').trim(),
      })),
    };
  } catch (e) { throw wrap(e); }
}

/* Groq's upload ceiling. 25 MB on the free tier, 100 MB on paid.
 * Checked before the request so an oversized file gets an explanation
 * instead of a 413 from someone else's server. */
export const MAX_AUDIO_BYTES = Number(process.env.GROQ_MAX_AUDIO_MB || 24) * 1024 * 1024;
