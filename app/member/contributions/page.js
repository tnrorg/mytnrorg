'use client';
import { useCallback, useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet } from '@/components/member/memberApi';
import {
  SOURCES, activityLabel, activityIcon, fmtActivityDate, availableYears,
} from '@/lib/contributions';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
// One icon per timeline kind. A lookup rather than a chain of ternaries, so
// adding a source is one line and cannot silently fall through to the wrong
// icon.
const ICONS = { meeting: '🎥', opinion: '✍️', event: '📅', volunteer: '🤝' };

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

  const ev = rec?.events;
  const vol = rec?.volunteering;

  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const counts = {
    meetings: m?.attended || 0,
    events: ev?.attended || 0,
    volunteering: vol?.assignments || 0,
    writing: (w?.opinions || 0) + (w?.comments || 0),
    activities: a?.count || 0,
    leadership: (l?.hosted || 0) + (l?.duties || 0),
  };
  const detail = {
    meetings: m?.invited
      ? `of ${m.invited} you were invited to`
      : 'you were not invited to any yet',
    events: ev?.registered
      ? `of ${plural(ev.registered, 'registration')}`
      : 'programmes you took part in',
    volunteering: vol?.hours
      ? `${plural(vol.hours, 'hour')} served`
      : 'assignments taken on',
    writing: `${plural(w?.opinions || 0, 'opinion')}, ${plural(w?.comments || 0, 'comment')}`,
    activities: a?.hours ? `${plural(a.hours, 'hour')} recorded` : 'recorded by an office bearer',
    leadership: `${plural(l?.hosted || 0, 'meeting')} hosted`,
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
            {/* ── The six groups ── */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

            {/* ── Account use ── */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: C.deep }}>
                Your account
              </h2>
              <p className="mb-3 mt-0.5 text-[12.5px] text-gray-500">
                Shown to you because it is shown to the office bearers. Nothing is
                recorded about you here that you cannot see.
              </p>
              <AccountUse rec={rec} year={d.year} />
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
                      {ICONS[it.kind] || activityIcon(it.activity_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="font-bold text-gray-800">{it.title}</p>
                        <span className="text-[12px] text-gray-400">
                          {it.date
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


/* Account use, and what the member asked for.
 *
 * Kept in its own panel, under its own heading, with the caveat written on
 * screen rather than buried in a comment — because a number sitting in a grid
 * beside "Meetings attended" WILL be read as a performance figure no matter
 * what the documentation says.
 *
 * The same panel, with the same numbers, appears on the member's own page.
 * Nothing is recorded about a person here that they cannot see about
 * themselves. */
function AccountUse({ rec, year, dark = false }) {
  const p = rec?.portal || {};
  const q = rec?.requests || {};
  const box = dark
    ? 'rounded-xl border border-tnr-line px-3 py-2.5'
    : 'rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5';
  const big = dark ? 'text-tnr-cream' : '';
  const small = dark ? 'text-tnr-cream/50' : 'text-gray-400';
  const note = dark ? 'text-tnr-cream/40' : 'text-gray-400';

  const seen = p.lastSeen
    ? new Date(p.lastSeen).toLocaleDateString('en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' })
    : 'not since this was switched on';
  const since = p.memberSince
    ? new Date(p.memberSince).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Cell box={box} big={big} small={small} n={p.activeDays || 0} label={`Days used in ${year}`} />
        <Cell box={box} big={big} small={small} n={seen} label="Last opened" text />
        <Cell box={box} big={big} small={small} n={since} label="Member since" text />
        <Cell box={box} big={big} small={small} n={q.applications || 0} label="Applications sent" />
        <Cell box={box} big={big} small={small} n={q.tickets || 0} label="Support requests" />
        <Cell box={box} big={big} small={small} n={q.guidance || 0} label="Guidance asked" />
      </div>
      <p className={`mt-2 text-[11.5px] leading-relaxed ${note}`}>
        None of this counts as contribution and none of it is included in the
        totals above. How often someone opens the portal largely measures their
        signal and their data budget — a member running activities in a village
        with no coverage will show fewer days here than someone who reads the
        site daily and does nothing.
      </p>
    </div>
  );
}

function Cell({ box, big, small, n, label, text }) {
  return (
    <div className={box}>
      <div className={`${text ? 'text-[13px] font-bold' : 'text-xl font-black tabular-nums'} ${big}`}
        style={text ? undefined : { color: big ? undefined : '#063D2B' }}>
        {n}
      </div>
      <div className={`text-[10px] font-bold uppercase tracking-wide ${small}`}>{label}</div>
    </div>
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
