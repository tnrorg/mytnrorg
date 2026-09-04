'use client';
import { useCallback, useEffect, useState } from 'react';
import { mGet, mPost } from '@/components/member/memberApi';
import { FELLOWSHIP_QUESTIONS } from '@/lib/opportunities';
import { SCORE_MIN, SCORE_MAX, panellistAverage } from '@/lib/interviews';

const C = { deep: '#063D2B', green: '#0B6B4F', line: 'rgba(255,255,255,.10)' };

/* The scoring pad, inside the Virtual Hall.
 *
 * A panellist interviews in this room. Asking them to keep a second window
 * open for the scoring page meant that on a phone they could see the candidate
 * or the form, never both. So the form comes to the room.
 *
 * IT FOLLOWS THE CHAIR. When the chair calls the next candidate in the admin
 * console, this pad switches to that person within a few seconds on every
 * panellist's screen. Nobody has to find anything.
 *
 * AND IT NEVER THROWS AWAY WHAT YOU TYPED. That is the whole difficulty of
 * following the chair automatically: a panellist is halfway through a note
 * about candidate four when the chair calls candidate five. Silently replacing
 * the form would delete that note in front of them. Instead the pad HOLDS the
 * unsaved work, says who it belongs to, and offers to save it — the new
 * candidate waits until the old one is dealt with.
 *
 * It is only rendered for members who are actually on the panel; for everyone
 * else in the room it does not exist.
 */
