'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from '../adminApi';
import { Card } from '../ui';
import {
  APP_STATUSES, APP_STATUS_LABEL, APP_STATUS_TONE, INTERVIEW_MODES,
  FELLOWSHIP_QUESTIONS, fmtDate,
} from '@/lib/opportunities';

const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';

/* Dialogs on this screen are LIGHT.
 *
 * The list behind them is a light panel, and these two carry an applicant's
 * personal details and interview arrangements — things read carefully rather
 * than glanced at. Dark-on-light is the easier read for that, and a black
 * dialog over a white table simply looked like a mistake. */
const LIGHT = { deep: '#063D2B', green: '#0B6B4F' };
const lightInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

/* How many applicants go to the server in one request.
 *
 * Each one costs a database write and an SMTP round trip. Thirty in a single
 * request will hit the serverless time limit, the connection drops mid-run,
 * and nobody — including the admin — knows how many emails actually went out.
 * Eight at a time finishes comfortably and reports after every batch, so the
 * progress bar reflects work genuinely done rather than a guess.
 *
 * The server enforces this same cap independently. */
const CHUNK = 8;

const DECISIONS = [
  ['shortlisted', 'Shortlist'],
  ['interview_invited', 'Interview Invite'],
  ['selected', 'Selected'],
  ['rejected', 'Reject'],
];

/** Today as YYYY-MM-DD, in the admin's own timezone — not UTC. */
function todayStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* The chosen date and time, written out the way a person reads them.
 *
 * "2026-09-09" and "21:00" are what the inputs hold; nobody checking an
 * invitation before it goes to twenty-nine people should have to decode that.
 * Spelling out "Wednesday, 9 September 2026 at 9:00 pm" is how a wrong month
 * gets noticed before the emails leave. */
