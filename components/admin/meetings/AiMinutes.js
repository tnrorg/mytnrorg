'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet, aPost } from '../adminApi';
import { fmtDateTime } from '@/lib/meetings';

const L = { deep: '#063D2B', green: '#0B6B4F', goldInk: '#7A5D10' };
const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

/* AI draft minutes.
 *
 * THE WORD "DRAFT" IS EVERYWHERE ON THIS SCREEN, deliberately. A committee
 * adopts its minutes; software does not. Nothing generated here reaches the
 * published record until a person has read it, edited what is wrong and
 * pressed Approve — and even then it lands in Minutes as a draft to publish.
 *
 * Two separate steps rather than one button, because they cost differently and
 * fail differently: transcription is the expensive call and runs once,
 * summarising is cheap and can be re-run in a different language without
 * touching the audio again.
 */
export default function AiMinutes({ meetingId, toast, onApplied }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState('');
  const [lang, setLang] = useState('english');
  const [open, setOpen] = useState(null);       // summary id being edited
  const [draft, setDraft] = useState(null);
  const [transcript, setTranscript] = useState(null);

  const load = useCallback(() => {
    aGet(`/api/admin/meetings/ai?meeting_id=${meetingId}`).then(r => setD(r?.ok ? r : null));
  }, [meetingId]);
  useEffect(() => { load(); }, [load]);

  const post = async (body, key) => {
    setBusy(key || body.action);
    const r = await aPost('/api/admin/meetings/ai', { meeting_id: meetingId, ...body });
    setBusy('');
    toast?.(r.ok ? r.message : (r.message || 'Something went wrong.'), r.ok ? 'ok' : 'err');
    if (r.ok) load();
    return r;
  };

  if (!d) return <p className="py-8 text-center text-sm text-gray-400">Loading…</p>;

  if (!d.configured) return (
    <Notice title="AI is not configured">
      An administrator needs to add <code className="rounded bg-gray-100 px-1">GROQ_API_KEY</code> to
      the site environment. Everything else on this page works without it.
    </Notice>
  );

  const t = d.transcript;
  const latest = d.summaries?.[0];

  return (
    <div className="space-y-5">
      {/* ── Step 1: transcribe ── */}
      <section className="rounded-xl border border-gray-200 p-4">
        <Step n={1} title="Transcribe the recording" done={t?.status === 'ready'} />

        {t?.status === 'ready' ? (
          <div className="mt-2 space-y-2">
            <p className="text-[13px] text-gray-600">
              Transcribed — about <strong>{Math.round((t.chars || 0) / 5).toLocaleString()} words</strong>
              {t.language ? `, detected as ${t.language}` : ''}
              {t.duration_seconds ? `, ${Math.round(t.duration_seconds / 60)} minutes of audio` : ''}.
            </p>
            <button
              onClick={async () => {
                if (transcript) return setTranscript(null);
                const r = await post({ action: 'get_transcript' }, 'transcript');
                if (r?.ok) setTranscript(r.transcript?.transcript_text || '');
              }}
              className="text-[12.5px] font-semibold underline" style={{ color: L.green }}>
              {transcript ? 'Hide transcript' : 'Read the transcript'}
            </button>
            {transcript !== null && (
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3
                text-[12.5px] leading-relaxed text-gray-700">{transcript}</pre>
            )}
          </div>
        ) : !d.audio ? (
          /* THE ACTUAL REASON, not one plausible reason for all three cases.
           *
           * This used to say "older recordings are video only" whatever had
           * happened, which is wrong two times out of three — and it is the
           * wrong kind of wrong, because it describes a situation nobody can
           * fix and hides two that are fixed in five minutes. An administrator
           * read it and concluded the AI was broken when nothing had ever been
           * recorded at all. */
          <NoAudio d={d} />
        ) : d.audio.status !== 'ready' ? (
          <p className="mt-2 text-[13px] text-gray-500">
            The audio is still being processed by the meeting server. This usually takes a few
            minutes after a meeting ends.
          </p>
        ) : (
          <div className="mt-2">
            <button onClick={() => post({ action: 'transcribe' })} disabled={!!busy}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: L.green }}>
              {busy === 'transcribe' ? 'Transcribing… this can take a few minutes' : 'Transcribe recording'}
            </button>
            <p className="mt-1.5 text-[11.5px] text-gray-500">
              Runs once per meeting. Urdu, English and mixed speech are all transcribed in the
              language they were spoken — nothing is translated.
            </p>
          </div>
        )}
      </section>

      {/* ── Step 2: summarise ── */}
      <section className="rounded-xl border border-gray-200 p-4">
        <Step n={2} title="Generate draft minutes" done={!!latest} />

        {t?.status !== 'ready' ? (
          <p className="mt-2 text-[13px] text-gray-500">Transcribe the recording first.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={lang} onChange={e => setLang(e.target.value)}
              className={`${input} w-auto`}>
              {Object.entries(d.languages || {}).map(([k, v]) => (
                <option key={k} value={k}>{k === 'both' ? 'English + Urdu' : cap(k)}</option>
              ))}
            </select>
            <button onClick={() => post({ action: 'summarise', language: lang })} disabled={!!busy}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: L.green }}>
              {busy === 'summarise' ? 'Writing…' : latest ? 'Generate again' : 'Generate draft minutes'}
            </button>
          </div>
        )}
      </section>

      {/* ── The drafts ── */}
      {d.summaries?.map(s => (
        <SummaryCard key={s.id} s={s} busy={busy}
          editing={open === s.id}
          draft={open === s.id ? draft : null}
          onEdit={() => { setOpen(s.id); setDraft(structuredClone(s.summary_json)); }}
          onCancel={() => { setOpen(null); setDraft(null); }}
          onChange={setDraft}
          onSave={async (status) => {
            const r = await post({
              action: 'set_review', id: s.id,
              review_status: status,
              ...(draft ? { summary_json: draft } : {}),
            }, s.id);
            if (r?.ok) { setOpen(null); setDraft(null); onApplied?.(); }
          }} />
      ))}
    </div>
  );
}

