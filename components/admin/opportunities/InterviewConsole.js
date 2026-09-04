'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aGet, aPost, aPatch } from '../adminApi';
import { Card } from '../ui';
import { FELLOWSHIP_QUESTIONS } from '@/lib/opportunities';
import {
  DEFAULT_CRITERIA, cleanCriteria, STATE_LABEL, STATE_TONE, SCORE_MIN, SCORE_MAX,
  queueProgress, nextInQueue, fmtClock, durationMinutes,
} from '@/lib/interviews';

const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';
const LIGHT = { deep: '#063D2B', green: '#0B6B4F' };

/* The interview console.
 *
 * One Virtual Hall room, thirty candidates, one at a time. The panel keeps
 * this screen open beside the meeting: the queue on the left, the candidate's
 * own words in the middle, scoring on the right.
 *
 * WHAT THIS SCREEN WILL NOT DO:
 *
 *   • It never changes an application's status. Scores are recorded; Selected
 *     and Rejected are still set by hand, afterwards, once the whole cohort has
 *     been seen. That was asked for deliberately and it is the reason a panel
 *     can change its mind at 4pm about a decision it felt sure of at 11am.
 *
 *   • It shows you OTHER panellists' scores only after you have saved your
 *     own. Anchoring is not a theoretical problem: a panellist who sees "8.5"
 *     before forming a view will not produce an independent judgement, and
 *     three dependent scores are worth less than one honest one.
 */
