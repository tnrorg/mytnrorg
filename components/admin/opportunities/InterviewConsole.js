'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aGet, aPost, aPatch } from '../adminApi';
import { Card } from '../ui';
import { FELLOWSHIP_QUESTIONS } from '@/lib/opportunities';
import {
  DEFAULT_CRITERIA, cleanCriteria, STATE_LABEL, STATE_TONE,
  queueProgress, nextInQueue, fmtClock, durationMinutes, topCut,
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
  const [tab, setTab] = useState('panel');         // panel | results
  const [mailing, setMailing] = useState(null);

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

  /* A reminder is the same details, sent again.
   *
   * THE PLATFORM HAS NO SCHEDULER — no cron, no queue, no background worker —
   * so nothing can fire this by itself the night before. Rather than pretend
   * otherwise with an automatic reminder that would silently never send, this
   * is a button the chair presses. Honest, and it actually works. */
  async function remind() {
    const n = queue.length;
    if (!confirm(`Email the reminder to all ${n} candidate(s) and the panel?\n\n`
      + 'Everyone gets the details again, including people already emailed.')) return;

    setMailing('Sending…');
    const e = await runEmails({
      sessionId, reminder: true,
      onProgress: (sent, total) => setMailing(`Sent ${sent}${total ? ` of ${total}` : ''}…`),
    });
    setMailing(null);
    toast?.(
      e.ended === 'error' ? (e.detail || 'The reminders could not be sent.')
        : [`Reminder: ${e.tally}.`, e.detail, e.warning].filter(Boolean).join(' '),
      e.ended === 'done' && e.sent ? 'ok' : 'err');
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
            <button onClick={remind} disabled={!!mailing}
              className="rounded-xl border border-tnr-line px-4 py-2 text-sm font-bold text-tnr-cream disabled:opacity-40"
              title="Email everyone the details again — use this the day before">
              {mailing || 'Send reminder'}
            </button>
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

      {/* Roster. Who may score at all. */}
      <PanelRoster sessionId={sessionId} panel={d?.panel || []}
        missing={d?.panel_missing} closed={closed} toast={toast} onChanged={load} />

      <div className="flex gap-2">
        {[['panel', 'Interviews'], ['results', `Final list${d?.results?.ranked?.length
          ? ` (${d.results.ranked.length})` : ''}`]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${tab === k
              ? 'border-tnr-gold/50 bg-tnr-gold/10 text-tnr-cream'
              : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'results' && (
        <Results results={d?.results} criteria={d?.session?.criteria}
          progress={progress} title={d?.session?.title} />
      )}

      {tab === 'panel' && (
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

                <ScoreCard row={open} session={d.session} closed={closed} />
              </div>
            </>
          )}
        </div>
      </div>
      )}
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

/* ── What the panel said ─────────────────────────────────────────────────── */
/* READ ONLY, on purpose.
 *
 * Scoring moved to the member portal when the panel became members rather than
 * admin accounts. An admin running the room can see every score as it arrives
 * — they need to, to know when a candidate is finished with — but they cannot
 * enter one here. A judgement filed from an admin account would be attributed
 * to whoever was signed in rather than to the person who sat in the interview,
 * and that is exactly the record that has to hold up if a candidate asks why.
 */
function ScoreCard({ row, session, closed }) {
  const criteria = cleanCriteria(session?.criteria);
  const others = row?.evaluations || [];
  const s = row?.summary;

  return (
    <Card>
      <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
        What the panel said
      </h4>

      {!others.length && (
        <p className="text-[12.5px] text-tnr-cream/50">
          No scores yet. Panellists record theirs from their own member portal,
          under <b className="text-tnr-cream/70">Interview Panel</b>.
        </p>
      )}

      {others.length > 0 && (
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

      {closed && (
        <p className="mt-3 text-[11.5px] text-tnr-cream/40">
          This session is closed — no further scores can be recorded.
        </p>
      )}
    </Card>
  );
}


/* Sending the emails.
 *
 * Same shape as every other bulk send in this codebase, and for the same
 * reasons: accumulate across rounds because each response carries only its own
 * tally, stop the moment a round makes no progress, and cap the rounds so a
 * spinner can never run for ever.
 */
async function runEmails({ sessionId, reminder, onProgress }) {
  let sent = 0, failed = 0, noEmail = 0, offset = 0;
  let detail = null, warning = null, lastRemaining = Infinity, guard = 0;
  let ended = 'done';

  for (;;) {
    if (guard++ > 200) { ended = 'stalled'; break; }

    const r = await aPost('/api/admin/opportunities/interviews', {
      action: 'email', session_id: sessionId, reminder: !!reminder, offset,
    });
    if (!r?.ok) {
      ended = 'error';
      detail = [r?.message, r?.detail].filter(Boolean).join(' ');
      break;
    }

    sent += r.sent || 0;
    failed += r.failed || 0;
    noEmail += r.no_email || 0;
    detail = r.detail || detail;
    warning = warning || r.warning || null;
    onProgress?.(sent, r.total || 0);

    if (r.done) break;
    if (!(r.remaining < lastRemaining)) { ended = 'stalled'; break; }
    lastRemaining = r.remaining;
    offset = r.next_offset;
  }

  const tally = [
    sent ? `${sent} emailed` : null,
    failed ? `${failed} failed` : null,
    noEmail ? `${noEmail} have no email address` : null,
  ].filter(Boolean).join(', ') || 'nothing to send';

  return { ended, sent, tally, detail, warning };
}

/* ── Who sits on the panel ───────────────────────────────────────────────── */
function PanelRoster({ sessionId, panel, missing, closed, toast, onChanged }) {
  const [people, setPeople] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!adding || people) return;
    aGet('/api/admin/opportunities/interviews?action=panel_candidates')
      .then(r => setPeople(r?.ok ? r.members : []));
  }, [adding, people]);

  async function add(id) {
    setBusy(true);
    const r = await aPost('/api/admin/opportunities/interviews', {
      action: 'panel', session_id: sessionId, member_ids: [id],
    });
    setBusy(false);
    toast?.([r?.message, r?.hint].filter(Boolean).join(' '), r?.ok ? 'ok' : 'err');
    if (r?.ok) { setAdding(false); onChanged?.(); }
  }

  async function remove(p) {
    if (!confirm(`Remove ${p.name} from the panel?\n\nScores they have already given are kept.`)) return;
    setBusy(true);
    const r = await aPost('/api/admin/opportunities/interviews', {
      action: 'panel', session_id: sessionId, member_id: p.member_id, remove: true,
    });
    setBusy(false);
    toast?.(r?.message || 'Could not remove them.', r?.ok ? 'ok' : 'err');
    if (r?.ok) onChanged?.();
  }

  const seated = new Set(panel.map(p => p.member_id));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
          Interview panel ({panel.length})
        </h4>
        {!closed && (
          <button onClick={() => setAdding(a => !a)}
            className="text-xs text-tnr-goldLight hover:underline">
            {adding ? 'Cancel' : '+ Add a panellist'}
          </button>
        )}
      </div>

      {missing && (
        <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-200">
          The panel roster could not be read. Run <b>supabase/migration_interview_panel.sql</b> —
          until then nobody can save scores.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {panel.map(p => (
          <span key={p.id}
            className="inline-flex items-center gap-2 rounded-full border border-tnr-line px-3 py-1 text-[12.5px] text-tnr-cream">
            {p.role === 'chair' && <span title="Chairs the panel">🪑</span>}
            {p.name}
            <span className="text-[11px] text-tnr-cream/40">{p.membership_id}</span>
            {!closed && panel.length > 1 && (
              <button onClick={() => remove(p)} disabled={busy}
                className="text-tnr-cream/40 hover:text-red-300" title="Remove">×</button>
            )}
          </span>
        ))}
        {!panel.length && !missing && (
          <span className="text-[12.5px] text-tnr-cream/40">Nobody assigned yet.</span>
        )}
      </div>

      {adding && (
        <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-tnr-line">
          {people === null && <p className="px-3 py-2 text-sm text-tnr-cream/40">Loading…</p>}
          {(people || []).filter(a => !seated.has(a.id)).map(a => (
            <button key={a.id} onClick={() => add(a.id)} disabled={busy}
              className="block w-full px-3 py-2 text-left text-sm text-tnr-cream hover:bg-white/5 disabled:opacity-40">
              {a.full_name}
              <span className="ml-1.5 text-[12px] text-tnr-cream/40">
                {a.membership_id} · {a.role === 'cec' ? 'CEC' : 'Advisory'}
              </span>
            </button>
          ))}
          {people && !people.filter(a => !seated.has(a.id)).length && (
            <p className="px-3 py-2 text-sm text-tnr-cream/40">
              Everyone eligible is already on the panel.
            </p>
          )}
        </div>
      )}

      <p className="mt-2 text-[11.5px] text-tnr-cream/40">
        Executive Committee and Advisory Council members only. They score from
        their own member portal, under <b>Interview Panel</b> — no admin login
        needed. The chair runs the room; their score carries no more weight than
        anyone else&apos;s.
      </p>
    </Card>
  );
}

/* ── The final list ──────────────────────────────────────────────────────── */
function Results({ results, criteria, progress, title }) {
  const [topN, setTopN] = useState(10);
  const ranked = results?.ranked || [];
  const unranked = results?.unranked || [];
  const cov = results?.coverage || {};
  const crit = cleanCriteria(criteria);
  const cut = useMemo(() => topCut(ranked, topN), [ranked, topN]);

  function exportCsv() {
    const esc = (v) => {
      const s = String(v ?? '');
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const head = ['Rank', 'Membership ID', 'Name', 'Panel average', 'Spread',
      'Panellists scored', ...crit.map(c => c.label),
      'Select', 'Reject', 'Undecided', 'In top ' + topN];
    const body = ranked.map(r => [
      r.rank, r.candidate?.membership_id, r.candidate?.full_name,
      r.summary.overall, r.summary.spread, r.summary.scored,
      ...crit.map(c => r.summary.byCriterion[c.key] ?? ''),
      r.summary.recommendations.select, r.summary.recommendations.reject,
      r.summary.recommendations.undecided,
      r.rank <= topN ? 'yes' : 'no',
    ]);
    // Not-ranked candidates are exported too, with the reason. Leaving them out
    // of the file is how somebody gets quietly forgotten.
    for (const u of unranked) {
      body.push(['—', u.candidate?.membership_id, u.candidate?.full_name,
        '', '', 0, ...crit.map(() => ''), '', '', '', u.reason]);
    }
    const csv = '\ufeff' + [head, ...body].map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `interview-results.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Is the scoring finished? Asked before a rank is shown, not after. */}
      {!cov.complete && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
          <b>This list is not final yet.</b>{' '}
          {progress.waiting + progress.in_progress > 0 &&
            `${progress.waiting + progress.in_progress} candidate(s) still to interview. `}
          {cov.partiallyScored > 0 &&
            `${cov.partiallyScored} interviewed but scored by only part of the panel. `}
          {cov.unscored > 0 && `${cov.unscored} interviewed with no score recorded at all. `}
          Positions will move as the remaining scores come in.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12.5px] text-tnr-cream/60">Shortlist the top</label>
          <input type="number" min="1" max={Math.max(1, ranked.length)} value={topN}
            onChange={e => setTopN(Math.max(1, Number(e.target.value) || 1))}
            className={`${input} w-20 text-center`} />
          <span className="text-[12.5px] text-tnr-cream/60">of {ranked.length} scored</span>
        </div>
        <button onClick={exportCsv} disabled={!ranked.length}
          className="rounded-xl border border-tnr-line px-4 py-2 text-sm font-bold text-tnr-cream disabled:opacity-40">
          Export the list
        </button>
      </div>

      {/* The one place a mechanical cut does real damage. */}
      {cut.tooClose && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-amber-200">
          <b>The line falls on a near-tie.</b> Only {cut.gap} of a point separates
          number {topN} from number {topN + 1} — smaller than the difference
          between two panellists on the same candidate. Look at these
          {' '}{cut.borderline.length} together before treating the cut as a decision.
        </div>
      )}

      {!ranked.length && (
        <Card><div className="py-10 text-center text-sm text-tnr-cream/50">
          No scores recorded yet. The list appears as the panel scores candidates.
        </div></Card>
      )}

      {ranked.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-tnr-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tnr-line text-left text-[10px] uppercase tracking-wider text-tnr-cream/40">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Candidate</th>
                <th className="px-3 py-2.5">Panel avg</th>
                {crit.map(c => <th key={c.key} className="px-3 py-2.5 whitespace-nowrap">{c.label}</th>)}
                <th className="px-3 py-2.5">Scored by</th>
                <th className="px-3 py-2.5">Recommends</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(r => {
                const inTop = r.rank <= topN;
                const borderline = cut.borderline.some(x => x.id === r.id);
                return (
                  <tr key={r.id}
                    className={`border-b border-tnr-line/50 ${inTop ? 'bg-tnr-gold/[0.06]' : ''} ${
                      borderline ? 'ring-1 ring-inset ring-amber-400/30' : ''}`}>
                    <td className="px-3 py-2.5 tabular-nums font-bold text-tnr-cream">{r.rank}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-tnr-cream">{r.candidate?.full_name}</div>
                      <div className="text-[11px] text-tnr-cream/40">{r.candidate?.membership_id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums font-black text-tnr-cream">{r.summary.overall}</span>
                      {r.summary.disagreement && (
                        <span className="ml-1.5 text-[11px] text-amber-300"
                          title={`Panellists differ by ${r.summary.spread} points`}>
                          ±{r.summary.spread}
                        </span>
                      )}
                    </td>
                    {crit.map(c => (
                      <td key={c.key} className="px-3 py-2.5 tabular-nums text-tnr-cream/70">
                        {r.summary.byCriterion[c.key] ?? '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 tabular-nums text-tnr-cream/60">
                      {r.summary.scored}{cov.panelSize ? ` / ${cov.panelSize}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-tnr-cream/60">
                      {r.summary.recommendations.select > 0 && `${r.summary.recommendations.select} select`}
                      {r.summary.recommendations.reject > 0 && ` ${r.summary.recommendations.reject} reject`}
                      {!r.summary.recommendations.select && !r.summary.recommendations.reject && '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Never at the bottom of the ranked table. */}
      {unranked.length > 0 && (
        <Card>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
            Not ranked ({unranked.length})
          </h4>
          <p className="mb-2 mt-1 text-[11.5px] text-tnr-cream/40">
            Kept out of the order rather than placed last — none of these is a
            poor result.
          </p>
          <ul className="space-y-1">
            {unranked.map(u => (
              <li key={u.id} className="flex justify-between gap-3 text-[13px]">
                <span className="text-tnr-cream/80">
                  {u.candidate?.full_name}
                  <span className="ml-1.5 text-[11px] text-tnr-cream/40">{u.candidate?.membership_id}</span>
                </span>
                <span className="text-tnr-cream/50">{u.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[11.5px] leading-relaxed text-tnr-cream/40">
        Ordered by panel average; ties broken by how many panellists scored the
        candidate, then by how much they agreed. Nothing here changes an
        application — Selected and Rejected are still set by hand on the
        applications table, by a person, after reading this.
      </p>
    </div>
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
  const [sending, setSending] = useState(null);
  const [eligible, setEligible] = useState(null);
  const [panel, setPanel] = useState(() => new Set());

  useEffect(() => {
    aGet(`/api/admin/opportunities/applications?opportunity_id=${opportunity.id}&status=interview_invited`)
      .then(r => {
        const list = r?.ok ? (r.applications || []) : [];
        setApps(list);
        setPicked(new Set(list.map(a => a.id)));
      });
  }, [opportunity.id]);

  useEffect(() => {
    aGet('/api/admin/opportunities/interviews?action=panel_candidates')
      .then(r => setEligible(r?.ok ? r.members : []));
  }, []);

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
      panellist_ids: [...panel],
      scheduled_at: when ? new Date(when).toISOString() : undefined,
      title: `${opportunity.title} — interviews`,
    });
    setSaving(false);
    if (!r?.ok) return toast?.([r?.message, r?.detail, r?.hint].filter(Boolean).join(' '), 'err');
    toast?.([r.message, r.warning].filter(Boolean).join(' '), 'ok');

    /* Tell everyone straight away.
     *
     * An interview nobody was told about is not an interview. This runs
     * immediately after the session exists rather than waiting for someone to
     * remember a second button — and it reports honestly if it could not
     * reach people, because "created successfully" while thirty candidates
     * heard nothing is the worst possible outcome. */
    setSending({ sent: 0, total: 0 });
    const e = await runEmails({
      sessionId: r.session.id,
      onProgress: (sent, total) => setSending({ sent, total }),
    });
    setSending(null);

    toast?.(
      e.ended === 'error'
        ? `The panel was created, but the invitations could not be sent. ${e.detail || ''}`
        : [`Invitations: ${e.tally}.`, e.detail, e.warning].filter(Boolean).join(' '),
      e.ended === 'done' && e.sent ? 'ok' : 'err');

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
        <h4 className="text-[11px] font-black uppercase tracking-wider text-tnr-cream/40">
          Who is on the panel ({panel.size})
        </h4>
        <p className="mb-2 mt-1 text-[11.5px] text-tnr-cream/40">
          Executive Committee and Advisory Council members. They score from
          their own member portal, so nobody needs an admin login to judge.
          Whoever chairs the room is marked chair automatically.
        </p>
        {eligible === null && <p className="text-sm text-tnr-cream/40">Loading the committee…</p>}
        {eligible?.length === 0 && (
          <p className="text-sm text-tnr-cream/50">
            No active CEC or Advisory Council members were found. Set members&apos;
            roles under Membership first, or there will be nobody able to score.
          </p>
        )}
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {(eligible || []).map(a => (
            <label key={a.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <input type="checkbox" checked={panel.has(a.id)}
                onChange={() => setPanel(p => {
                  const n = new Set(p);
                  if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                  return n;
                })} />
              <span className="text-sm text-tnr-cream">
                {a.full_name}
                <span className="ml-1.5 text-[12px] text-tnr-cream/40">
                  {a.membership_id} · {a.role === 'cec' ? 'CEC' : 'Advisory'}
                </span>
              </span>
            </label>
          ))}
        </div>
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

      <button onClick={create} disabled={saving || !!sending || !picked.size || !host}
        className="w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: LIGHT.green }}>
        {sending ? `Emailing… ${sending.sent}${sending.total ? ` of ${sending.total}` : ''}`
          : saving ? 'Creating…'
            : `Create the room and email ${picked.size} candidate(s) + the panel`}
      </button>
    </div>
  );
}
