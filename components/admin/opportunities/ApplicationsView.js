'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from '../adminApi';
import { Card } from '../ui';
import {
  APP_STATUSES, APP_STATUS_LABEL, APP_STATUS_TONE, INTERVIEW_MODES,
  FELLOWSHIP_QUESTIONS, fmtDate,
} from '@/lib/opportunities';

const input = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream';

/* Applications for one opportunity.
 *
 * The four decisions each: confirm → update → record history → email → report.
 * The button is disabled while a decision is in flight, and the server refuses
 * a status it is already on, so a double-click cannot send a second email.
 * That is the failure applicants actually notice.
 */
export default function ApplicationsView({ opportunity, onBack, toast }) {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);        // application id
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [interviewFor, setInterviewFor] = useState(null);

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

  const rows = (d?.applications || []).filter(a => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [a.member?.full_name, a.member?.membership_id]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

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

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or membership ID…" className={input} />

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
                {['Applicant', 'Membership ID', 'Qualification', 'Profession', 'Internet', 'Device', 'Applied', 'Status', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(a => {
                const tone = APP_STATUS_TONE[a.status] || APP_STATUS_TONE.submitted;
                return (
                  <tr key={a.id} className="border-b border-tnr-line/50 hover:bg-white/5">
                    <td className="px-3 py-2.5 font-semibold text-tnr-cream whitespace-nowrap">
                      {a.member?.full_name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-tnr-cream/60 font-mono text-xs">{a.member?.membership_id || '—'}</td>
                    <td className="px-3 py-2.5 text-tnr-cream/60">{a.member?.education_level || '—'}</td>
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
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm overflow-auto"
          onClick={() => setOpen(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-tnr-black p-6 my-8 space-y-5"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-tnr-cream">{detail.member?.full_name}</h3>
                <p className="text-xs text-tnr-cream/50 font-mono">{detail.member?.membership_id}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-tnr-cream/40 hover:text-tnr-cream">✕</button>
            </div>

            {/* Member information — read live from their profile */}
            <section>
              <h4 className="text-xs uppercase tracking-wide text-tnr-cream/40 mb-2">Member information</h4>
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
                  <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-1">
                    <dt className="text-tnr-cream/40">{k}</dt>
                    <dd className="text-tnr-cream/80 text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Their answers */}
            <section>
              <h4 className="text-xs uppercase tracking-wide text-tnr-cream/40 mb-2">Application answers</h4>
              <div className="space-y-2">
                {FELLOWSHIP_QUESTIONS.map((q, i) => (
                  <div key={q.key} className="text-[13px]">
                    <div className="text-tnr-cream/40">{i + 1}. {q.label}</div>
                    <div className="text-tnr-cream font-semibold">
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
              <h4 className="text-xs uppercase tracking-wide text-tnr-cream/40 mb-2">Timeline</h4>
              <div className="space-y-1.5">
                {(detail.history || []).map(h => (
                  <div key={h.id} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                    <span className="text-tnr-cream/80 font-semibold">
                      {APP_STATUS_LABEL[h.to_status] || h.to_status}
                    </span>
                    <span className="text-tnr-cream/40">by {h.changed_by}</span>
                    <span className="text-tnr-cream/30">{new Date(h.created_at).toLocaleString()}</span>
                    {h.email_status === 'sent' && <span className="text-green-300">email sent</span>}
                    {h.email_status === 'failed' && (
                      <span className="text-red-300">email failed{h.email_error ? ` — ${h.email_error}` : ''}</span>
                    )}
                  </div>
                ))}
              </div>
              {(detail.history || []).some(h => h.email_status === 'failed') && (
                <button onClick={() => retryEmail(detail.application)} disabled={busyId === detail.application?.id}
                  className="mt-2 text-xs font-bold text-tnr-goldLight hover:underline disabled:opacity-40">
                  Retry email
                </button>
              )}
            </section>

            {/* Decisions */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-tnr-line">
              {[
                ['shortlisted', 'Shortlist'],
                ['interview_invited', 'Interview Invite'],
                ['selected', 'Selected'],
                ['rejected', 'Reject'],
              ].map(([to, label]) => (
                <button key={to}
                  disabled={busyId === detail.application?.id || detail.application?.status === to}
                  onClick={() => to === 'interview_invited'
                    ? setInterviewFor(detail.application)
                    : decide(detail.application, to, label)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 ${to === 'rejected'
                    ? 'border border-red-500/30 text-red-300 hover:bg-red-500/10'
                    : 'bg-tnr-gold text-tnr-black'}`}>
                  {busyId === detail.application?.id ? 'Working…' : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Interview details ── */}
      {interviewFor && (
        <InterviewModal app={interviewFor} busy={busyId === interviewFor.id}
          onCancel={() => setInterviewFor(null)}
          onSend={(iv) => decide(interviewFor, 'interview_invited', 'Interview Invite', iv)} />
      )}
    </div>
  );
}

function InterviewModal({ app, busy, onCancel, onSend }) {
  const [iv, setIv] = useState({ date: '', time: '', mode: 'Online', venue: '', notes: '' });
  const ready = iv.date.trim() && iv.time.trim();

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-tnr-black p-6 space-y-3"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-tnr-cream">Interview invitation</h3>
        <p className="text-[12px] text-tnr-cream/50">
          These details go straight into the applicant&rsquo;s email, so write them
          as you want them read.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-tnr-cream/50 mb-1">Date *</span>
            <input type="date" value={iv.date} onChange={e => setIv({ ...iv, date: e.target.value })} className={input} />
          </label>
          <label className="block">
            <span className="block text-xs text-tnr-cream/50 mb-1">Time *</span>
            <input type="time" value={iv.time} onChange={e => setIv({ ...iv, time: e.target.value })} className={input} />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs text-tnr-cream/50 mb-1">Mode</span>
          <select value={iv.mode} onChange={e => setIv({ ...iv, mode: e.target.value })} className={input}>
            {INTERVIEW_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-tnr-cream/50 mb-1">
            {/online|phone|whatsapp/i.test(iv.mode) ? 'Meeting link / number' : 'Venue'}
          </span>
          <input value={iv.venue} onChange={e => setIv({ ...iv, venue: e.target.value })} className={input} />
        </label>

        <label className="block">
          <span className="block text-xs text-tnr-cream/50 mb-1">Additional instructions (optional)</span>
          <textarea rows={3} value={iv.notes} onChange={e => setIv({ ...iv, notes: e.target.value })} className={input} />
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-tnr-cream">
            Cancel
          </button>
          <button onClick={() => onSend(iv)} disabled={!ready || busy}
            className="flex-1 px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm disabled:opacity-40">
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
