'use client';
import { useEffect, useState } from 'react';
import { Video, ShieldCheck, ClipboardList, Users, LogIn, ArrowRight } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { COLORS, FONT } from '@/lib/design/tokens';
import { MEETING_TYPES } from '@/lib/meetings';

/* TNR Virtual Hall — the PUBLIC face of the meetings module.
 *
 * IT PROMOTES; IT DOES NOT DISCLOSE.
 *
 * There is no meeting list on this page, and there is no public API behind it
 * — not a filtered one, not a titles-only one. A visitor must not be able to
 * learn that the Advisory Council is meeting on Friday, who was invited, or
 * what is on the agenda. That is internal governance activity, and publishing
 * even the titles would tell anyone watching when the leadership is meeting
 * and what they are deliberating about.
 *
 * So this page describes the FACILITY and sends members to the portal, where
 * the server checks who they are. It is the same rule the Opportunities board
 * follows, one step stricter: there, the teaser is public and the detail is
 * gated; here, nothing about an individual meeting is public at all.
 */
export default function VirtualHall() {
  const [signedIn, setSignedIn] = useState(null);   // null = still checking

  /* Ask the SERVER whether this session is real, rather than trusting the
   * presence of a token in localStorage. An expired session would otherwise
   * send someone to the portal only to be bounced straight back to a login
   * screen — the exact frustration this check exists to avoid. */
  useEffect(() => {
    let off = false;
    let token = null;
    try { token = localStorage.getItem('tnr_member_token'); } catch { /* storage blocked */ }
    if (!token) { setSignedIn(false); return; }

    fetch('/api/member/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setSignedIn(!!(j?.ok && j.member)); })
      .catch(() => { if (!off) setSignedIn(false); });
    return () => { off = true; };
  }, []);

  const cta = signedIn
    ? { href: '/member/meetings', label: 'Go to My Meetings' }
    : { href: '/member/login', label: 'Member sign in' };

  return (
    <main style={{ ...FONT, color: '#15231D', background: '#FDFDFD' }}
      className="light-page tnr-ambient flex min-h-screen flex-col">
      <SiteNav />

      {/* ── Hero ── */}
      <section className="w-full">
        <div className="max-w-tnr-wide mx-auto px-4 pt-10 pb-14">
          <div className="relative overflow-hidden rounded-3xl px-6 py-14 sm:px-12 sm:py-16"
            style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
            <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
              style={{
                backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
                backgroundSize: '26px 26px',
              }} />

            <div className="relative max-w-2xl">
              <div className="text-[11px] font-bold uppercase tracking-[.28em]"
                style={{ color: COLORS.gold400 }}>
                Meet online, inside TNR
              </div>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                TNR Virtual Hall
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
                The online meeting hall of Tehreek-e-Nojawanan Roundu. Committee
                sessions, trainings, workshops and interviews are held here — inside
                the member portal, using the TNR account you already have.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href={cta.href}
                  className="group inline-flex items-center gap-2 rounded-tnr px-6 py-3 text-sm font-black
                    transition-transform duration-standard hover:-translate-y-0.5"
                  style={{ background: COLORS.gold400, color: COLORS.green950 }}>
                  {signedIn === null ? 'Loading…' : cta.label}
                  <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true"
                    className="transition-transform duration-micro group-hover:translate-x-0.5" />
                </a>
                {signedIn === false && (
                  <a href="/membership/apply"
                    className="inline-flex items-center gap-2 rounded-tnr border border-white/25 px-6 py-3
                      text-sm font-bold text-white transition-colors hover:bg-white/10">
                    Become a member
                  </a>
                )}
              </div>

              <p className="mt-4 text-[12.5px] text-white/55">
                Meetings are private to the members invited to them. Nothing about an
                individual meeting is shown on this page.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why it exists ── */}
      <section className="max-w-tnr-wide mx-auto w-full px-4 pb-14">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            [Video, 'No second account',
              'Your TNR membership is your meeting identity. No Zoom sign-up, no separate password, no meeting IDs to copy around.'],
            [ShieldCheck, 'Invitation only',
              'A meeting is visible only to the members invited to it. Links cannot be forwarded to people who were not.'],
            [ClipboardList, 'The record keeps itself',
              'Attendance, minutes, decisions and action items stay attached to the meeting, in the portal, after everyone leaves.'],
          ].map(([Icon, title, body]) => (
            <div key={title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-tnr-flat">
              <div className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: 'rgba(23,107,73,.09)', color: COLORS.green700 }}>
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-black text-[16px]" style={{ color: COLORS.green900 }}>{title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What gets held here ── */}
      <section className="max-w-tnr-wide mx-auto w-full px-4 pb-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.28em]"
              style={{ color: COLORS.goldInk }}>What happens here</div>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl" style={{ color: COLORS.green900 }}>
              Every kind of TNR session
            </h2>
          </div>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MEETING_TYPES.map(t => (
            <li key={t.key}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5
                shadow-tnr-flat transition-all duration-standard
                hover:-translate-y-[2px] hover:border-[rgba(23,107,73,.22)] hover:shadow-tnr-raise">
              <span className="text-xl" aria-hidden="true">{t.icon}</span>
              <span className="text-[13.5px] font-bold" style={{ color: COLORS.green900 }}>
                {t.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-tnr-wide mx-auto w-full px-4 pb-16">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-tnr-flat sm:p-10">
          <div className="text-[11px] font-bold uppercase tracking-[.28em]"
            style={{ color: COLORS.goldInk }}>For members</div>
          <h2 className="mt-2 text-2xl font-black" style={{ color: COLORS.green900 }}>
            How a meeting reaches you
          </h2>

          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['You are invited',
                'A notification appears in your portal the moment the meeting is scheduled.'],
              ['It shows in My Meetings',
                'Under Upcoming, with the agenda, the host and the exact time in your own timezone.'],
              ['Join from the portal',
                'One button. If the host has a waiting room on, they admit you.'],
              ['The record stays',
                'Your attendance is recorded automatically, and the minutes appear afterwards.'],
            ].map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-black text-white"
                  style={{ background: COLORS.green700 }}>{i + 1}</span>
                <h3 className="mt-3 font-black text-[15px]" style={{ color: COLORS.green900 }}>{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-7">
            <a href={cta.href}
              className="inline-flex items-center gap-2 rounded-tnr px-6 py-3 text-sm font-black text-white
                transition-transform duration-standard hover:-translate-y-0.5"
              style={{ background: COLORS.green700 }}>
              {signedIn ? <Users size={15} aria-hidden="true" /> : <LogIn size={15} aria-hidden="true" />}
              {signedIn === null ? 'Loading…' : cta.label}
            </a>
            <span className="text-[13px] text-gray-500">
              {signedIn
                ? 'Your invitations are waiting in the portal.'
                : 'Sign in with your TNR membership to see the meetings you are invited to.'}
            </span>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
