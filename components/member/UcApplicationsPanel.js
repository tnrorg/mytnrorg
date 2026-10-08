'use client';
import { useEffect, useState } from 'react';
import { mGet } from './memberApi';
import { APP_STATUS_LABEL, APP_STATUS_TONE, MOTIVATION_QUESTION } from '@/lib/ucCoordinator';

const C = { deep: '#063D2B', green: '#0B6B4F' };

/* UC Coordinator applications, read-only, for CEC members.
 *
 * Shown on the Interview Panel page. Renders NOTHING for anyone the server
 * says may not read them — an Advisory Council member on the same page sees no
 * empty box and no "access denied", just the page they already had.
 *
 * Grouped by Union Council like the admin screen, because the committee's
 * question is "who applied for Mendi", not "who applied on Tuesday".
 */
const DETAILS = [
  ['membership_id',     'Membership Number'],
  ['permanent_address', 'Permanent Address'],
  ['current_residence', 'Current Residence'],
  ['education',         'Education'],
  ['profession',        'Profession'],
];

export default function UcApplicationsPanel() {
  const [d, setD] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    mGet('/api/member/uc-applications').then(r => setD(r || null));
  }, []);

  if (!d || (d.ok && !d.allowed)) return null;

  const apps = d.applications || [];
  const groups = {};
  for (const a of apps) (groups[a.union_council || 'Not recorded'] ||= []).push(a);
  const ucNames = Object.keys(groups).sort();

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-black" style={{ color: C.deep }}>
            UC Coordinator Applications
          </h2>
          <p className="text-[12.5px] text-gray-500">
            {d.round
              ? `${d.round.title} · ${d.round.status === 'open' ? 'open' : 'closed'}`
                + `${d.round.closes_on ? ` · closes ${d.round.closes_on}` : ''}`
              : 'No recruitment round yet.'}
            {' · '}Read only — decisions are made by the admins.
          </p>
        </div>
        {!!apps.length && (
          <span className="text-[13px] font-semibold" style={{ color: C.deep }}>
            {apps.length} {apps.length === 1 ? 'application' : 'applications'}
          </span>
        )}
      </div>

      {!d.ok && (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          {d.message || 'Could not load the applications.'}
        </p>
      )}

      {d.ok && d.round && !apps.length && (
        <p className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
          No applications have been submitted yet.
        </p>
      )}

      {ucNames.map(uc => (
        <div key={uc} className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-[14px] font-bold" style={{ color: C.deep }}>
            {uc}
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: '#EEF3F0', color: '#4A554E' }}>
              {groups[uc].length}
            </span>
          </h3>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {groups[uc].map(a => {
              const tone = APP_STATUS_TONE[a.status] || APP_STATUS_TONE.new;
              const isOpen = openId === a.id;
              return (
                <div key={a.id} className="border-b border-gray-100 last:border-0">
                  <button type="button" onClick={() => setOpenId(isOpen ? null : a.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-800">{a.full_name}</span>
                      <span className="block truncate text-[11.5px] text-gray-400">
                        {a.membership_id}
                        {a.reference_no ? ` · ${a.reference_no}` : ''}
                        {' · '}{new Date(a.submitted_at || a.created_at).toLocaleDateString('en-GB')}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider"
                      style={{ background: tone.bg, color: tone.fg }}>
                      {APP_STATUS_LABEL[a.status] || 'Pending'}
                    </span>
                    <span className="shrink-0 text-gray-300">{isOpen ? '▴' : '▾'}</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4">
                      <dl className="divide-y rounded-xl border border-gray-100">
                        {DETAILS.map(([k, label]) => (
                          <div key={k} className="flex flex-wrap gap-x-3 px-3 py-2">
                            <dt className="w-full text-[11px] uppercase tracking-wide text-gray-400 sm:w-44">{label}</dt>
                            <dd className="flex-1 text-[13px] text-gray-700">
                              {a[k] || <span className="text-gray-400">Not recorded</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <h4 className="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        {MOTIVATION_QUESTION}
                      </h4>
                      <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-gray-700">
                        {a.motivation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
