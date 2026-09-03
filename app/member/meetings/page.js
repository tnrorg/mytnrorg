'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import MemberShell from '@/components/member/MemberShell';
import { mGet } from '@/components/member/memberApi';
import Avatar from '@/components/ui/Avatar';
import {
  MEMBER_TABS, STATUS_TONE, STATUS_LABEL, typeLabel, typeIcon,
  fmtDateTime, relativeTime,
} from '@/lib/meetings';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* My Meetings.
 *
 * Live first, always. A member opening this page while a meeting is running
 * needs one thing, and it should not be below a list of next month's
 * schedule — so the live band sits above the tabs and is impossible to miss.
 */
export default function MyMeetings() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('upcoming');

  const load = useCallback(() => {
    mGet('/api/member/meetings').then(r => setD(r?.ok ? r : { meetings: [], counts: {} }));
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Re-read every minute.
   *
   * "Upcoming" becomes "Live" purely because time passed — nothing the member
   * does triggers it. Without this, someone who opened the page at 7:55 would
   * still be looking at a disabled Join button at 8:05 and would reasonably
   * conclude the meeting never started. */
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const all = d?.meetings || [];
  const live = all.filter(m => m.tab === 'live');
  const rows = all.filter(m => m.tab === tab);
  const counts = d?.counts || {};

  return (
    <MemberShell active="/member/meetings">
      <div style={mont}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: C.deep }}>My Meetings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Meetings you have been invited to host or attend.
            </p>
          </div>
        </header>

        {/* ── Live now ── */}
        {live.length > 0 && (
          <div className="mt-6 space-y-3">
            {live.map(m => (
              <Link key={m.id} href={`/member/meetings/${m.id}`}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3
                  transition hover:border-red-300">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-red-900 truncate">{m.title}</div>
                  <div className="text-[12px] text-red-700">
                    {typeLabel(m.meeting_type)} · started {relativeTime(m.started_at || m.scheduled_at)}
                  </div>
                </div>
                <span className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
                  Join now
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="mt-6 flex flex-wrap gap-2">
          {MEMBER_TABS.map(t => {
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${on
                  ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                style={on ? { background: C.green } : undefined}>
                {t.label}
                <span className={`ml-1.5 text-[11px] ${on ? 'text-white/70' : 'text-gray-400'}`}>
                  {counts[t.key] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── List ── */}
        <div className="mt-5 space-y-3">
          {!d && <p className="py-10 text-center text-sm text-gray-400">Loading…</p>}
          {d && !rows.length && (
            <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
              <div className="text-3xl">🗓️</div>
              <p className="mt-2 text-sm text-gray-500">{EMPTY[tab]}</p>
            </div>
          )}
          {rows.map(m => <MeetingCard key={m.id} m={m} />)}
        </div>
      </div>
    </MemberShell>
  );
}

/* Each empty state says what that tab MEANS, rather than repeating "nothing
 * here". "No missed meetings" reads as good news; "Nothing to show" reads as
 * something being broken. */
const EMPTY = {
  upcoming: 'No meetings scheduled for you yet.',
  live: 'Nothing is running right now.',
  completed: 'You have not attended a meeting yet.',
  missed: 'You have not missed any meetings. ',
  cancelled: 'No cancelled meetings.',
};

function MeetingCard({ m }) {
  const tone = STATUS_TONE[m.state] || STATUS_TONE.scheduled;
  const soon = m.tab === 'upcoming';

  return (
    <Link href={`/member/meetings/${m.id}`}
      className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition
        hover:-translate-y-[2px] hover:border-[rgba(11,107,79,.28)] hover:shadow-md">
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
          style={{ background: 'rgba(11,107,79,.08)' }}>
          {typeIcon(m.meeting_type)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black leading-snug" style={{ color: C.deep }}>{m.title}</h3>
            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
              style={{ background: tone.bg, color: tone.fg }}>
              {STATUS_LABEL[m.state]}
            </span>
            {m.my_role === 'host' && <Chip>You are hosting</Chip>}
            {m.my_role === 'co_host' && <Chip>Co-host</Chip>}
          </div>

          <p className="mt-1 text-[13px] text-gray-500">
            {typeLabel(m.meeting_type)} · {fmtDateTime(m.scheduled_at)}
            {soon && <span className="ml-1.5 font-semibold" style={{ color: C.green }}>
              ({relativeTime(m.scheduled_at)})
            </span>}
          </p>

          {m.host && (
            <div className="mt-2 flex items-center gap-2">
              <Avatar src={m.host.photo_url} name={m.host.full_name} className="w-6 h-6 shrink-0" />
              <span className="text-[12px] text-gray-500">
                Hosted by <span className="font-semibold text-gray-700">{m.host.full_name}</span>
              </span>
            </div>
          )}

          {m.state === 'cancelled' && m.cancelled_reason && (
            <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[12px] text-gray-500">
              {m.cancelled_reason}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

const Chip = ({ children }) => (
  <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
    style={{ background: 'rgba(202,138,4,.14)', color: '#A16207' }}>{children}</span>
);
