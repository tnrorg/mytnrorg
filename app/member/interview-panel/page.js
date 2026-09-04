'use client';
import { useCallback, useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
import { FELLOWSHIP_QUESTIONS } from '@/lib/opportunities';
import {
  cleanCriteria, STATE_LABEL, STATE_TONE, SCORE_MIN, SCORE_MAX, panellistAverage,
} from '@/lib/interviews';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const box = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

/* Interview Panel — a panellist's own screen.
 *
 * Executive Committee and Advisory Council members judge candidates from here,
 * with no admin login and no access to anything else in the admin panel.
 *
 * The admin console runs the room: calls candidates, marks who has been seen,
 * closes the session. This screen does one thing — record what THIS panellist
 * thought — and shows the rest of the panel's view only after they have
 * committed their own.
 */
export default function InterviewPanelPage() {
  const [sessions, setSessions] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [d, setD] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const q = sessionId ? `?session_id=${sessionId}` : '';
    mGet(`/api/member/interviews${q}`).then(r => {
      if (!r?.ok) { setErr(r?.message || 'Could not load your panels.'); return; }
      setErr('');
      setSessions(r.sessions || []);
      if (sessionId) setD(r);
      else if ((r.sessions || []).length === 1) setSessionId(r.sessions[0].id);
    });
  }, [sessionId]);
  useEffect(() => { load(); }, [load]);

  /* Re-read while the panel runs, so the queue state the chair sets in the
   * admin console appears here without anyone refreshing. */
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [sessionId, load]);

  const queue = d?.queue || [];
  const current = queue.find(q => q.state === 'in_progress') || null;
  const open = queue.find(q => q.id === openId) || current || queue[0] || null;

  return (
    <MemberShell active="/member/interview-panel">
      <div style={mont}>
        <header>
          <h1 className="text-2xl font-black" style={{ color: C.deep }}>Interview Panel</h1>
          <p className="mt-1 text-sm text-gray-500">
            Score the candidates you interview. Only you and the office bearers
            running the panel can see what you write.
          </p>
        </header>

        {err && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            {err}
          </div>
        )}

        {sessions !== null && !sessions.length && !err && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center">
            <p className="text-sm font-semibold text-gray-600">
              You are not on an interview panel at the moment.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] text-gray-500">
              When the committee assigns you to one, the candidates appear here.
            </p>
          </div>
        )}

        {sessions?.length > 1 && (
          <select value={sessionId || ''} onChange={e => { setSessionId(e.target.value); setD(null); }}
            className={`${box} mt-5`}>
            <option value="">Choose a panel…</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.title}{s.status === 'closed' ? ' (closed)' : ''}
              </option>
            ))}
          </select>
        )}

        {d?.session && (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-black" style={{ color: C.deep }}>{d.session.title}</h2>
                <p className="text-[12.5px] text-gray-500">
                  {d.my_role === 'chair' ? 'You chair this panel' : 'You are a panellist'}
                  {d.panel_size ? ` · ${d.panel_size} on the panel` : ''}
                  {d.session.status === 'closed' ? ' · closed' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {current && (
                  <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ background: STATE_TONE.in_progress.bg, color: STATE_TONE.in_progress.fg }}>
                    In the room: {current.candidate?.full_name}
                  </span>
                )}
                {/* The interview happens in the Virtual Hall. This page is the
                    notebook you keep open beside it, so the way in is here. */}
                {d.meeting && (
                  <a href={`/member/meetings/${d.meeting.id}/room`}
                    target="_blank" rel="noopener noreferrer"
                    className="rounded-xl px-4 py-2 text-sm font-bold text-white"
                    style={{ background: C.green }}>
                    Join the Virtual Hall ↗
                  </a>
                )}
              </div>
            </div>

            {d.meeting && (
              <p className="mt-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[12.5px] text-gray-600">
                Open the Virtual Hall in a second window and keep this page beside
                it. Candidates wait in the waiting area and are admitted one at a
                time — as a panellist you can admit them yourself if the chair
                drops off.
                {d.meeting.status === 'scheduled' && ' The room has not been started yet.'}
              </p>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
              {/* Who is on the list */}
              <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white">
                {queue.map((q, i) => {
                  const tone = STATE_TONE[q.state] || STATE_TONE.waiting;
                  const done = !!q.my_evaluation;
                  return (
                    <button key={q.id} onClick={() => setOpenId(q.id)}
                      className={`block w-full border-b border-gray-100 px-3 py-2.5 text-left last:border-0 ${
                        open?.id === q.id ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-800">
                          <span className="mr-1.5 text-gray-300">{i + 1}.</span>
                          {q.candidate?.full_name || 'Unknown'}
                        </span>
                        {/* Your own progress, not anyone's result. */}
                        <span className="shrink-0 text-[11px]" title={done ? 'You have scored this candidate' : 'Not scored by you'}>
                          {done ? '✅' : '—'}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-gray-400">
                        <span>{q.candidate?.membership_id}</span>
                        <span style={{ color: tone.fg }}>{STATE_LABEL[q.state]}</span>
                      </div>
                    </button>
                  );
                })}
                {!queue.length && (
                  <p className="px-3 py-8 text-center text-sm text-gray-400">
                    No candidates on this panel yet.
                  </p>
                )}
              </div>

              {/* The candidate, and your notebook */}
              {open && (
                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-gray-200 bg-white p-5">
                    <h3 className="text-lg font-black" style={{ color: C.deep }}>
                      {open.candidate?.full_name}
                    </h3>
                    <p className="text-[12.5px] text-gray-500">
                      {open.candidate?.membership_id}
                      {open.candidate?.union_council ? ` · ${open.candidate.union_council}` : ''}
                    </p>
                    <dl className="mt-4 space-y-2.5">
                      {FELLOWSHIP_QUESTIONS.map(q => {
                        const v = open.answers?.[q.key];
                        const extra = q.otherKey ? open.answers?.[q.otherKey] : null;
                        return (
                          <div key={q.key}>
                            <dt className="text-[11px] font-semibold text-gray-400">{q.label}</dt>
                            <dd className="whitespace-pre-line text-[13px] text-gray-700">
                              {v ? `${v}${extra ? ` — ${extra}` : ''}` : '—'}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </section>

                  <Notebook row={open} session={d.session} onSaved={load} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MemberShell>
  );
}

/* ── One panellist's notebook ─────────────────────────────────────────────── */
function Notebook({ row, session, onSaved }) {
  const criteria = cleanCriteria(session.criteria);
  const closed = session.status === 'closed';
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [rec, setRec] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  /* Load MY existing entry, and reset completely when the candidate changes.
   *
   * Without the reset, the scores typed for candidate 4 are still on screen for
   * candidate 5 and get saved against them — silent, and the worst thing this
   * screen could do. */
  useEffect(() => {
    const mine = row?.my_evaluation;
    setScores(mine?.scores || {});
    setNotes(mine?.notes || '');
    setRec(mine?.recommendation || '');
    setMsg('');
  }, [row?.id, row?.my_evaluation]);

  const mine = panellistAverage(scores);

  async function save() {
    setSaving(true);
    const r = await mPost('/api/member/interviews', {
      session_id: session.id, application_id: row.application_id,
      scores, notes, recommendation: rec || null,
    });
    setSaving(false);
    setMsg(r?.ok ? r.message : (r?.errors?.empty || r?.message || 'Could not save.'));
    if (r?.ok) onSaved?.();
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-black uppercase tracking-wider" style={{ color: C.deep }}>
          Your notebook
        </h4>
        {mine !== null && (
          <span className="text-[12.5px] text-gray-500">
            your average <b className="text-gray-800">{mine}</b>
          </span>
        )}
      </div>

      {closed && (
        <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[12.5px] text-gray-500">
          This panel is closed. Your scores are saved and can no longer be changed.
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {criteria.map(c => (
          <div key={c.key} className="flex items-center justify-between gap-3">
            <label className="text-[13px] text-gray-700">{c.label}</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min={SCORE_MIN} max={SCORE_MAX} disabled={closed}
                value={scores[c.key] ?? ''}
                onChange={e => setScores(p => ({ ...p, [c.key]: e.target.value }))}
                className={`${box} w-20 text-center`} placeholder="—" />
              <span className="text-[11px] text-gray-300">/{SCORE_MAX}</span>
            </div>
          </div>
        ))}
      </div>

      <textarea rows={4} value={notes} disabled={closed}
        onChange={e => setNotes(e.target.value)}
        placeholder="What they actually said — not just an impression. You will be reading this again next week."
        className={`${box} mt-3 resize-y`} />

      <div className="mt-3 flex flex-wrap gap-2">
        {[['select', 'Select'], ['undecided', 'Undecided'], ['reject', 'Reject']].map(([k, label]) => (
          <button key={k} onClick={() => setRec(rec === k ? '' : k)} disabled={closed}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
              rec === k ? 'border-[#0B6B4F] bg-[#0B6B4F]/10 text-[#0B6B4F]'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      <button onClick={save} disabled={saving || closed}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: C.green }}>
        {saving ? 'Saving…' : row.my_evaluation ? 'Update my scores' : 'Save my scores'}
      </button>

      {msg && <p className="mt-2 text-center text-[12.5px] text-gray-600">{msg}</p>}

      {/* ── The rest of the panel ── */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        {!row.my_evaluation ? (
          <p className="text-[12px] leading-relaxed text-gray-400">
            {row.others_count > 0
              ? `${row.others_count} other panellist${row.others_count === 1 ? ' has' : 's have'} scored this candidate. `
              : ''}
            You will see what the rest of the panel said once you have saved your
            own — so your judgement is your own first.
          </p>
        ) : (
          <>
            {row.summary?.overall !== null && row.summary?.overall !== undefined && (
              <p className="text-[13px] text-gray-700">
                Panel average <b>{row.summary.overall}</b>
                <span className="text-gray-400"> · {row.summary.scored} scored</span>
              </p>
            )}
            {row.summary?.disagreement && (
              <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
                The panel disagrees by {row.summary.spread} points on this candidate.
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {(row.others || []).map(e => (
                <li key={e.id} className="rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-gray-800">{e.panellist_name}</span>
                    {e.recommendation && (
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">
                        {e.recommendation}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-gray-500">
                    {criteria.map(c => (
                      <span key={c.key}>{c.label}: <b>{e.scores?.[c.key] ?? '—'}</b></span>
                    ))}
                  </div>
                  {e.notes && <p className="mt-1 whitespace-pre-line text-[12.5px] text-gray-600">{e.notes}</p>}
                </li>
              ))}
              {!row.others?.length && (
                <li className="text-[12px] text-gray-400">Nobody else has scored this candidate yet.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