function prettyWhen(date, time) {
  if (!date) return '';
  const d = new Date(`${date}T${time || '00:00'}`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString(undefined,
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (!time) return day;
  return `${day} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function isPast(date, time) {
  if (!date) return false;
  const d = new Date(`${date}T${time || '00:00'}`);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

/* Applications for one opportunity.
 *
 * Decisions can be made one at a time from the detail dialog, or to many
 * applicants at once from the table. Both paths go through the same server
 * route, which refuses a status an application is already on — so neither a
 * double-click nor an overlapping bulk run can send a second email.
 * That is the failure applicants actually notice.
 */
export default function ApplicationsView({ opportunity, onBack, toast }) {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);        // application id
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [interviewFor, setInterviewFor] = useState(null);   // one application
  const [sel, setSel] = useState(() => new Set());          // bulk selection
  const [bulkInterview, setBulkInterview] = useState(false);
  const [run, setRun] = useState(null);                     // bulk progress + report

  const load = () => aGet(
    `/api/admin/opportunities/applications?opportunity_id=${opportunity.id}${status ? `&status=${status}` : ''}`
  ).then(r => setD(r?.ok ? r : { applications: [], stats: {} }));
  useEffect(load, [status]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) { setDetail(null); return; }
    aGet(`/api/admin/opportunities/applications?id=${open}`).then(r => setDetail(r?.ok ? r : null));
  }, [open]);

  async function decide(app, to, label, interview) {
    if (!interview && !confirm(`Are you sure you want to mark this applicant ${label}?`)) return;
    setBusyId(app.id);
    const r = await aPost('/api/admin/opportunities/applications',
      { id: app.id, status: to, ...(interview ? { interview } : {}) });
    setBusyId(null);

    if (!r.ok) return toast?.(r.message || 'Could not update.', 'err');
    if (r.unchanged) return toast?.(r.message, 'ok');

    // Status and email are reported separately: one can succeed while the
    // other fails, and telling an admin "done" when the applicant was never
    // told is how someone waits a week for an email that never came.
    toast?.(r.message, r.email?.sent === false && !r.email?.skipped ? 'err' : 'ok');
    setInterviewFor(null);
    load();
    if (open === app.id) setOpen(null);
  }

  async function retryEmail(app) {
    setBusyId(app.id);
    const r = await aPost('/api/admin/opportunities/applications', { id: app.id, action: 'retry_email' });
    setBusyId(null);
    toast?.(r.ok ? 'Notification email sent.' : (r.message || 'Still could not send.'), r.ok ? 'ok' : 'err');
    load();
  }

  const all = d?.applications || [];

  const rows = all.filter(a => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [a.member?.full_name, a.member?.membership_id]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  /* Selection is held as ids and read back against the FULL list, not the
   * filtered one. Typing in the search box must not silently drop people from
   * a selection the admin has already made — they would find out only when the
   * count on the button changed under them. */
  const selected = all.filter(a => sel.has(a.id));
  const shortlisted = all.filter(a => a.status === 'shortlisted');

  const toggle = (id) => setSel(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const visibleAllSelected = rows.length > 0 && rows.every(a => sel.has(a.id));
  const toggleVisible = () => setSel(prev => {
    const next = new Set(prev);
    if (visibleAllSelected) rows.forEach(a => next.delete(a.id));
    else rows.forEach(a => next.add(a.id));
    return next;
  });

  /* ── Run a decision across the selection ──
   *
   * In batches, with the results of each batch shown as they arrive. If the
   * admin closes the tab halfway, everything already reported has genuinely
   * happened and everyone else is untouched — there is no half-applied state
   * to clean up, because each applicant is committed independently. */
  async function runBulk(to, interview) {
    const ids = selected.map(a => a.id);
    if (!ids.length) return;

    setRun({ total: ids.length, results: [], busy: true, label: APP_STATUS_LABEL[to] || to });
    setBulkInterview(false);

    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const r = await aPost('/api/admin/opportunities/applications',
        { ids: slice, status: to, ...(interview ? { interview } : {}) });

      const batch = r?.ok && Array.isArray(r.results)
        ? r.results
        // A whole batch failing is reported per applicant rather than as one
        // line, so the tally at the end still adds up to the number selected.
        : slice.map(id => ({
          id,
          name: all.find(a => a.id === id)?.member?.full_name || 'Applicant',
          state: 'failed',
          note: r?.message || 'Request failed.',
        }));

      setRun(prev => prev ? { ...prev, results: [...prev.results, ...batch] } : prev);
    }

    setRun(prev => prev ? { ...prev, busy: false } : prev);
    setSel(new Set());
    load();
  }

  function startBulk(to, label) {
    if (!selected.length) return;
    if (to === 'interview_invited') { setBulkInterview(true); return; }
    if (!confirm(
      `Mark ${selected.length} applicant${selected.length === 1 ? '' : 's'} as ${label}?\n\n`
      + `Each one will be emailed. This cannot be undone from here.`
    )) return;
    runBulk(to);
  }

  const S = d?.stats || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-tnr-cream truncate">{opportunity.title}</h2>
          <p className="text-sm text-tnr-cream/50">Applications</p>
        </div>
        <button onClick={onBack} className="text-sm text-tnr-cream/60 hover:underline">
          ← All opportunities
        </button>
      </div>

      {/* ── Statistics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          ['Total', S.total, null],
          ['Submitted', S.submitted, 'submitted'],
          ['Shortlisted', S.shortlisted, 'shortlisted'],
          ['Interview', S.interview_invited, 'interview_invited'],
          ['Selected', S.selected, 'selected'],
          ['Rejected', S.rejected, 'rejected'],
        ].map(([label, n, key]) => (
          <button key={label} onClick={() => setStatus(key === status ? '' : (key || ''))}
            className={`rounded-xl border px-3 py-2.5 text-left transition ${status && status === key
              ? 'border-tnr-gold/50 bg-tnr-gold/10' : 'border-tnr-line hover:bg-white/5'}`}>
            <div className="text-xl font-black text-tnr-cream">{n ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{label}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or membership ID…" className={`${input} flex-1 min-w-[200px]`} />
        {/* The shortcut the interview round actually needs: everyone who has
            been shortlisted, regardless of what the search box is showing. */}
        {shortlisted.length > 0 && (
          <button onClick={() => setSel(new Set(shortlisted.map(a => a.id)))}
            className="px-4 py-2 rounded-xl border border-tnr-line text-sm font-semibold text-tnr-cream/80 hover:bg-white/5 whitespace-nowrap">
            Select all shortlisted ({shortlisted.length})
          </button>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-20 rounded-2xl border border-tnr-gold/40 bg-tnr-gold/10 backdrop-blur px-4 py-3
          flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-tnr-cream">
            {selected.length} selected
          </span>
          <button onClick={() => setSel(new Set())}
            className="text-xs text-tnr-cream/60 hover:underline">Clear</button>

          <div className="flex-1" />

          {DECISIONS.map(([to, label]) => (
            <button key={to} onClick={() => startBulk(to, label)} disabled={!!run?.busy}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition ${to === 'rejected'
                ? 'border border-red-400/60 text-red-300 hover:bg-red-500/10'
                : 'text-white hover:opacity-90'}`}
              style={to === 'rejected' ? undefined : { background: LIGHT.green }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {!rows.length && (
        <Card><div className="text-sm text-tnr-cream/40 text-center py-8">
          {d ? 'No applications match.' : 'Loading…'}
        </div></Card>
      )}

      {/* ── Table ── */}
      {rows.length > 0 && (
        <div className="rounded-2xl border border-tnr-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-tnr-cream/40 border-b border-tnr-line">
                <th className="px-3 py-2.5">
                  <input type="checkbox" checked={visibleAllSelected} onChange={toggleVisible}
                    aria-label="Select all shown" className="w-4 h-4 accent-[#0B6B4F] cursor-pointer" />
                </th>
                {['Applicant', 'Membership ID', 'Qualification', 'Semester', 'CGPA', 'Profession', 'Internet', 'Device', 'Applied', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(a => {
                const tone = APP_STATUS_TONE[a.status] || APP_STATUS_TONE.submitted;
                const on = sel.has(a.id);
                return (
                  <tr key={a.id}
                    className={`border-b border-tnr-line/50 ${on ? 'bg-tnr-gold/10' : 'hover:bg-white/5'}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={on} onChange={() => toggle(a.id)}
                        aria-label={`Select ${a.member?.full_name || 'applicant'}`}
                        className="w-4 h-4 accent-[#0B6B4F] cursor-pointer" />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-tnr-cream whitespace-nowrap">
                      {a.member?.full_name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-tnr-cream/60 font-mono text-xs">{a.member?.membership_id || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/60">{a.member?.education_level || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/60 whitespace-nowrap">{a.answers?.semester || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/80 font-semibold tabular-nums">{a.answers?.cgpa || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/60">{a.member?.profession || a.member?.field_of_study || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/60">{a.answers?.internet || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/60">{a.answers?.device || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/50 whitespace-nowrap">{fmtDate(a.submitted_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                        style={{ background: tone.bg, color: tone.fg }}>
                        {APP_STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button onClick={() => setOpen(a.id)}
                        className="text-xs text-tnr-goldLight hover:underline">Open</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── One application ── */}
      {open && detail && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 backdrop-blur-sm overflow-auto"
          onClick={() => setOpen(null)}>
          {/* A light card, matching the panel behind it.
              This dialog carries an applicant's personal details and is read
              carefully rather than glanced at — dark-on-light is the easier
              read for that, and it is what the rest of this screen already is. */}
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 my-8 space-y-5 shadow-xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold" style={{ color: LIGHT.deep }}>{detail.member?.full_name}</h3>
                <p className="text-xs text-gray-500 font-mono">{detail.member?.membership_id}</p>
              </div>
              <button onClick={() => setOpen(null)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
            </div>

            {/* Member information — read live from their profile */}
            <section>
              <h4 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Member information</h4>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                {[
                  ['Email', detail.member?.email], ['Mobile', detail.member?.mobile],
                  ['Date of birth', detail.member?.date_of_birth ? fmtDate(detail.member.date_of_birth) : null],
                  ['Gender', detail.member?.gender],
                  ['Qualification', detail.member?.education_level],
                  ['Profession', detail.member?.profession || detail.member?.field_of_study],
                  ['Village', detail.member?.village], ['Union Council', detail.member?.union_council],
                  ...Object.entries(detail.application?.profile_gaps || {}).map(([k, v]) => [`${k} (supplied)`, v]),
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-gray-100 pb-1">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-gray-800 text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Their answers */}
            <section>
              <h4 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Application answers</h4>
              <div className="space-y-2">
                {FELLOWSHIP_QUESTIONS.map((q, i) => (
                  <div key={q.key} className="text-[13px]">
                    <div className="text-gray-500">{i + 1}. {q.label}</div>
                    <div className="font-semibold" style={{ color: LIGHT.deep }}>
                      {detail.application?.answers?.[q.key] || '—'}
                      {q.otherKey && detail.application?.answers?.[q.otherKey]
                        ? ` — ${detail.application.answers[q.otherKey]}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Timeline */}
            <section>
              <h4 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Timeline</h4>
              <div className="space-y-1.5">
                {(detail.history || []).map(h => (
                  <div key={h.id} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                    <span className="font-semibold" style={{ color: LIGHT.deep }}>
                      {APP_STATUS_LABEL[h.to_status] || h.to_status}
                    </span>
                    <span className="text-gray-500">by {h.changed_by}</span>
                    <span className="text-gray-400">{new Date(h.created_at).toLocaleString()}</span>
                    {h.email_status === 'sent' && <span className="text-green-700 font-semibold">email sent</span>}
                    {h.email_status === 'failed' && (
                      <span className="text-red-600 font-semibold">
                        email failed{h.email_error ? ` — ${h.email_error}` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {(detail.history || []).some(h => h.email_status === 'failed') && (
                <button onClick={() => retryEmail(detail.application)} disabled={busyId === detail.application?.id}
                  className="mt-2 text-xs font-bold hover:underline disabled:opacity-40"
                  style={{ color: LIGHT.green }}>
                  Retry email
                </button>
              )}
            </section>

            {/* Decisions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
              {DECISIONS.map(([to, label]) => (
                <button key={to}
                  disabled={busyId === detail.application?.id || detail.application?.status === to}
                  onClick={() => to === 'interview_invited'
                    ? setInterviewFor(detail.application)
                    : decide(detail.application, to, label)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition ${to === 'rejected'
                    ? 'border border-red-300 text-red-600 hover:bg-red-50'
                    : 'text-white'}`}
                  style={to === 'rejected' ? undefined : { background: LIGHT.green }}>
                  {busyId === detail.application?.id ? 'Working…' : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Interview details: one applicant ── */}
      {interviewFor && (
        <InterviewModal count={1} busy={busyId === interviewFor.id}
          onCancel={() => setInterviewFor(null)}
          onSend={(iv) => decide(interviewFor, 'interview_invited', 'Interview Invite', iv)} />
      )}

      {/* ── Interview details: everyone selected, one set of details ── */}
      {bulkInterview && (
        <InterviewModal count={selected.length} busy={!!run?.busy}
          names={selected.map(a => a.member?.full_name || a.member?.membership_id || 'Applicant')}
          onCancel={() => setBulkInterview(false)}
          onSend={(iv) => runBulk('interview_invited', iv)} />
      )}

      {/* ── Bulk progress and report ── */}
      {run && <BulkReport run={run} onClose={() => setRun(null)} />}
    </div>
  );
}

/* Interview details, for one applicant or for many.
 *
 * The same details go to everyone in a bulk send — one slot, one link, one set
 * of instructions. That is stated plainly at the top, because an admin who
 * assumed each person would get their own time would otherwise only discover
 * it after twenty-nine emails had gone out.
 */
function InterviewModal({ count = 1, names, busy, onCancel, onSend }) {
  const [iv, setIv] = useState({ date: '', time: '', mode: 'Online', venue: '', notes: '' });
  const ready = iv.date.trim() && iv.time.trim();
  const many = count > 1;
  const when = prettyWhen(iv.date, iv.time);
  const past = isPast(iv.date, iv.time);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/50 backdrop-blur-sm overflow-auto"
      onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 my-8 space-y-3 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold" style={{ color: LIGHT.deep }}>
          Interview invitation{many ? ` — ${count} applicants` : ''}
        </h3>
        <p className="text-[12px] text-gray-500">
          These details go straight into the applicant&rsquo;s email, so write them
          as you want them read.
        </p>

        {many && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <strong>All {count} will receive the same date, time and venue.</strong> If
            people need individual slots, invite them one at a time from
            <span className="font-semibold"> Open</span> instead.
            {names?.length ? (
              <details className="mt-1.5">
                <summary className="cursor-pointer font-semibold">Who will be emailed</summary>
                <ul className="mt-1 max-h-32 overflow-auto list-disc pl-4 space-y-0.5">
                  {names.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Date *</span>
            <input type="date" value={iv.date} min={todayStr()}
              onChange={e => setIv({ ...iv, date: e.target.value })} className={lightInput} />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Time *</span>
            <input type="time" value={iv.time}
              onChange={e => setIv({ ...iv, time: e.target.value })} className={lightInput} />
          </label>
        </div>

        {/* Written out in full — see prettyWhen. */}
        {when && (
          <div className={`rounded-xl px-3 py-2 text-[12.5px] ${past
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
            {past ? '⚠ That is in the past — ' : 'Applicants will be told: '}
            <strong>{when}</strong>
          </div>
        )}

        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Mode</span>
          <select value={iv.mode} onChange={e => setIv({ ...iv, mode: e.target.value })} className={lightInput}>
            {INTERVIEW_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">
            {/online|phone|whatsapp/i.test(iv.mode) ? 'Meeting link / number' : 'Venue'}
          </span>
          <input value={iv.venue} onChange={e => setIv({ ...iv, venue: e.target.value })} className={lightInput} />
        </label>

        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Additional instructions (optional)</span>
          <textarea rows={3} value={iv.notes} onChange={e => setIv({ ...iv, notes: e.target.value })} className={lightInput} />
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSend(iv)} disabled={!ready || busy}
            className="flex-1 px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: LIGHT.green }}>
            {busy ? 'Sending…' : many ? `Send to ${count}` : 'Send invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* What actually happened, applicant by applicant.
 *
 * A bulk run of thirty is exactly the situation where "Done!" is useless. The
 * three outcomes are kept apart because they need different responses:
 *   done         — nothing to do
 *   skipped      — already at that status; no second email was sent
 *   email failed — the decision IS recorded, only the message did not go, and
 *                  Retry Email on that row will send it
 *   failed       — nothing changed for that person; they can be selected again
 */
const STATE_META = {
  done: { label: 'Sent', cls: 'text-green-700' },
  skipped: { label: 'Skipped', cls: 'text-gray-500' },
  email_failed: { label: 'Email failed', cls: 'text-amber-700' },
  failed: { label: 'Failed', cls: 'text-red-600' },
  missing: { label: 'Not found', cls: 'text-red-600' },
};

function BulkReport({ run, onClose }) {
  const done = run.results.length;
  const pct = run.total ? Math.round((done / run.total) * 100) : 0;
  const count = (s) => run.results.filter(r => r.state === s).length;
  const problems = run.results.filter(r => r.state !== 'done');

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={run.busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 space-y-4 shadow-xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold" style={{ color: LIGHT.deep }}>
          {run.busy ? `Sending… ${done} of ${run.total}` : 'Finished'}
        </h3>

        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: LIGHT.green }} />
        </div>

        {run.busy && (
          <p className="text-[12px] text-gray-500">
            Sent in small batches so nothing is lost part-way. Please keep this
            tab open until it finishes.
          </p>
        )}

        {!run.busy && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {['done', 'skipped', 'email_failed', 'failed', 'missing']
              .filter(s => count(s) > 0)
              .map(s => (
                <span key={s} className={`font-semibold ${STATE_META[s].cls}`}>
                  {count(s)} {STATE_META[s].label.toLowerCase()}
                </span>
              ))}
          </div>
        )}

        {/* Only the ones needing attention are listed. A list of thirty names
            that all say "Sent" buries the one that did not. */}
        {!run.busy && problems.length > 0 && (
          <div className="max-h-52 overflow-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
            {problems.map((r, i) => (
              <div key={`${r.id}-${i}`} className="px-3 py-2 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-gray-800">{r.name}</span>
                  <span className={`font-bold whitespace-nowrap ${STATE_META[r.state]?.cls || 'text-gray-500'}`}>
                    {STATE_META[r.state]?.label || r.state}
                  </span>
                </div>
                {r.note && <div className="text-gray-500 mt-0.5">{r.note}</div>}
              </div>
            ))}
          </div>
        )}

        {!run.busy && count('email_failed') > 0 && (
          <p className="text-[12px] text-gray-600">
            Those applicants <strong>are</strong> marked {run.label?.toLowerCase()} — only the
            email did not go. Open each one and use <strong>Retry email</strong>.
          </p>
        )}

        <button onClick={onClose} disabled={run.busy}
          className="w-full px-4 py-2 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
          style={{ background: LIGHT.green }}>
          {run.busy ? 'Working…' : 'Close'}
        </button>
      </div>
    </div>
  );
}
