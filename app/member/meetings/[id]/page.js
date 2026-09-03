'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
import Avatar from '@/components/ui/Avatar';
import {
  STATUS_TONE, STATUS_LABEL, typeLabel, typeIcon, fmtDateTime, relativeTime,
} from '@/lib/meetings';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* One meeting, and the way in.
 *
 * The Join button's enabled state comes from the SERVER, which computed it
 * with lib/meetings.js joinability(). The same function guards the token
 * endpoint in Phase 3, so the button and the door agree by construction
 * rather than by two developers remembering the same rule.
 *
 * When it is disabled it says WHY. "Join" greyed out with no explanation is
 * the single most common complaint about meeting software.
 */
export default function MeetingDetail(props) {
  const params = use(props.params);
  const [d, setD] = useState(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    mGet(`/api/member/meetings?id=${params.id}`)
      .then(r => { if (r?.ok) setD(r); else setMissing(true); });
  }, [params.id]);

  useEffect(() => { load(); }, [load]);
  // The window between "not yet" and "join now" is where this page is read.
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  async function reply(kind) {
    setBusy(kind);
    const r = await mPost('/api/member/meetings', { meeting_id: params.id, reply: kind });
    setBusy('');
    if (r?.ok) load();
  }

  if (missing) return (
    <MemberShell active="/member/meetings">
      <div className="py-16 text-center" style={mont}>
        <h1 className="text-xl font-black" style={{ color: C.deep }}>Meeting not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          This meeting does not exist, or you are not on its invitation list.
        </p>
        <Link href="/member/meetings"
          className="mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: C.green }}>
          Back to My Meetings
        </Link>
      </div>
    </MemberShell>
  );

  if (!d) return (
    <MemberShell active="/member/meetings">
      <p className="py-16 text-center text-sm text-gray-400">Loading…</p>
    </MemberShell>
  );

  const m = d.meeting;
  const tone = STATUS_TONE[m.state] || STATUS_TONE.scheduled;
  const canJoin = d.join?.can;
  const isHost = d.my_role === 'host' || d.my_role === 'co_host';

  return (
    <MemberShell active="/member/meetings">
      <div style={mont} className="space-y-5">
        <Link href="/member/meetings" className="text-sm text-gray-500 hover:underline">
          ← My Meetings
        </Link>

        {/* ── Header ── */}
        <div className="rounded-2xl p-5 sm:p-6 text-white"
          style={{ background: `linear-gradient(140deg, ${C.green}, ${C.deep})` }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">{typeIcon(m.meeting_type)}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
              {typeLabel(m.meeting_type)}
            </span>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ background: tone.bg, color: tone.fg }}>
              {STATUS_LABEL[m.state]}
            </span>
          </div>
          <h1 className="mt-2.5 text-2xl font-black leading-tight">{m.title}</h1>
          <p className="mt-2 text-white/80 text-sm">
            {fmtDateTime(m.scheduled_at)}
            {m.state === 'scheduled' && ` · ${relativeTime(m.scheduled_at)}`}
            {' · '}{m.duration_minutes} min
          </p>
        </div>

        {/* ── Join ── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <button
            disabled={!canJoin}
            onClick={() => { window.location.href = `/member/meetings/${m.id}/room`; }}
            className="w-full rounded-xl px-5 py-3.5 text-base font-black text-white transition
              disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: canJoin ? C.green : '#9CA3AF' }}>
            {d.join?.starting ? 'Start meeting' : 'Join meeting'}
          </button>

          {/* Why not, in plain words. */}
          {!canJoin && d.join?.reason && (
            <p className="mt-2.5 text-center text-[13px] text-gray-500">{d.join.reason}</p>
          )}

          {canJoin && m.waiting_room_enabled && !isHost && (
            <p className="mt-2.5 text-center text-[12.5px] text-gray-500">
              This meeting has a waiting room — the host will admit you.
            </p>
          )}

          {/* RSVP, only while it still means something. */}
          {m.state === 'scheduled' && !isHost && (
            <div className="mt-4 flex items-center justify-center gap-2 border-t border-gray-100 pt-4">
              {d.my_participation?.invite_status === 'accepted' ? (
                <p className="text-[13px] font-semibold" style={{ color: C.green }}>
                  ✓ You said you are attending
                </p>
              ) : d.my_participation?.invite_status === 'declined' ? (
                <p className="text-[13px] text-gray-500">
                  You said you cannot attend.{' '}
                  <button onClick={() => reply('accepted')} className="font-semibold underline"
                    style={{ color: C.green }}>Change</button>
                </p>
              ) : (
                <>
                  <span className="text-[13px] text-gray-500">Are you attending?</span>
                  <button onClick={() => reply('accepted')} disabled={!!busy}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-40"
                    style={{ background: C.green }}>Yes</button>
                  <button onClick={() => reply('declined')} disabled={!!busy}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold
                      text-gray-600 disabled:opacity-40">No</button>
                </>
              )}
            </div>
          )}
        </div>

        {m.state === 'cancelled' && m.cancelled_reason && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
            <strong>Cancelled.</strong> {m.cancelled_reason}
          </div>
        )}

        {/* ── Details ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title="Details">
            <Row k="Date & time" v={fmtDateTime(m.scheduled_at)} />
            <Row k="Duration" v={`${m.duration_minutes} minutes`} />
            <Row k="Type" v={typeLabel(m.meeting_type)} />
            <Row k="Invited" v={`${d.participant_count} member(s)`} />
            <Row k="Waiting room" v={m.waiting_room_enabled ? 'On' : 'Off'} />
            <Row k="Recording" v={m.recording_enabled ? 'Enabled' : 'Off'} />
            <Row k="Chat" v={m.chat_enabled ? 'On' : 'Off'} />
            <Row k="Screen sharing" v={m.screen_share_enabled ? 'Allowed' : 'Host only'} />
          </Panel>

          <Panel title="Hosted by">
            {d.host && <Person m={d.host} label="Host" />}
            {(d.coHosts || []).map(c => <Person key={c.id} m={c} label="Co-host" />)}
          </Panel>
        </div>

        {m.agenda && (
          <Panel title="Agenda">
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700">{m.agenda}</p>
          </Panel>
        )}
        {m.description && (
          <Panel title="About this meeting">
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700">{m.description}</p>
          </Panel>
        )}

        {/* The full roster is host-only — see the member API. An invitation
            list is itself information about other members. */}
        {d.participants && (
          <Panel title={`Participants (${d.participants.length})`}>
            <div className="space-y-2">
              {d.participants.map(p => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <Avatar src={p.member?.photo_url} name={p.member?.full_name} className="w-7 h-7 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-gray-800">
                      {p.member?.full_name || '—'}
                    </div>
                    <div className="font-mono text-[11px] text-gray-400">
                      {p.member?.membership_id || ''}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400">{p.invite_status}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </MemberShell>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">{title}</h2>
      {children}
    </section>
  );
}
const Row = ({ k, v }) => (
  <div className="flex justify-between gap-3 border-b border-gray-50 py-1.5 text-[13px] last:border-0">
    <span className="text-gray-500">{k}</span>
    <span className="text-right font-semibold text-gray-800">{v}</span>
  </div>
);
const Person = ({ m, label }) => (
  <div className="flex items-center gap-2.5 py-1.5">
    <Avatar src={m.photo_url} name={m.full_name} className="w-8 h-8 shrink-0" />
    <div className="min-w-0">
      <div className="truncate text-[13.5px] font-semibold text-gray-800">{m.full_name}</div>
      <div className="text-[11px] text-gray-400">{label} · {m.membership_id}</div>
    </div>
  </div>
);
