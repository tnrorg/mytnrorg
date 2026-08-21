'use client';
import { useCallback, useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet } from '@/components/member/memberApi';
import Avatar from '@/components/ui/Avatar';
import {
  APP_STATUS_LABEL, APP_STATUS_TONE, FELLOWSHIP_QUESTIONS, fmtDate,
} from '@/lib/opportunities';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* Applications for the selection panel to read.
 *
 * READ ONLY, and it says so. There are no decision buttons here because the
 * endpoint has no way to change anything — shortlisting, interviews and
 * selection stay in the admin panel, where each action is confirmed, emailed
 * and written to the audit history.
 *
 * A reviewer's job on this page is to read the answers and form a view. The
 * page is built for that: the five answers are the largest thing on each card,
 * and contact details are not shown at all.
 */
export default function OpportunityApplications() {
  const [d, setD] = useState(null);
  const [denied, setDenied] = useState(false);
  const [opp, setOpp] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    mGet('/api/member/opportunity-applications').then(r => {
      if (r?.ok) setD(r); else setDenied(true);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (denied) return (
    <MemberShell active="/member/opportunity-applications">
      <div className="py-16 text-center">
        <h1 style={{ ...mont, color: C.deep }} className="text-xl font-black">Not available</h1>
        <p className="mt-2 text-sm text-gray-500">
          You are not on the selection panel for these applications.
        </p>
      </div>
    </MemberShell>
  );

  const all = d?.applications || [];
  const rows = all.filter(a => {
    if (opp && a.opportunity?.id !== opp) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [a.applicant?.full_name, a.applicant?.membership_id]
      .some(v => String(v || '').toLowerCase().includes(q));
  });
  const S = d?.stats || {};

  return (
    <MemberShell active="/member/opportunity-applications">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">
            Applications for Review
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Scholarship and fellowship applications submitted by TNR members.
          </p>
        </div>
      </div>

      {/* Said once, plainly, at the top — so nobody hunts for buttons that are
          deliberately absent and concludes the page is broken. */}
      <div className="mt-4 rounded-xl border px-4 py-3 text-[12.5px]"
        style={{ borderColor: 'rgba(23,107,73,.25)', background: 'rgba(23,107,73,.05)', color: C.deep }}>
        <b>For review only.</b> Shortlisting, interviews and selection are carried
        out by the committee administrators. Contact details are not shown here.
      </div>

      {d?.hint && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {d.hint}
        </div>
      )}

      {/* ── Counts ── */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          ['Total', S.total], ['Submitted', S.submitted], ['Shortlisted', S.shortlisted],
          ['Interview', S.interview_invited], ['Selected', S.selected], ['Rejected', S.rejected],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <div className="text-xl font-black" style={{ color: C.deep }}>{n ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="mt-5 flex flex-wrap gap-2">
        <select value={opp} onChange={e => setOpp(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          <option value="">All opportunities</option>
          {(d?.opportunities || []).map(o => (
            <option key={o.id} value={o.id}>{o.title}</option>
          ))}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or membership ID…"
          className="flex-1 min-w-[200px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm" />
      </div>

      {!d && <p className="mt-6 text-sm text-gray-400">Loading…</p>}

      {d && !rows.length && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
          <div className="text-3xl">📋</div>
          <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">
            {all.length ? 'Nothing matches that filter' : 'No applications yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {all.length ? 'Try another opportunity or clear the search.'
              : 'Submitted applications will appear here for review.'}
          </p>
        </div>
      )}

      {/* ── Applications ── */}
      <div className="mt-6 space-y-3">
        {rows.map(a => {
          const open = openId === a.id;
          const tone = APP_STATUS_TONE[a.status] || APP_STATUS_TONE.submitted;
          return (
            <div key={a.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button onClick={() => setOpenId(open ? null : a.id)}
                className="w-full flex flex-wrap items-center gap-3 p-4 text-left">
                <Avatar src={a.applicant?.photo_url} gender={a.applicant?.gender}
                  name={a.applicant?.full_name || 'Member'} className="w-10 h-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[15px]" style={{ color: C.deep }}>
                    {a.applicant?.full_name || 'Unknown member'}
                  </div>
                  <div className="text-[11.5px] text-gray-500 flex flex-wrap gap-x-3">
                    <span className="font-mono">{a.applicant?.membership_id}</span>
                    {a.applicant?.education_level && <span>{a.applicant.education_level}</span>}
                    {a.answers?.semester && <span>{a.answers.semester}</span>}
                    {a.answers?.cgpa && <span className="font-semibold">CGPA {a.answers.cgpa}</span>}
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                  style={{ background: tone.bg, color: tone.fg }}>
                  {APP_STATUS_LABEL[a.status]}
                </span>
                <span className="text-[11px] text-gray-400 hidden sm:block">{fmtDate(a.submitted_at)}</span>
                <span className="text-gray-300 text-sm">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                  <p className="text-[11.5px] text-gray-500">
                    Applied to <b style={{ color: C.deep }}>{a.opportunity?.title || '—'}</b>
                    {a.opportunity?.organization ? ` · ${a.opportunity.organization}` : ''}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {FELLOWSHIP_QUESTIONS.map((q, i) => (
                      <div key={q.key}>
                        <div className="text-[11px] text-gray-400">{i + 1}. {q.label}</div>
                        <div className="text-[13.5px] font-semibold" style={{ color: C.deep }}>
                          {a.answers?.[q.key] || '—'}
                          {q.otherKey && a.answers?.[q.otherKey] ? ` — ${a.answers[q.otherKey]}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </MemberShell>
  );
}