function SummaryCard({ s, busy, editing, draft, onEdit, onCancel, onChange, onSave }) {
  const j = editing ? draft : s.summary_json;
  if (!j) return null;

  const approved = s.review_status === 'approved';
  const set = (k, v) => onChange({ ...draft, [k]: v });

  return (
    <section className="rounded-xl border-2 p-4"
      style={{ borderColor: approved ? '#A7F3D0' : '#FDE68A', background: approved ? '#F0FDF4' : '#FFFBEB' }}>

      {/* The label a reader must not be able to miss. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
          style={approved
            ? { background: 'rgba(11,107,79,.14)', color: L.green }
            : { background: 'rgba(215,174,74,.22)', color: L.goldInk }}>
          {approved ? '✓ Approved — copied to Minutes' : '⚠ AI generated draft — not official'}
        </span>
        <span className="text-[11.5px] text-gray-500">
          {fmtDateTime(s.created_at)} · {s.language} · {s.model}
        </span>
      </div>

      {!approved && (
        <p className="mb-3 text-[12.5px] leading-relaxed text-gray-600">
          Written by an AI from the recording. It has been instructed not to invent decisions,
          names or deadlines, and to write <em>&ldquo;Not clearly stated&rdquo;</em> where the
          discussion was unclear — but it can still be wrong. Read it against the transcript
          before approving.
        </p>
      )}

      <Field label="Title" v={j.title} editing={editing} onChange={v => set('title', v)} />
      <Field label="Summary" v={j.summary} editing={editing} rows={4} onChange={v => set('summary', v)} />

      <List label="Key discussions" items={j.key_discussions} editing={editing}
        onChange={v => set('key_discussions', v)} />
      <List label="Decisions" items={j.decisions} editing={editing}
        onChange={v => set('decisions', v)} empty="No decisions were recorded." />

      <div className="mt-3">
        <Label>Action items</Label>
        {!j.action_items?.length ? <Empty>No action items were recorded.</Empty> : (
          <ul className="space-y-1.5">
            {j.action_items.map((a, i) => (
              <li key={i} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px]">
                <div className="font-semibold text-gray-800">{a.task}</div>
                <div className="text-[11.5px] text-gray-500">
                  {/* null renders as "Unassigned", which is the truth. The model
                      was told to use null rather than guess a name. */}
                  {a.assigned_to || 'Unassigned'}
                  {a.deadline ? ` · due ${a.deadline}` : ' · no deadline stated'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <List label="Unresolved issues" items={j.unresolved_issues} editing={editing}
        onChange={v => set('unresolved_issues', v)} empty="Nothing recorded as unresolved." />
      <List label="Important dates" items={j.important_dates} editing={editing}
        onChange={v => set('important_dates', v)} empty="No dates were stated." />
      <List label="Follow-up required" items={j.follow_up_required} editing={editing}
        onChange={v => set('follow_up_required', v)} empty="No follow-up recorded." />

      {!approved && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
          {editing ? (
            <>
              <button onClick={() => onSave('edited')} disabled={!!busy}
                className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: L.green }}>
                {busy === s.id ? 'Saving…' : 'Save draft'}
              </button>
              <button onClick={onCancel}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={onEdit}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700
                  hover:bg-white">
                Edit
              </button>
              <button
                onClick={() => confirm(
                  'Approve these minutes?\n\n'
                  + 'They will be copied into the meeting Minutes tab as a draft, ready for you to '
                  + 'publish. Approve only after reading them against the transcript.'
                ) && onSave('approved')}
                disabled={!!busy}
                className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: L.green }}>
                {busy === s.id ? 'Working…' : 'Approve minutes'}
              </button>
              <button onClick={() => confirm('Discard this draft?') && onSave('discarded')}
                disabled={!!busy}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600
                  hover:bg-red-50 disabled:opacity-40">
                Discard
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Bits ────────────────────────────────────────────────────────────────── */
const Label = ({ children }) => (
  <div className="mb-1 mt-3 text-[11px] font-black uppercase tracking-wider text-gray-400">{children}</div>
);
const Empty = ({ children }) => <p className="text-[13px] italic text-gray-400">{children}</p>;

function Field({ label, v, editing, rows, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      {editing
        ? (rows
          ? <textarea rows={rows} value={v || ''} onChange={e => onChange(e.target.value)} className={input} />
          : <input value={v || ''} onChange={e => onChange(e.target.value)} className={input} />)
        : <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700">{v || '—'}</p>}
    </div>
  );
}

function List({ label, items, editing, onChange, empty = 'Nothing recorded.' }) {
  const list = items || [];
  return (
    <div>
      <Label>{label}</Label>
      {editing ? (
        // One item per line: simpler to edit than a row of inputs, and a
        // secretary correcting five bullets should not fight the UI.
        <textarea rows={Math.max(3, list.length + 1)} value={list.join('\n')}
          onChange={e => onChange(e.target.value.split('\n').map(x => x.trim()).filter(Boolean))}
          className={input} placeholder="One per line" />
      ) : !list.length ? <Empty>{empty}</Empty> : (
        <ul className="space-y-1">
          {list.map((x, i) => (
            <li key={i} className="text-[13.5px] leading-relaxed text-gray-700">• {x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Why there is no audio to transcribe — ONE MESSAGE PER REAL CAUSE.
 *
 * The three cases look identical from the screen (no audio row) and are
 * completely different to fix. A single catch-all describing the one that
 * cannot be fixed sent an administrator looking for a fault in the AI when
 * nothing had ever been recorded.
 */
function NoAudio({ d }) {
  if (!d.recordings) {
    return (
      <div className="mt-2 space-y-1.5 text-[13px] text-gray-600">
        <p><strong>This meeting was never recorded</strong>, so there is no audio and no video.</p>
        {!d.recording_storage_configured ? (
          <p className="text-gray-500">
            Recording is not set up yet — LiveKit needs somewhere to put the file, and has no
            storage of its own. Add{' '}
            <code className="rounded bg-gray-100 px-1">LIVEKIT_S3_BUCKET</code>,{' '}
            <code className="rounded bg-gray-100 px-1">LIVEKIT_S3_ACCESS_KEY</code>,{' '}
            <code className="rounded bg-gray-100 px-1">LIVEKIT_S3_SECRET</code> and{' '}
            <code className="rounded bg-gray-100 px-1">LIVEKIT_S3_ENDPOINT</code> in Vercel.
            Supabase Storage works: create a private bucket, then Storage → S3 Access Keys.
          </p>
        ) : (
          <p className="text-gray-500">
            Storage is configured, so the host simply did not press Record. Transcription needs a
            recording; there is nothing to work from for a meeting that was not recorded.
          </p>
        )}
      </div>
    );
  }

  if (!d.audio_capture_enabled) {
    return (
      <div className="mt-2 space-y-1.5 text-[13px] text-gray-600">
        <p><strong>This meeting was recorded, but only as video.</strong></p>
        <p className="text-gray-500">
          A separate audio-only track is what gets transcribed, and capturing it is off by default
          because it spends the LiveKit transcode allowance a second time. Set{' '}
          <code className="rounded bg-gray-100 px-1">MEETINGS_AI_AUDIO=1</code> in Vercel and
          meetings recorded from then on will have one. This meeting cannot be transcribed
          retrospectively.
        </p>
      </div>
    );
  }

  return (
    <p className="mt-2 text-[13px] text-gray-500">
      Audio capture is switched on, but this meeting has no audio track — most likely it was
      recorded before the setting was enabled. Meetings recorded from now on will have one.
    </p>
  );
}

const Step = ({ n, title, done }) => (
  <div className="flex items-center gap-2.5">
    <span className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-black text-white"
      style={{ background: done ? L.green : '#9CA3AF' }}>{done ? '✓' : n}</span>
    <h3 className="font-bold" style={{ color: L.deep }}>{title}</h3>
  </div>
);

const Notice = ({ title, children }) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <p className="text-[13.5px] font-bold text-amber-900">{title}</p>
    <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80">{children}</p>
  </div>
);

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
