'use client';
import { useCallback, useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet } from '@/components/member/memberApi';
import {
  SOURCES, activityLabel, activityIcon, fmtActivityDate, availableYears,
} from '@/lib/contributions';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* My Contribution.
 *
 * A member's own year in TNR: what they attended, what they wrote, what they
 * did in Roundu.
 *
 * THREE THINGS THIS PAGE DELIBERATELY DOES NOT SHOW, because the organisation
 * decided against them and a page is where such decisions quietly get undone:
 *
 *   • No score. Counts only.
 *   • No rank, no percentile, no "you are more active than 60% of members".
 *     There is nobody else on this page at all.
 *   • No judgement. It does not say "low participation" or colour a quiet
 *     year red. It reports what happened and leaves the reading to the person
 *     it belongs to — who very often has a reason the platform cannot see.
 */
export default function MyContribution() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    mGet(`/api/member/contributions?year=${year}`)
      .then(r => setD(r?.ok ? r : null))
      .finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const rec = d?.record;
  const m = rec?.meetings;
  const w = rec?.writing;
  const a = rec?.activities;
  const l = rec?.leadership;

  const counts = {
    meetings: m?.attended || 0,
    writing: (w?.opinions || 0) + (w?.comments || 0),
    activities: a?.count || 0,
    leadership: (l?.hosted || 0) + (l?.duties || 0),
  };
  const detail = {
    meetings: m?.invited
      ? `of ${m.invited} you were invited to`
      : 'you were not invited to any yet',
    writing: `${w?.opinions || 0} opinion${(w?.opinions || 0) === 1 ? '' : 's'}, ${w?.comments || 0} comment${(w?.comments || 0) === 1 ? '' : 's'}`,
    activities: a?.hours ? `${a.hours} hour${a.hours === 1 ? '' : 's'} recorded` : 'recorded by an office bearer',
    leadership: `${l?.hosted || 0} meeting${(l?.hosted || 0) === 1 ? '' : 's'} hosted`,
  };

  return (
    <MemberShell active="/member/contributions">
      <div style={mont}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: C.deep }}>My Contribution</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your participation in TNR, year by year. Only you and the office
              bearers can see this.
            </p>
          </div>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#0B6B4F]">
            {(d?.years || availableYears()).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </header>

        {/* Say when a figure could not be read, rather than showing a zero that
            looks like a quiet year. */}
        {!!d?.missing?.length && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            Some of your record could not be loaded ({d.missing.join(', ')}), so the
            figures below may be incomplete. Please tell the office.
          </div>
        )}

        {loading && !d && (
          <div className="mt-8 py-16 text-center text-sm text-gray-400">Loading your record…</div>
        )}

        {d && (
          <>
            {/* ── The four groups ── */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SOURCES.map(s => (
                <div key={s.key} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-2 text-3xl font-black tabular-nums" style={{ color: C.deep }}>
                    {counts[s.key]}
                  </div>
                  <p className="mt-0.5 text-[12px] text-gray-500">{detail[s.key]}</p>
                </div>
              ))}
            </div>

            {/* ── Meetings, spelled out ── */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: C.deep }}>
                Meetings in {d.year}
              </h2>
              {m?.invited ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <Fig n={m.attended} label="attended" />
                    <Fig n={m.partial} label="joined briefly" />
                    <Fig n={m.late} label="joined late" />
                    <Fig n={m.absent} label="missed" />
                    <Fig n={m.minutes} label="minutes present" />
                  </div>
                  {/* The bar is out of meetings they were INVITED to. */}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (m.attended / m.invited) * 100)}%`, background: C.green }} />
                  </div>
                  <p className="mt-2 text-[12.5px] text-gray-500">
                    You attended {m.attended} of the {m.invited} meeting{m.invited === 1 ? '' : 's'} you
                    were invited to.
                    {d.meetings_held > m.invited && (
                      <> TNR held {d.meetings_held} in total this year; the rest were for other groups.</>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  You have not been invited to any meetings in {d.year}.
                </p>
              )}
            </section>

            {/* ── Timeline ── */}
            <section className="mt-6">
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: C.deep }}>
                Everything recorded in {d.year}
              </h2>

              {!d.timeline?.length && (
                <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-600">
                    Nothing recorded for {d.year} yet.
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-[13px] text-gray-500">
                    Work you do in Roundu is added here by an office bearer. If
                    you have taken part in something that is not shown, tell
                    your union council team so it can be recorded.
                  </p>
                </div>
              )}

              <ol className="mt-3 space-y-2">
                {(d.timeline || []).map((it, i) => (
                  <li key={`${it.kind}-${it.id || i}`}
                    className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-xl leading-none">
                      {it.kind === 'meeting' ? '🎥'
                        : it.kind === 'opinion' ? '✍️'
                          : activityIcon(it.activity_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="font-bold text-gray-800">{it.title}</p>
                        <span className="text-[12px] text-gray-400">
                          {it.kind === 'activity'
                            ? fmtActivityDate(it.date)
                            : new Date(it.at).toLocaleDateString('en-GB',
                              { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-gray-500">
                        {it.kind === 'activity' ? activityLabel(it.activity_type) : it.detail}
                        {it.kind === 'activity' && it.hours ? ` · ${it.hours} hr` : ''}
                        {it.kind === 'activity' && it.location ? ` · ${it.location}` : ''}
                      </p>
                      {it.kind === 'activity' && it.detail && (
                        <p className="mt-1.5 whitespace-pre-line text-[13px] text-gray-600">{it.detail}</p>
                      )}
                      {it.kind === 'activity' && it.evidence_url && (
                        <a href={it.evidence_url} target="_blank" rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-[12.5px] font-semibold hover:underline"
                          style={{ color: C.green }}>
                          View the record →
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <p className="mt-6 text-[12px] leading-relaxed text-gray-400">
              This page counts what you have taken part in. It is not a score,
              and you are not being compared with anyone. If something is
              missing or wrong, tell the office and it will be corrected.
            </p>
          </>
        )}
      </div>
    </MemberShell>
  );
}

function Fig({ n, label }) {
  return (
    <span className="whitespace-nowrap">
      <b className="tabular-nums text-gray-800">{n || 0}</b>
      <span className="ml-1 text-gray-500">{label}</span>
    </span>
  );
}
