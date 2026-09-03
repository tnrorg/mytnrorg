'use client';
import { useCallback, useEffect, useState } from 'react';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import { mGet, mPost } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D7AE4A' };

/* The live meeting.
 *
 * WHY THE PREBUILT <VideoConference>: it already carries grid and speaker
 * views, the device toolbar, screen sharing, chat, the participant list and
 * active-speaker indication — all of it tested against real browsers and real
 * network failures. Hand-rolling that would mean shipping a great deal of
 * WebRTC UI I cannot test from here, and the brief is explicit that raw
 * conferencing should not be rebuilt from scratch.
 *
 * What is NOT delegated is anything that touches TNR's own rules: who may
 * enter, who may share, when attendance starts and stops, and ending the
 * meeting. Those sit in the bar above and in the server routes behind it.
 *
 * The theme is overridden to TNR green — the brief asks specifically that this
 * not look like somebody else's product embedded in the portal.
 */
export default function MeetingRoom({ id, data }) {
  const [left, setLeft] = useState(false);

  /* Close the attendance session when the tab goes away.
   *
   * sendBeacon, because a normal fetch during unload is cancelled by the
   * browser — and this is the exact moment attendance depends on. People do
   * not press Leave; they close the tab. Without this, every such session
   * stays open with a null duration and the member reads as absent despite
   * having been there the whole time.
   *
   * The server also closes stragglers when the host ends the meeting, so this
   * is the first of two nets, not the only one. */
  useEffect(() => {
    const close = () => {
      try {
        const token = localStorage.getItem('tnr_member_token');
        const blob = new Blob(
          [JSON.stringify({ meeting_id: id, action: 'leave', reason: 'closed', token })],
          { type: 'application/json' });
        navigator.sendBeacon('/api/member/meetings/room/beacon', blob);
      } catch { /* nothing useful to do while the page is dying */ }
    };
    window.addEventListener('pagehide', close);
    return () => window.removeEventListener('pagehide', close);
  }, [id]);

  const leave = useCallback(async (reason = 'left') => {
    setLeft(true);
    await mPost('/api/member/meetings/room', { meeting_id: id, action: 'leave', reason });
    window.location.href = `/member/meetings/${id}`;
  }, [id]);

  if (left) return (
    <main className="grid min-h-screen place-items-center text-white"
      style={{ background: `linear-gradient(150deg, ${C.green}, ${C.deep})` }}>
      <p className="text-sm">Leaving the meeting…</p>
    </main>
  );

  return (
    <div className="flex h-[100dvh] flex-col" data-lk-theme="default"
      style={{
        background: C.deep,
        // LiveKit's own tokens, repointed at the TNR palette. Restyling the
        // components' CSS variables keeps their behaviour and accessibility
        // work intact while making the room ours.
        '--lk-bg': C.deep,
        '--lk-bg2': '#0A4A35',
        '--lk-accent-bg': C.green,
        '--lk-accent2': C.gold,
        '--lk-danger': '#B91C1C',
        '--lk-border-color': 'rgba(255,255,255,.10)',
      }}>
      <LiveKitRoom
        token={data.token}
        serverUrl={data.url}
        connect
        video={false}          // join muted and dark, then turn things on —
        audio={false}          // nobody should be broadcast before they are ready
        onDisconnected={() => leave('disconnected')}
        className="flex min-h-0 flex-1 flex-col">

        <TopBar meeting={data.meeting} isHost={data.is_host} id={id} onLeave={() => leave('left')} />

        <div className="min-h-0 flex-1">
          {/* chatMessageFormatter omitted deliberately — the default escapes
              message text rather than rendering it as markup. */}
          <VideoConference chatMessageFormatter={undefined} />
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

/* The TNR bar above the provider's own UI: identity, the recording indicator,
 * the waiting room, and the two controls that mean something to the
 * organisation rather than to the call. */
function TopBar({ meeting, isHost, id, onLeave }) {
  const [waiting, setWaiting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Only a host polls the lobby — a participant has nothing to see there.
  useEffect(() => {
    if (!isHost || !meeting?.waiting_room_enabled) return;
    const tick = () => mGet(`/api/member/meetings/room?meeting_id=${id}`)
      .then(r => { if (r?.ok) setWaiting(r.waiting || []); });
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [isHost, id, meeting?.waiting_room_enabled]);

  const decide = async (action, memberIds) => {
    setBusy(true);
    await mPost('/api/member/meetings/room', { meeting_id: id, action, member_ids: memberIds });
    setWaiting(w => w.filter(p => !memberIds.includes(p.member_id)));
    setBusy(false);
  };

  const end = async () => {
    if (!confirm('End this meeting for everyone?\n\nAttendance will be finalised and cannot be reopened.')) return;
    setBusy(true);
    await mPost('/api/member/meetings/room', { meeting_id: id, action: 'end' });
    window.location.href = `/member/meetings/${id}`;
  };

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5"
        style={{ background: C.deep, borderColor: 'rgba(255,255,255,.10)' }}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-white">{meeting?.title}</div>
          <div className="text-[11px] text-white/45">TNR Virtual Hall</div>
        </div>

        {/* Visible to EVERYONE whenever recording is on — section 32. */}
        {meeting?.recording_enabled && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1
            text-[11px] font-bold text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording enabled
          </span>
        )}

        {isHost && meeting?.waiting_room_enabled && (
          <button onClick={() => setOpen(!open)}
            className="relative rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-bold text-white
              hover:bg-white/10">
            Waiting room
            {waiting.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full
                px-1 text-[10px] font-black" style={{ background: C.gold, color: C.deep }}>
                {waiting.length}
              </span>
            )}
          </button>
        )}

        {isHost && (
          <button onClick={end} disabled={busy}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white
              hover:bg-red-700 disabled:opacity-40">
            End for all
          </button>
        )}
        <button onClick={onLeave}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-white/10">
          Leave
        </button>
      </header>

      {/* ── Waiting room drawer ── */}
      {open && isHost && (
        <div className="border-b px-4 py-3" style={{ background: '#0A4A35', borderColor: 'rgba(255,255,255,.10)' }}>
          {!waiting.length ? (
            <p className="text-[12.5px] text-white/50">Nobody is waiting.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold text-white/70">
                  {waiting.length} waiting to join
                </span>
                <button onClick={() => decide('admit', waiting.map(p => p.member_id))} disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-black disabled:opacity-40"
                  style={{ background: C.gold, color: C.deep }}>
                  Admit all
                </button>
              </div>
              <ul className="space-y-1.5">
                {waiting.map(p => (
                  <li key={p.id} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-1.5">
                    {p.member?.photo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.member.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      : <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                        {(p.member?.full_name || '?').charAt(0).toUpperCase()}
                      </span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-white">
                        {p.member?.full_name || 'Member'}
                      </span>
                      <span className="block font-mono text-[10.5px] text-white/40">
                        {p.member?.membership_id}
                      </span>
                    </span>
                    <button onClick={() => decide('admit', [p.member_id])} disabled={busy}
                      className="rounded-md px-2.5 py-1 text-[11.5px] font-bold disabled:opacity-40"
                      style={{ background: C.gold, color: C.deep }}>Admit</button>
                    <button onClick={() => decide('reject', [p.member_id])} disabled={busy}
                      className="rounded-md border border-white/25 px-2.5 py-1 text-[11.5px] font-bold text-white/80
                        disabled:opacity-40">Reject</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