export default function InterviewPad({ meetingId }) {
  const [pad, setPad] = useState(null);
  const [open, setOpen] = useState(true);

  // The candidate this form's contents belong to — NOT necessarily the one the
  // chair currently has in the room. The gap between them is the whole point.
  const [formFor, setFormFor] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [rec, setRec] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  /* STATE, not a ref.
   *
   * This value is read while rendering — the dot on the collapsed button, and
   * the decision to hold the form. A ref does not re-render, so the dot would
   * have shown yesterday's answer and the hold would have been released a beat
   * late. Anything the render reads has to be state.
   *
   * It is also in the adopt effect's dependencies, which is what makes the
   * release automatic: the moment this goes false, the effect re-runs and the
   * pad catches up to whoever the chair now has in the room. */
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  const load = useCallback(() => {
    mGet(`/api/member/interviews?meeting_id=${meetingId}`)
      .then(r => setPad(r?.ok ? r.pad : null))
      .catch(() => { /* the room must not break because the pad could not load */ });
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  /* Poll rather than push.
   *
   * The chair advances the queue in the ADMIN console, which is not connected
   * to this room's data channel — there is no message for the room to listen
   * for. Six seconds is quick enough that the pad has changed before the
   * candidate has finished saying salaam. */
  useEffect(() => {
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const current = pad?.current || null;
  const criteria = pad?.criteria || [];

  /* Adopt the new candidate ONLY when there is nothing unsaved to lose. */
  useEffect(() => {
    if (!current) return;
    if (formFor === current.application_id) return;
    if (dirty && formFor) return;                // hold: the panellist is mid-note

    const mine = current.my_evaluation;
    setFormFor(current.application_id);
    setScores(mine?.scores || {});
    setNotes(mine?.notes || '');
    setRec(mine?.recommendation || '');
    setMsg('');
    setDirty(false);
  }, [current, formFor, dirty]);

  if (!pad) return null;                 // not an interview, or not on the panel

  const held = !!(formFor && current && formFor !== current.application_id);
  const mineAvg = panellistAverage(scores);

  async function save() {
    if (!formFor) return;
    setSaving(true);
    const r = await mPost('/api/member/interviews', {
      session_id: pad.session_id, application_id: formFor,
      scores, notes, recommendation: rec || null,
    });
    setSaving(false);
    if (!r?.ok) { setMsg(r?.errors?.empty || r?.message || 'Could not save.'); return; }

    setMsg('Saved ✓');
    /* Released. The adopt effect depends on `dirty`, so clearing it is all
     * that is needed — if the chair moved on while this was being written, the
     * pad now catches up to the candidate actually in the room by itself. */
    setDirty(false);
    load();
  }

  function discard() {
    if (!confirm('Discard what you typed for the previous candidate?')) return;
    setDirty(false);      // the effect adopts the current candidate on its own
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-24 right-3 z-30 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg"
        style={{ background: C.green }}>
        📝 Score{current?.candidate?.full_name ? `: ${current.candidate.full_name.split(' ')[0]}` : ''}
        {dirty && <span className="ml-1.5">•</span>}
      </button>
    );
  }

  return (
    <aside className="fixed bottom-20 right-3 z-30 flex max-h-[70vh] w-[min(92vw,340px)] flex-col
                      overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: '#0A1F18', border: `1px solid ${C.line}` }}>

      <header className="flex items-center justify-between gap-2 px-3.5 py-2.5"
        style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wider text-white/40">
            Interview scoring
          </p>
          <p className="truncate text-sm font-bold text-white">
            {held ? 'Previous candidate' : (current?.candidate?.full_name || 'Nobody called yet')}
          </p>
          {!held && current?.candidate?.membership_id && (
            <p className="truncate text-[11px] text-white/40">{current.candidate.membership_id}</p>
          )}
        </div>
        <button onClick={() => setOpen(false)}
          className="shrink-0 rounded-lg px-2 py-1 text-white/50 hover:bg-white/10" title="Hide">
          ▾
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
        {/* ── The hold ──
            Shown when the chair has moved on and this form still has unsaved
            work for the person before. Nothing is lost without being asked. */}
        {held && (
          <div className="mb-3 rounded-xl px-3 py-2.5 text-[12.5px]"
            style={{ background: 'rgba(245,158,11,.14)', color: '#FCD34D' }}>
            The chair has called <b>{current?.candidate?.full_name || 'the next candidate'}</b>, but you
            have unsaved scores for the previous one. Save them, or discard, and
            this will move on.
          </div>
        )}

        {!current && !held && (
          <p className="py-6 text-center text-[13px] text-white/40">
            Waiting for the chair to call a candidate.
          </p>
        )}

        {(current || held) && (
          <>
            {/* What they wrote — collapsed by default. The candidate is on
                screen and speaking; their application is a reference, not the
                thing to be reading. */}
            {!held && current?.answers && (
              <details className="mb-3">
                <summary className="cursor-pointer text-[12px] font-semibold text-white/50">
                  Their application
                </summary>
                <dl className="mt-2 space-y-2">
                  {FELLOWSHIP_QUESTIONS.map(q => {
                    const v = current.answers?.[q.key];
                    if (!v) return null;
                    return (
                      <div key={q.key}>
                        <dt className="text-[10.5px] font-semibold text-white/35">{q.label}</dt>
                        <dd className="whitespace-pre-line text-[12px] text-white/75">{v}</dd>
                      </div>
                    );
                  })}
                </dl>
              </details>
            )}

            <div className="space-y-2">
              {criteria.map(c => (
                <div key={c.key} className="flex items-center justify-between gap-2">
                  <label className="min-w-0 flex-1 truncate text-[12.5px] text-white/80">{c.label}</label>
                  <div className="flex shrink-0 items-center gap-1">
                    <input type="number" min={SCORE_MIN} max={SCORE_MAX} inputMode="numeric"
                      value={scores[c.key] ?? ''}
                      onChange={e => { markDirty(); setScores(p => ({ ...p, [c.key]: e.target.value })); }}
                      className="w-14 rounded-lg px-2 py-1.5 text-center text-sm text-white outline-none"
                      style={{ background: 'rgba(0,0,0,.35)', border: `1px solid ${C.line}` }}
                      placeholder="—" />
                    <span className="text-[10px] text-white/25">/{SCORE_MAX}</span>
                  </div>
                </div>
              ))}
            </div>

            <textarea rows={3} value={notes}
              onChange={e => { markDirty(); setNotes(e.target.value); }}
              placeholder="What they actually said…"
              className="mt-2.5 w-full resize-y rounded-xl px-2.5 py-2 text-[13px] text-white outline-none"
              style={{ background: 'rgba(0,0,0,.35)', border: `1px solid ${C.line}` }} />

            <div className="mt-2 flex gap-1.5">
              {[['select', 'Select'], ['undecided', 'Maybe'], ['reject', 'Reject']].map(([k, label]) => (
                <button key={k}
                  onClick={() => { markDirty(); setRec(rec === k ? '' : k); }}
                  className="flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition"
                  style={rec === k
                    ? { background: 'rgba(212,167,44,.22)', color: '#F3E4B3', border: '1px solid rgba(212,167,44,.45)' }
                    : { background: 'transparent', color: 'rgba(255,255,255,.6)', border: `1px solid ${C.line}` }}>
                  {label}
                </button>
              ))}
            </div>

            {mineAvg !== null && (
              <p className="mt-2 text-center text-[11.5px] text-white/40">
                your average <b className="text-white/80">{mineAvg}</b>
              </p>
            )}
          </>
        )}
      </div>

      {(current || held) && (
        <footer className="px-3.5 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: C.green }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {held && (
              <button onClick={discard}
                className="rounded-xl px-3 py-2 text-[12px] font-bold text-red-300"
                style={{ border: `1px solid ${C.line}` }}>
                Discard
              </button>
            )}
          </div>
          {msg && <p className="mt-1.5 text-center text-[11.5px] text-white/55">{msg}</p>}
        </footer>
      )}
    </aside>
  );
}
