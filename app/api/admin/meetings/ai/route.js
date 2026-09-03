import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { aiConfigured, MODELS, AiError, MAX_AUDIO_BYTES } from '@/lib/ai/provider';
import { allowMeetingAi } from '@/lib/ai/rateLimit';
import {
  transcribeAudio, summariseTranscript, summaryToMinutes,
  normaliseSummary, SUMMARY_LANGUAGES,
} from '@/lib/ai/meetingMinutes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/* Transcribing an hour of audio takes minutes, not seconds. Vercel's default
 * would abandon the request halfway and leave a row stuck at 'processing'. */
export const maxDuration = 300;

/* AI minutes for one meeting.
 *
 * NOTHING HERE RUNS AUTOMATICALLY. A meeting is transcribed only when an
 * authorised admin presses the button — because transcription is the most
 * expensive call in this application, and because a committee should decide
 * that its discussion gets machine-read, not have it happen by default.
 *
 * Reached under the `meetings` permission area, which already excludes admins
 * who only handle website content.
 */

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('meeting_id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const sb = supabaseAdmin();
  const [{ data: transcript }, { data: summaries }, { data: audio }] = await Promise.all([
    sb.from('meeting_transcripts').select('*').eq('meeting_id', id).maybeSingle(),
    sb.from('meeting_ai_summaries').select('*').eq('meeting_id', id)
      .order('created_at', { ascending: false }).limit(5),
    sb.from('meeting_recordings').select('id, file_url, status, is_audio_only, duration_seconds')
      .eq('meeting_id', id).eq('is_audio_only', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  return ok({
    configured: aiConfigured(),
    // The transcript can be tens of thousands of words. The list view only
    // needs to know it exists and how long it is.
    transcript: transcript
      ? { ...transcript, transcript_text: undefined, chars: (transcript.transcript_text || '').length }
      : null,
    summaries: summaries || [],
    audio: audio || null,
    languages: SUMMARY_LANGUAGES,
    models: { transcribe: MODELS.transcribe, summary: MODELS.reasoning },
  });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const id = String(b.meeting_id || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const { data: meeting } = await sb.from('meetings').select('*').eq('id', id).maybeSingle();
  if (!meeting) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // ── Read the full transcript (separate from GET, which omits it) ──
  if (b.action === 'get_transcript') {
    const { data } = await sb.from('meeting_transcripts')
      .select('transcript_text, language, segments').eq('meeting_id', id).maybeSingle();
    return ok({ transcript: data || null });
  }

  // ── Approve / discard / edit a draft ──
  if (b.action === 'set_review') {
    const status = ['draft', 'edited', 'approved', 'discarded'].includes(b.review_status)
      ? b.review_status : 'draft';
    if (!b.id) return fail('INVALID', 400, { message: 'Missing draft.' });

    const patch = { review_status: status, updated_at: new Date().toISOString() };
    if (b.summary_json) patch.summary_json = normaliseSummary(b.summary_json);
    if (status === 'approved') patch.approved_at = new Date().toISOString();

    const { data, error } = await sb.from('meeting_ai_summaries')
      .update(patch).eq('id', b.id).eq('meeting_id', id).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });

    /* Approving COPIES the draft into meeting_minutes, where the committee's
     * own record lives. The draft is kept alongside rather than replaced, so
     * an approved set of minutes can always be compared with what the model
     * originally proposed. */
    if (status === 'approved') {
      const fields = summaryToMinutes(data.summary_json);
      await sb.from('meeting_minutes').upsert({
        meeting_id: id,
        ...fields,
        status: 'draft',            // approved as an AI draft, still unpublished
        ai_generated: true,
        ai_summary_id: data.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'meeting_id' });
    }

    await logAudit({
      action: `MEETING_AI_${status.toUpperCase()}`, actor: admin?.username || 'admin',
      details: meeting.title?.slice(0, 200), ip: clientIp(req),
    });
    return ok({
      summary: data,
      message: status === 'approved'
        ? 'Approved and copied into the meeting minutes, ready to publish.'
        : 'Saved.',
    });
  }

  // ── Everything below spends money ──
  if (!aiConfigured())
    return fail('AI_NOT_CONFIGURED', 503, {
      message: 'The AI service is not configured. An administrator needs to add GROQ_API_KEY.',
    });

  if (!allowMeetingAi(admin?.username || clientIp(req) || 'anon'))
    return fail('RATE_LIMITED', 429, {
      message: 'Too many AI requests in a short time. Please wait a few minutes.',
    });

  // ── Transcribe ──
  if (b.action === 'transcribe') {
    /* The unique index on meeting_id is the real lock.
     *
     * Two admins pressing Generate at the same moment both pass any check
     * written in JavaScript; only one can insert this row. The loser is told
     * it is already running rather than starting a second hour of billable
     * transcription. */
    const { data: claimed, error: claimErr } = await sb.from('meeting_transcripts')
      .insert({
        meeting_id: id, status: 'processing',
        provider: 'groq', model: MODELS.transcribe,
        created_by: b.member_id || null,
      }).select('id').single();

    if (claimErr) {
      const { data: existing } = await sb.from('meeting_transcripts')
        .select('id, status').eq('meeting_id', id).maybeSingle();
      if (existing?.status === 'processing')
        return fail('IN_PROGRESS', 409, { message: 'Transcription is already running for this meeting.' });
      if (existing?.status === 'ready')
        return ok({ unchanged: true, message: 'This meeting has already been transcribed.' });
      return fail('CLAIM_FAILED', 500, { message: 'Could not start transcription.' });
    }

    try {
      const url = await audioUrlFor(sb, id, b.audio_url);
      const audio = await fetchAudio(url);
      const r = await transcribeAudio(audio);

      await sb.from('meeting_transcripts').update({
        transcript_text: r.text,
        language: r.language,
        segments: r.segments,
        duration_seconds: r.duration ? Math.round(r.duration) : null,
        status: 'ready',
        updated_at: new Date().toISOString(),
      }).eq('id', claimed.id);

      await logAudit({
        action: 'MEETING_TRANSCRIBED', actor: admin?.username || 'admin',
        details: `${meeting.title} — ${r.text.length} chars, ${r.language || 'auto'}`.slice(0, 200),
        ip: clientIp(req),
      });

      return ok({
        message: `Transcribed — ${Math.round(r.text.length / 5)} words, ${r.language || 'language auto-detected'}.`,
        language: r.language, chars: r.text.length,
      });
    } catch (e) {
      /* Record WHY it failed on the row, then delete it so the button can be
       * pressed again. A row left at 'processing' would block every future
       * attempt through the very lock that protects against duplicates. */
      await sb.from('meeting_transcripts')
        .update({ status: 'failed', error: String(e?.message || '').slice(0, 300) })
        .eq('id', claimed.id);
      await sb.from('meeting_transcripts').delete().eq('id', claimed.id).eq('status', 'failed');

      const err = e instanceof AiError ? e : null;
      return fail(err?.code || 'TRANSCRIBE_FAILED', err?.status || 502, {
        message: err?.message || 'Transcription failed. Please try again.',
      });
    }
  }

  // ── Summarise ──
  if (b.action === 'summarise') {
    const { data: t } = await sb.from('meeting_transcripts')
      .select('transcript_text, status').eq('meeting_id', id).maybeSingle();

    if (!t || t.status !== 'ready' || !t.transcript_text)
      return fail('NO_TRANSCRIPT', 409, {
        message: 'Transcribe the recording first — there is nothing to summarise yet.',
      });

    // Names, so the model spells them correctly. It is still forbidden from
    // assigning a task to anyone the transcript does not actually name.
    const { data: att } = await sb.from('meeting_attendance')
      .select('member_id').eq('meeting_id', id).gt('total_duration_seconds', 0);
    let names = [];
    if (att?.length) {
      const { data: mem } = await sb.from('membership_members')
        .select('full_name').in('id', att.map(a => a.member_id));
      names = (mem || []).map(m => m.full_name).filter(Boolean);
    }

    const language = SUMMARY_LANGUAGES[b.language] ? b.language : 'english';

    try {
      const summary = await summariseTranscript(t.transcript_text, {
        title: meeting.title,
        type: meeting.meeting_type,
        date: meeting.scheduled_at,
        participants: names,
      }, language);

      const { data: row, error } = await sb.from('meeting_ai_summaries').insert({
        meeting_id: id,
        summary_json: summary,
        language,
        provider: 'groq',
        model: MODELS.reasoning,
        review_status: 'draft',
        generated_by: b.member_id || null,
      }).select('*').single();
      if (error) return fail('SAVE_FAILED', 500, { message: 'Generated, but could not be saved.', detail: error.message });

      await logAudit({
        action: 'MEETING_AI_SUMMARY', actor: admin?.username || 'admin',
        details: meeting.title?.slice(0, 200), ip: clientIp(req),
      });

      return ok({ summary: row, message: 'Draft minutes generated. Review before approving.' });
    } catch (e) {
      const err = e instanceof AiError ? e : null;
      return fail(err?.code || 'SUMMARY_FAILED', err?.status || 502, {
        message: err?.message || 'Could not generate the minutes. Please try again.',
      });
    }
  }

  return fail('INVALID', 400, { message: 'Unknown action.' });
}

/* Which file to transcribe.
 *
 * The AUDIO-ONLY recording, not the video. See startAudioRecording() for why:
 * an hour of composite MP4 is far past what the speech endpoint accepts, and
 * there is no ffmpeg in this runtime to extract the audio from it. */
async function audioUrlFor(sb, meetingId, override) {
  if (override) return String(override);

  const { data } = await sb.from('meeting_recordings')
    .select('file_url, status').eq('meeting_id', meetingId).eq('is_audio_only', true)
    .eq('status', 'ready').order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (data?.file_url) return data.file_url;

  const { data: any } = await sb.from('meeting_recordings')
    .select('status').eq('meeting_id', meetingId).limit(1).maybeSingle();

  throw new AiError('NO_AUDIO', any
    ? 'This meeting has a video recording but no audio track to transcribe. '
      + 'Audio-only recording captures one automatically for meetings recorded from now on; '
      + 'for this meeting, upload an audio file instead.'
    : 'This meeting has no recording to transcribe.', 409);
}

async function fetchAudio(url) {
  let res;
  try { res = await fetch(url); }
  catch { throw new AiError('AUDIO_UNREACHABLE', 'The recording could not be downloaded.', 502); }
  if (!res.ok) throw new AiError('AUDIO_UNREACHABLE',
    `The recording could not be downloaded (${res.status}).`, 502);

  /* Check the declared size BEFORE reading the body into memory. A serverless
   * function has a few hundred MB of RAM; buffering a 1 GB file crashes the
   * invocation with no message anyone can act on. */
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared && declared > MAX_AUDIO_BYTES) {
    throw new AiError('AUDIO_TOO_LARGE',
      `The recording is ${(declared / 1024 / 1024).toFixed(0)} MB and the limit is `
      + `${(MAX_AUDIO_BYTES / 1024 / 1024).toFixed(0)} MB.`, 413);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const name = (url.split('?')[0].split('/').pop() || 'meeting.ogg');
  return {
    buffer,
    filename: name,
    mime: res.headers.get('content-type') || 'audio/ogg',
  };
}