export default function InterviewConsole({ opportunity, session: initial, onBack, toast }) {
  const [sessionId, setSessionId] = useState(initial?.id || null);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  const [openId, setOpenId] = useState(null);      // candidate being viewed

  const load = useCallback(() => {
    if (!sessionId) return;
    aGet(`/api/admin/opportunities/interviews?session_id=${sessionId}`)
      .then(r => { if (r?.ok) setD(r); else toast?.(r?.message || 'Could not load the session.', 'err'); });
  }, [sessionId, toast]);
  useEffect(() => { load(); }, [load]);

  /* Re-read while the panel runs.
   *
   * Two office bearers score the same candidate from two laptops. Without this
   * the second one's save is invisible to the first, who then reads "1 of 2
   * scored" and waits for a colleague who has already finished. */
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [sessionId, load]);

  const queue = d?.queue || [];
  const progress = useMemo(() => queueProgress(queue), [queue]);
  const next = useMemo(() => nextInQueue(queue), [queue]);
  const current = queue.find(q => q.state === 'in_progress') || null;
  const open = queue.find(q => q.id === openId) || current || next || queue[0] || null;

  async function setState(row, state) {
    setBusy(row.id);
    const r = await aPost('/api/admin/opportunities/interviews', {
      action: 'state', queue_id: row.id, session_id: sessionId, state,
    });
    setBusy(null);
    if (!r?.ok) return toast?.(r?.message || 'Could not update the queue.', 'err');
    if (state === 'in_progress') setOpenId(row.id);
    load();
  }

  async function closeSession() {
    const left = progress.waiting + progress.in_progress;
    if (!confirm(left
      ? `${left} candidate(s) have not been interviewed yet.\n\nClose the session anyway? No more scores can be saved after this.`
      : 'Close this interview session? No more scores can be saved after this.')) return;
    const r = await aPatch('/api/admin/opportunities/interviews', { id: sessionId, status: 'closed' });
    toast?.(r?.ok ? r.message : (r?.message || 'Could not close.'), r?.ok ? 'ok' : 'err');
    load();
  }

  if (!sessionId) {
    return <SetupPanel opportunity={opportunity} toast={toast} onBack={onBack}
      onCreated={(id) => setSessionId(id)} />;
  }

  const closed = d?.session?.status === 'closed';

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-tnr-cream/60 hover:underline">
        ← Back to applications
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tnr-cream">{d?.session?.title || 'Interviews'}</h2>
          <p className="text-sm text-tnr-cream/50">
            {progress.seen} of {progress.total} interviewed
            {progress.no_show ? ` · ${progress.no_show} did not attend` : ''}
            {closed ? ' · session closed' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d?.meeting && (
            <a href={`/member/meetings/${d.meeting.id}/room`} target="_blank" rel="noopener noreferrer"
              className="rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: LIGHT.green }}>
              Open the Virtual Hall ↗
            </a>
          )}
          {!closed && (
            <button onClick={closeSession}
              className="rounded-xl border border-tnr-line px-4 py-2 text-sm font-bold text-tnr-cream">
              Close session
            </button>
          )}
        </div>
      </div>

      {d?.meeting && (
        <div className="rounded-2xl border border-tnr-line bg-white/5 px-4 py-3 text-[13px] text-tnr-cream/70">
          Candidates wait in the room&apos;s waiting area. Admit <b className="text-tnr-cream">one at a time</b> from
          the People panel inside the Virtual Hall, then mark them below.
          {d.meeting.status === 'scheduled' && ' The room has not been started yet.'}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* ── The queue ── */}
        <div className="space-y-2">
          {next && !closed && (
            <button onClick={() => setState(next, 'in_progress')} disabled={busy === next.id}
              className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-white disabled:opacity-40"
              style={{ background: LIGHT.deep }}>
              Call next: {next.candidate?.full_name || '—'}
              <span className="block text-[11px] font-normal opacity-70">
                {next.candidate?.membership_id}
              </span>
            </button>
          )}

          <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-tnr-line">
            {queue.map((q, i) => {
              const tone = STATE_TONE[q.state] || STATE_TONE.waiting;
              const isOpen = open?.id === q.id;
              return (
                <button key={q.id} onClick={() => setOpenId(q.id)}
                  className={`block w-full border-b border-tnr-line/50 px-3 py-2.5 text-left last:border-0 ${
                    isOpen ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-tnr-cream">
                      <span className="mr-1.5 text-tnr-cream/30">{i + 1}.</span>
                      {q.candidate?.full_name || 'Unknown'}
                    </span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ background: tone.bg, color: tone.fg }}>
                      {STATE_LABEL[q.state]}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-tnr-cream/40">
                    <span>{q.candidate?.membership_id}</span>
                    <span>
                      {q.summary?.scored
                        ? `${q.summary.overall ?? '—'} · ${q.summary.scored} scored`
                        : 'not scored'}
                      {q.summary?.disagreement ? ' ⚠' : ''}
                    </span>
                  </div>
                </button>
              );
            })}
            {!queue.length && (
              <div className="py-8 text-center text-sm text-tnr-cream/40">Nobody in the queue.</div>
            )}
          </div>
        </div>

        {/* ── The candidate ── */}
        <div className="space-y-3">
          {!open && <Card><div className="py-10 text-center text-sm text-tnr-cream/40">
            Choose a candidate.
          </div></Card>}

          {open && (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-tnr-cream">
                      {open.candidate?.full_name || 'Unknown candidate'}
                    </h3>
                    <p className="text-[12.5px] text-tnr-cream/50">
                      {open.candidate?.membership_id}
                      {open.candidate?.union_council ? ` · ${open.candidate.union_council}` : ''}
                      {open.started_at ? ` · called ${fmtClock(open.started_at)}` : ''}
                      {durationMinutes(open) ? ` · ${durationMinutes(open)} min` : ''}
                    </p>
                  </div>
                  {!closed && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {open.state !== 'in_progress' && (
                        <Btn onClick={() => setState(open, 'in_progress')} busy={busy === open.id}>
                          In the room
                        </Btn>
                      )}
                      {open.state === 'in_progress' && (
                        <Btn onClick={() => setState(open, 'done')} busy={busy === open.id} primary>
                          Finished
                        </Btn>
                      )}
                      <Btn onClick={() => setState(open, 'no_show')} busy={busy === open.id}>
                        Did not attend
                      </Btn>
                      <Btn onClick={() => setState(open, 'skipped')} busy={busy === open.id}>
                        Skip for now
                      </Btn>
                      {open.state !== 'waiting' && (
                        <Btn onClick={() => setState(open, 'waiting')} busy={busy === open.id}>
                          Back to waiting
                        </Btn>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid gap-3 xl:grid-cols-2">
                <Card>
                  <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
                    What they wrote
                  </h4>
                  <dl className="space-y-2.5">
                    {FELLOWSHIP_QUESTIONS.map(q => {
                      const v = open.application?.answers?.[q.key];
                      const extra = q.otherKey ? open.application?.answers?.[q.otherKey] : null;
                      return (
                        <div key={q.key}>
                          <dt className="text-[11px] font-semibold text-tnr-cream/40">{q.label}</dt>
                          <dd className="whitespace-pre-line text-[13px] text-tnr-cream/85">
                            {v ? `${v}${extra ? ` — ${extra}` : ''}` : '—'}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </Card>

                <ScoreCard row={open} session={d.session} closed={closed}
                  onSaved={load} toast={toast} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, busy, primary }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`rounded-lg px-3 py-1.5 font-bold disabled:opacity-40 ${primary
        ? 'text-white' : 'border border-tnr-line text-tnr-cream/80 hover:bg-white/5'}`}
      style={primary ? { background: LIGHT.green } : undefined}>
      {children}
    </button>
  );
}

/* ── Scoring ─────────────────────────────────────────────────────────────── */
function ScoreCard({ row, session, closed, onSaved, toast }) {
  const criteria = cleanCriteria(session?.criteria);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState('');
  const [rec, setRec] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);

  /* A fresh form per candidate.
   *
   * Without this, the scores typed for candidate 4 are still on screen for
   * candidate 5 and get saved against them — the single most damaging bug this
   * screen could have, and completely silent. */
  useEffect(() => {
    setScores({}); setNotes(''); setRec(''); setRevealed(false);
  }, [row?.id]);

  const others = row?.evaluations || [];
  const s = row?.summary;

  async function save() {
    setSaving(true);
    const r = await aPost('/api/admin/opportunities/interviews', {
      action: 'evaluate', session_id: session.id, application_id: row.application_id,
      scores, notes, recommendation: rec || null,
    });
    setSaving(false);
    if (!r?.ok) {
      return toast?.(r?.errors?.empty || r?.message || 'Could not save your scores.', 'err');
    }
    toast?.(r.message, 'ok');
    setRevealed(true);      // your own view is in — now the panel's is fair game
    onSaved?.();
  }

  return (
    <Card>
      <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
        Your scores
      </h4>

      {closed && (
        <p className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-[12.5px] text-tnr-cream/60">
          This session is closed. Scores can no longer be changed.
        </p>
      )}

      <div className="space-y-2.5">
        {criteria.map(c => (
          <div key={c.key} className="flex items-center justify-between gap-3">
            <label className="text-[13px] text-tnr-cream/80">{c.label}</label>
            <div className="flex items-center gap-1.5">
              <input type="number" min={SCORE_MIN} max={SCORE_MAX} disabled={closed}
                value={scores[c.key] ?? ''}
                onChange={e => setScores(p => ({ ...p, [c.key]: e.target.value }))}
                className={`${input} w-20 text-center`} placeholder="—" />
              <span className="text-[11px] text-tnr-cream/30">/{SCORE_MAX}</span>
            </div>
          </div>
        ))}
      </div>

      <textarea rows={3} value={notes} disabled={closed}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes — what they actually said, not just an impression."
        className={`${input} mt-3 resize-y`} />

      <div className="mt-3 flex flex-wrap gap-2">
        {[['select', 'Select'], ['undecided', 'Undecided'], ['reject', 'Reject']].map(([k, label]) => (
          <button key={k} onClick={() => setRec(rec === k ? '' : k)} disabled={closed}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
              rec === k ? 'border-tnr-gold/50 bg-tnr-gold/10 text-tnr-cream'
                : 'border-tnr-line text-tnr-cream/70 hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
      </div>

      <button onClick={save} disabled={saving || closed}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: LIGHT.green }}>
        {saving ? 'Saving…' : 'Save my scores'}
      </button>

      {/* ── The rest of the panel, hidden until you have committed ── */}
      <div className="mt-4 border-t border-tnr-line pt-3">
        {!revealed && others.length > 0 && (
          <button onClick={() => setRevealed(true)}
            className="w-full text-left text-[12.5px] text-tnr-cream/50 hover:text-tnr-cream/80">
            {others.length} other panellist{others.length === 1 ? ' has' : 's have'} scored this
            candidate — <span className="underline">show anyway</span>
            <span className="mt-0.5 block text-[11px] text-tnr-cream/30">
              Hidden by default so your judgement is your own.
            </span>
          </button>
        )}
        {!revealed && !others.length && (
          <p className="text-[12px] text-tnr-cream/30">Nobody else has scored this candidate yet.</p>
        )}

        {revealed && (
          <>
            {s?.overall !== null && s?.overall !== undefined && (
              <p className="text-[13px] text-tnr-cream/80">
                Panel average <b className="text-tnr-cream">{s.overall}</b>
                <span className="text-tnr-cream/40"> · {s.scored} of {s.panellists} scored</span>
              </p>
            )}
            {s?.disagreement && (
              <p className="mt-1 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[12px] text-amber-200">
                The panel disagrees by {s.spread} points. Worth talking about before deciding.
              </p>
            )}
            <ul className="mt-2 space-y-2">
              {others.map(e => (
                <li key={e.id} className="rounded-lg border border-tnr-line px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-tnr-cream">{e.panellist_name}</span>
                    {e.recommendation && (
                      <span className="text-[11px] uppercase tracking-wide text-tnr-cream/50">
                        {e.recommendation}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-tnr-cream/60">
                    {criteria.map(c => (
                      <span key={c.key}>{c.label}: <b>{e.scores?.[c.key] ?? '—'}</b></span>
                    ))}
                  </div>
                  {e.notes && (
                    <p className="mt-1 whitespace-pre-line text-[12.5px] text-tnr-cream/70">{e.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

/* ── Setting the panel up ────────────────────────────────────────────────── */
function SetupPanel({ opportunity, toast, onBack, onCreated }) {
  const [apps, setApps] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [hostQ, setHostQ] = useState('');
  const [hostFound, setHostFound] = useState([]);
  const [host, setHost] = useState(null);
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    aGet(`/api/admin/opportunities/applications?opportunity_id=${opportunity.id}&status=interview_invited`)
      .then(r => {
        const list = r?.ok ? (r.applications || []) : [];
        setApps(list);
        setPicked(new Set(list.map(a => a.id)));
      });
  }, [opportunity.id]);

  useEffect(() => {
    const term = hostQ.trim();
    if (term.length < 2) { setHostFound([]); return; }
    const t = setTimeout(() => {
      aGet(`/api/admin/meetings/audience?q=${encodeURIComponent(term)}`)
        .then(r => setHostFound(r?.ok ? r.members : []));
    }, 300);
    return () => clearTimeout(t);
  }, [hostQ]);

  async function create() {
    if (!host) return toast?.('Choose who chairs the panel.', 'err');
    setSaving(true);
    const r = await aPost('/api/admin/opportunities/interviews', {
      opportunity_id: opportunity.id,
      application_ids: (apps || []).filter(a => picked.has(a.id)).map(a => a.id),
      criteria, host_id: host.id,
      scheduled_at: when ? new Date(when).toISOString() : undefined,
      title: `${opportunity.title} — interviews`,
    });
    setSaving(false);
    if (!r?.ok) return toast?.([r?.message, r?.detail, r?.hint].filter(Boolean).join(' '), 'err');
    toast?.([r.message, r.warning].filter(Boolean).join(' '), 'ok');
    onCreated(r.session.id);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-tnr-cream/60 hover:underline">
        ← Back to applications
      </button>
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">Set up the interview panel</h2>
        <p className="text-sm text-tnr-cream/50">
          One Virtual Hall room with the waiting area on. Candidates are admitted one at a time.
        </p>
      </div>

      <Card>
        <h4 className="text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">Who chairs</h4>
        {host ? (
          <div className="mt-2 flex items-center justify-between rounded-xl border border-tnr-line px-3 py-2">
            <span className="text-sm font-semibold text-tnr-cream">
              {host.full_name}
              <span className="ml-1.5 text-[12px] font-normal text-tnr-cream/50">{host.membership_id}</span>
            </span>
            <button onClick={() => { setHost(null); setHostQ(''); }}
              className="text-[12px] text-tnr-cream/50 hover:underline">Change</button>
          </div>
        ) : (
          <>
            <input value={hostQ} onChange={e => setHostQ(e.target.value)}
              placeholder="Search the member who will host the room…" className={`${input} mt-2`} />
            {hostFound.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-tnr-line">
                {hostFound.map(m => (
                  <li key={m.id}>
                    <button onClick={() => { setHost(m); setHostQ(''); }}
                      className="w-full px-3 py-2 text-left text-sm text-tnr-cream hover:bg-white/5">
                      {m.full_name}
                      <span className="ml-1.5 text-[12px] text-tnr-cream/50">{m.membership_id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h4 className="mt-4 text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
          When it starts
        </h4>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
          className={`${input} mt-2`} />
        <p className="mt-1 text-[11.5px] text-tnr-cream/40">
          Leave blank to start now. The room stays open all day; candidates are
          told to wait in the waiting area.
        </p>
      </Card>

      <Card>
        <h4 className="text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
          What the panel scores
        </h4>
        <p className="mb-2 mt-1 text-[11.5px] text-tnr-cream/40">
          Four is deliberate. A panel scoring ten things across thirty people
          stops distinguishing between them by mid-morning.
        </p>
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input value={c.label}
                onChange={e => setCriteria(p => p.map((x, j) =>
                  j === i ? { ...x, label: e.target.value } : x))}
                className={input} />
              <button onClick={() => setCriteria(p => p.filter((_, j) => j !== i))}
                className="shrink-0 rounded-xl border border-tnr-line px-3 text-xs text-red-300">
                Remove
              </button>
            </div>
          ))}
        </div>
        {criteria.length < 8 && (
          <button onClick={() => setCriteria(p => [...p,
            { key: `criterion_${p.length + 1}`, label: '' }])}
            className="mt-2 text-xs text-tnr-goldLight hover:underline">
            + Add a criterion
          </button>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
            Candidates ({picked.size} of {apps?.length ?? 0})
          </h4>
          {!!apps?.length && (
            <button onClick={() => setPicked(picked.size === apps.length
              ? new Set() : new Set(apps.map(a => a.id)))}
              className="text-xs text-tnr-cream/60 hover:underline">
              {picked.size === apps.length ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>

        {apps === null && <p className="mt-3 text-sm text-tnr-cream/40">Loading candidates…</p>}
        {apps?.length === 0 && (
          <p className="mt-3 text-sm text-tnr-cream/50">
            No applications are at the Interview Invite stage for this opportunity.
            Move candidates to that stage first.
          </p>
        )}

        {!!apps?.length && (
          <ul className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-tnr-line">
            {apps.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2.5 border-b border-tnr-line/50 px-3 py-2 last:border-0">
                <input type="checkbox" checked={picked.has(a.id)}
                  onChange={() => setPicked(p => {
                    const n = new Set(p);
                    if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                    return n;
                  })} />
                <span className="text-tnr-cream/30 text-[11px] w-5">{i + 1}</span>
                <span className="flex-1 truncate text-sm text-tnr-cream">
                  {a.member?.full_name || a.full_name || 'Unknown'}
                  <span className="ml-1.5 text-[12px] text-tnr-cream/40">
                    {a.member?.membership_id || a.membership_id}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11.5px] text-tnr-cream/40">
          They are interviewed in this order. Anyone withdrawn or already
          rejected is left out automatically.
        </p>
      </Card>

      <button onClick={create} disabled={saving || !picked.size || !host}
        className="w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: LIGHT.green }}>
        {saving ? 'Creating…' : `Create the panel room for ${picked.size} candidate(s)`}
      </button>
    </div>
  );
}
