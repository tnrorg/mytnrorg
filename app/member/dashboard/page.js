'use client';
import { useEffect, useState } from 'react';
import { roleLabel } from '@/lib/membership/roles';
import { profileCompletion } from '@/lib/membership/profile';
import { APP_STATUS_LABEL } from '@/lib/opportunities';
import { mGet } from '@/components/member/memberApi';
import MemberShell from '@/components/member/MemberShell';
import Avatar from '@/components/member/Avatar';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', soft: '#F3E4B3' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

const QUICK = [
  ['Complete Profile', '/member/profile', '👤'],
  ['Create CV', '/member/cv-builder', '📄'],
  ['Cover Letter', '/member/cover-letters', '✉️'],
  ['Membership Card', '/member/membership-card', '🪪'],
  ['Opportunities', '/member/opportunities', '💼'],
  ['Upload Document', '/member/certificates', '📎'],
];

export default function MemberDashboard() {
  // Completion needs the CV sections, not just the member row.
  const [profile, setProfile] = useState(null);
  const [notices, setNotices] = useState(null);     // announcements
  const [vacancies, setVacancies] = useState([]);   // open CEC positions
  const [opportunities, setOpportunities] = useState([]);   // open to this member

  useEffect(() => {
    mGet('/api/member/profile').then(r => r?.ok && setProfile(r));

    /* The announcements panel used to be a hardcoded "No announcements yet".
     * It never asked for anything, so an admin could publish a notice and it
     * would appear in the site ticker while the portal kept insisting there
     * was nothing — the one place members actually look. */
    fetch('/api/public/announcements', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setNotices(j?.ok ? (j.items || []) : []))
      .catch(() => setNotices([]));

    /* Open Executive Committee positions, shown to EVERY member.
     *
     * Sitting CEC members already have a review queue; ordinary members had no
     * way to learn a position was open other than the public site. A vacancy
     * nobody hears about gets the applications it deserves. */
    fetch('/api/public/cec', { cache: 'no-store' })
      .then(r => r.json())
      /* `accepting`, not `status`. The API works out whether a position is
       * genuinely still open — a vacancy whose closing date has passed keeps
       * status 'open' until someone remembers to change it, and advertising
       * "Apply here" for a closed position wastes the member's time. */
      .then(j => setVacancies((j?.vacancies || []).filter(v => v.accepting)))
      .catch(() => setVacancies([]));

    /* Open opportunities, from the MEMBER endpoint rather than the public one.
     *
     * The public board carries only the teaser and knows nothing about who is
     * reading it. This route is behind requireMember, so it can also say
     * whether this member has already applied — which is the difference
     * between "Apply here" and telling someone they already did.
     *
     * Capped at three. A dashboard is a summary; the full board is one click
     * away, and a card listing eleven programmes is a page nobody reads. */
    mGet('/api/member/opportunities')
      .then(r => {
        if (!r?.ok) return;
        const live = (r.opportunities || [])
          .filter(o => o.state === 'open' || o.state === 'closing_soon')
          .slice(0, 3);
        setOpportunities(live);
      })
      .catch(() => setOpportunities([]));
  }, []);

  return (
    <MemberShell active="/member/dashboard">
      {(m) => (
        <>
          <div className="rounded-3xl p-6 sm:p-8 text-white shadow-xl" style={{ background: `linear-gradient(165deg,${C.deep},#04241A)` }}>
            <div className="flex items-center gap-4 flex-wrap">
              <Avatar src={m?.photo_url} name={m?.full_name} fontSize={22}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#D4A72C]/60 bg-white/10" />
              <div className="min-w-0">
                <h1 style={mont} className="text-2xl font-black">Welcome Back, {m?.first_name}</h1>
                <div className="text-sm text-white/60 mt-0.5">
                  <span className="font-mono" style={{ color: C.soft }}>{m?.membership_id}</span>
                  {m?.union_council && <> · {m.union_council}</>}
                  {m?.village && <> · {m.village}</>}
                </div>
              </div>
              {/* Membership type as well as status, so an Advisory Council or
                  Executive member can see their role at a glance rather than
                  wondering why the portal looks like everyone else's. */}
              <div className="ml-auto flex flex-wrap gap-2 justify-end">
                {m?.role && m.role !== 'general' && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                    {roleLabel(m.role).toUpperCase()}
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(212,167,44,0.18)', color: C.soft }}>
                  {String(m?.status || '').toUpperCase()} MEMBER
                </span>
                {/* Back to the public site. Sits with the badges because this
                    is where the eye already is on arriving, and because the
                    only other way out of the portal was signing out. */}
                <a href="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                    transition-colors hover:bg-white/20"
                  style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                  🌐 View Website
                </a>
              </div>
            </div>
          </div>

          {/* Stats — real values only; features arrive in later phases */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Profile Completion', profileCompletion(m, profile || {}).percent + '%'], ['CVs Created', '0'],
              ['Cover Letters', '0'], ['Certificates', '0']].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 text-center">
                <div style={{ ...mont, color: C.deep }} className="text-2xl font-black">{v}</div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{l}</div>
              </div>
            ))}
          </div>

          {/* A bare percentage is not actionable. Name the section worth the
              most and show what completing it is worth. */}
          {(() => {
            const c = profileCompletion(m, profile || {});
            if (!profile || !c.missing.length) return null;
            return (
              <a href="/member/profile"
                className="mt-6 flex items-center gap-4 rounded-2xl bg-white border border-gray-100 p-4
                  hover:border-[#0B6B4F]/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: C.deep }}>
                    Add your {c.missing[0].label.toLowerCase()} to reach {c.percent + c.missing[0].weight}%
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${c.percent}%`,
                               background: `linear-gradient(90deg,${C.green},${C.gold})` }} />
                  </div>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: C.green }}>Complete →</span>
              </a>
            );
          })()}

          <h2 style={{ ...mont, color: C.deep }} className="mt-8 text-sm font-black uppercase tracking-wide">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK.map(([t, href, icon]) => (
              <a key={t} href={href}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition p-4 text-center">
                <div className="text-2xl">{icon}</div>
                <div className="mt-2 text-xs font-bold" style={{ color: C.deep }}>{t}</div>
              </a>
            ))}
          </div>

          {/* ── Announcements ── */}
          <h2 style={{ ...mont, color: C.deep }} className="mt-8 text-sm font-black uppercase tracking-wide">
            Announcements
          </h2>
          {notices === null ? (
            <div className="mt-3 h-24 rounded-2xl bg-gray-50 border border-gray-100 animate-pulse" />
          ) : notices.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 text-center">
              <div className="text-3xl">📢</div>
              <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No announcements yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                TNR announcements, jobs, scholarships and events will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {notices.map(n => {
                // A notice with a link becomes one; without, it stays plain
                // text rather than pretending to lead somewhere.
                const Row = n.href ? 'a' : 'div';
                return (
                  <Row key={n.id} {...(n.href ? { href: n.href } : {})}
                    className={`block rounded-2xl bg-white border border-gray-100 shadow-sm px-5 py-4
                      ${n.href ? 'hover:border-[rgba(23,107,73,.3)] transition-colors' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0" aria-hidden="true">📢</span>
                      <p className="text-sm leading-relaxed" style={{ color: C.deep }}>{n.text}</p>
                      {n.href && (
                        <span className="ml-auto shrink-0 text-xs font-bold" style={{ color: C.green }}>→</span>
                      )}
                    </div>
                  </Row>
                );
              })}
            </div>
          )}

          {/* ── Open opportunities ──
              Above the CEC card: a scholarship or fellowship is relevant to
              every member, while a committee vacancy concerns the few
              considering it. Rendered only while something is genuinely open,
              so the dashboard never carries an empty promise. */}
          {opportunities.length > 0 && (
            <div className="mt-8 rounded-2xl border p-6"
              style={{ borderColor: 'rgba(23,107,73,.30)', background: 'rgba(23,107,73,.05)' }}>
              <div className="flex items-start gap-3">
                <div className="text-2xl" aria-hidden="true">💼</div>
                <div className="flex-1 min-w-0">
                  <h3 style={{ ...mont, color: C.deep }} className="font-extrabold">
                    {opportunities.length === 1
                      ? 'An opportunity is open to you'
                      : `${opportunities.length} opportunities are open to you`}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    Scholarships, fellowships and programmes open to TNR members.
                  </p>

                  <ul className="mt-3 space-y-2">
                    {opportunities.map(o => (
                      <li key={o.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white
                          border border-gray-100 px-3.5 py-2.5">
                        <span className="font-bold text-sm" style={{ color: C.deep }}>{o.title}</span>
                        <span className="text-[11px] text-gray-500">{o.category}</span>
                        {(o.deadline || o.closes_at) && (
                          <span className="text-[11px] text-gray-500">
                            Closes {new Date(o.closes_at || o.deadline).toLocaleDateString('en-GB',
                              { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {/* Already applied members get their status, not another
                            invitation to apply — the portal should not ask twice. */}
                        {o.application ? (
                          <span className="ml-auto text-xs font-bold" style={{ color: C.green }}>
                            {APP_STATUS_LABEL[o.application.status] || 'Submitted'}
                          </span>
                        ) : (
                          <a href="/member/opportunities"
                            className="ml-auto text-xs font-bold hover:underline" style={{ color: C.green }}>
                            {o.accepting ? 'Apply here →' : 'View details →'}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>

                  <a href="/member/opportunities"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                    style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                    Browse all opportunities →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Open Executive Committee positions ──
              Sits below announcements: general notices are what a member comes
              to the dashboard for, and a vacancy card is only relevant to the
              few considering it. Rendered at all only while something is
              genuinely open. */}
          {vacancies.length > 0 && (
            <div className="mt-8 rounded-2xl border p-6"
              style={{ borderColor: 'rgba(212,167,44,.45)', background: 'rgba(212,167,44,.07)' }}>
              <div className="flex items-start gap-3">
                <div className="text-2xl" aria-hidden="true">📋</div>
                <div className="flex-1 min-w-0">
                  <h3 style={{ ...mont, color: C.deep }} className="font-extrabold">
                    {vacancies.length === 1
                      ? 'An Executive Committee position is open'
                      : `${vacancies.length} Executive Committee positions are open`}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                    TNR is looking for members to serve on the Central Executive Committee.
                  </p>

                  <ul className="mt-3 space-y-2">
                    {vacancies.map(v => (
                      <li key={v.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white
                          border border-gray-100 px-3.5 py-2.5">
                        <span className="font-bold text-sm" style={{ color: C.deep }}>{v.title}</span>
                        {v.seats > 1 && (
                          <span className="text-[11px] text-gray-500">{v.seats} seats</span>
                        )}
                        {v.closes_on && (
                          <span className="text-[11px] text-gray-500">
                            Closes {new Date(v.closes_on).toLocaleDateString('en-GB',
                              { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        <a href="/cec/apply"
                          className="ml-auto text-xs font-bold hover:underline" style={{ color: C.green }}>
                          Apply here →
                        </a>
                      </li>
                    ))}
                  </ul>

                  <a href="/cec/apply"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                    style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>
                    Apply for a position →
                  </a>
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </MemberShell>
  );
}

// Completion now lives in lib/membership/profile.js, weighted across the whole
// profile — see profileCompletion(). The old version here counted only the
// registration fields, which are all mandatory, so everyone scored 100%.
