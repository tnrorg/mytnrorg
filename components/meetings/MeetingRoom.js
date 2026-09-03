'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  LiveKitRoom, RoomAudioRenderer, StartAudio, GridLayout, ParticipantTile,
  Chat, MediaDeviceMenu, useTracks, useLocalParticipant, useRoomContext,
  useConnectionState, useParticipants,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { mGet, mPost } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D7AE4A' };

/* The live meeting.
 *
 * MEDIA CONTROL IS EXPLICIT HERE, not delegated to a prebuilt toolbar.
 *
 * The buttons below call room.localParticipant.setMicrophoneEnabled() and
 * setCameraEnabled() directly, read their on/off state back from the
 * LocalParticipant rather than from React state, and surface whatever the
 * browser throws. A toggle that only flips its own colour looks identical to
 * one that works right up until nobody can hear you — which is exactly the
 * failure this room just had.
 *
 * Rendering is delegated, because that part is worth delegating: GridLayout
 * and ParticipantTile attach real MediaStreamTracks to real <video> elements
 * and fall back to a placeholder only when there is genuinely no track. No
 * avatar is drawn over a live camera.
 */
export default function MeetingRoom({ id, data }) {
  const [left, setLeft] = useState(false);

  /* Close the attendance session when the tab goes away.
   *
   * sendBeacon, because a normal fetch during unload is cancelled — and that
   * is the moment attendance depends on. People close the tab; they do not
   * press Leave. The server also closes stragglers when the host ends the
   * meeting, so this is the first of two nets. */
  useEffect(() => {
    const close = () => {
      try {
        const token = localStorage.getItem('tnr_member_token');
        navigator.sendBeacon('/api/member/meetings/room/beacon', new Blob(
          [JSON.stringify({ meeting_id: id, action: 'leave', reason: 'closed', token })],
          { type: 'application/json' }));
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
        // LiveKit's own tokens, repointed at the TNR palette — their layout
        // and accessibility work is kept, the colours are ours.
        '--lk-bg': C.deep, '--lk-bg2': '#0A4A35',
        '--lk-accent-bg': C.green, '--lk-accent2': C.gold,
        '--lk-danger': '#B91C1C', '--lk-border-color': 'rgba(255,255,255,.10)',
      }}>
      <LiveKitRoom
        token={data.token}
        serverUrl={data.url}
        connect
        /* Join with both devices OFF, then turn them on deliberately. Nobody
         * should be broadcast to a committee before they are ready. These are
         * applied once on connect; the buttons own the state afterwards. */
        video={false}
        audio={false}
        onDisconnected={() => leave('disconnected')}
        className="flex min-h-0 flex-1 flex-col">
        <RoomShell id={id} data={data} onLeave={() => leave('left')} />
      </LiveKitRoom>
    </div>
  );
}

/* ── Everything that needs the room context ──────────────────────────────── */
function RoomShell({ id, data, onLeave }) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const participants = useParticipants();
  const [panel, setPanel] = useState('');          // '' | 'chat' | 'people' | 'diag'
  const [mediaError, setMediaError] = useState(null);

  /* Camera and screen share, with a placeholder entry for anyone who has
   * neither. That placeholder is what renders the avatar — so the avatar
   * appears only when there is genuinely no video track, never on top of one. */
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <>
      <TopBar id={id} meeting={data.meeting} isHost={data.is_host}
        connection={connection} count={participants.length}
        panel={panel} setPanel={setPanel} onLeave={onLeave} />

      {mediaError && <MediaError err={mediaError} onDismiss={() => setMediaError(null)} />}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 p-2">
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            {/* ParticipantTile attaches the real track to a real <video>.
                Its own placeholder covers the no-camera case. */}
            <ParticipantTile />
          </GridLayout>
        </div>

        {panel === 'chat' && data.meeting?.chat_enabled && (
          <aside className="w-full max-w-sm border-l" style={{ borderColor: 'rgba(255,255,255,.10)' }}>
            <Chat />
          </aside>
        )}
        {panel === 'people' && (
          <PeoplePanel participants={participants} />
        )}
        {panel === 'diag' && <Diagnostics room={room} connection={connection} />}
      </div>

      <MediaBar meeting={data.meeting} onError={setMediaError} />

      {/* Mounted ONCE. Without it a member is connected and hears nobody. */}
      <RoomAudioRenderer />

      {/* Browsers block audio until the page has been interacted with. This is
          LiveKit's own handler: it resumes the audio context and disappears
          once playback is allowed. */}
      <StartAudio label="Click to enable sound"
        className="lk-button absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-xl px-4 py-2
          text-sm font-bold shadow-lg"
        style={{ background: C.gold, color: C.deep }} />
    </>
  );
}

/* ── The media controls ──────────────────────────────────────────────────── */
/* Each toggle calls the LiveKit LocalParticipant directly and reads its state
 * back from the participant, so the button cannot say "on" while the track is
 * off. Errors are raised to the banner rather than swallowed. */
function MediaBar({ meeting, onError }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const [busy, setBusy] = useState('');

  const run = async (what, fn) => {
    setBusy(what);
    try { await fn(); onError(null); }
    catch (e) { onError(describeMediaError(e, what)); }
    finally { setBusy(''); }
  };

  const canShare = meeting?.screen_share_enabled !== false;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t px-3 py-2.5"
      style={{ background: C.deep, borderColor: 'rgba(255,255,255,.10)' }}>

      <Toggle on={isMicrophoneEnabled} busy={busy === 'microphone'}
        onLabel="Mute" offLabel="Unmute" icon={isMicrophoneEnabled ? '🎤' : '🔇'}
        onClick={() => run('microphone',
          () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}
        menu={<MediaDeviceMenu kind="audioinput" />} />

      <Toggle on={isCameraEnabled} busy={busy === 'camera'}
        onLabel="Stop video" offLabel="Start video" icon={isCameraEnabled ? '📹' : '🚫'}
        onClick={() => run('camera',
          () => localParticipant.setCameraEnabled(!isCameraEnabled))}
        menu={<MediaDeviceMenu kind="videoinput" />} />

      {canShare && (
        <Toggle on={isScreenShareEnabled} busy={busy === 'screen'}
          onLabel="Stop sharing" offLabel="Share screen" icon="🖥️"
          onClick={() => run('screen',
            () => localParticipant.setScreenShareEnabled(!isScreenShareEnabled))} />
      )}

      {/* Speaker choice, where the browser supports setSinkId. */}
      <span className="hidden items-center gap-1 rounded-xl border px-2 py-1.5 text-[12px] text-white/70 sm:inline-flex"
        style={{ borderColor: 'rgba(255,255,255,.18)' }}>
        🔊 <MediaDeviceMenu kind="audiooutput" />
      </span>
    </div>
  );
}

function Toggle({ on, busy, onLabel, offLabel, icon, onClick, menu }) {
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-xl border"
      style={{ borderColor: on ? 'rgba(215,174,74,.55)' : 'rgba(255,255,255,.18)' }}>
      <button onClick={onClick} disabled={busy}
        aria-pressed={on}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-bold text-white
          transition-colors hover:bg-white/10 disabled:opacity-40"
        style={on ? { background: 'rgba(215,174,74,.16)' } : undefined}>
        <span aria-hidden="true">{icon}</span>
        {busy ? 'Working…' : (on ? onLabel : offLabel)}
      </button>
      {menu && (
        <span className="grid place-items-center border-l px-1 text-white/70"
          style={{ borderColor: 'rgba(255,255,255,.18)' }}>{menu}</span>
      )}
    </span>
  );
}

/* ── Errors a member can act on ──────────────────────────────────────────── */
/* Section 8 of the brief. "Could not start camera" sends someone to the help
 * desk; "another application is using it" makes them close Zoom. The DOM
 * exception names are the browser's, and they map cleanly onto real causes. */
export function describeMediaError(e, what = 'device') {
  const name = e?.name || e?.constructor?.name || '';
  const thing = what === 'microphone' ? 'microphone' : what === 'camera' ? 'camera' : 'screen';

  if (name === 'NotAllowedError' || /permission/i.test(e?.message || '')) return {
    title: `${cap(thing)} permission denied`,
    body: `Your browser blocked access to the ${thing}. Click the padlock in the address bar, `
      + `set ${cap(thing)} to Allow, then reload this page.`,
  };
  if (name === 'NotFoundError') return {
    title: `No ${thing} found`,
    body: `This device does not appear to have a ${thing} connected. `
      + `You can still take part with audio only, or by listening.`,
  };
  if (name === 'NotReadableError' || name === 'TrackStartError') return {
    title: `${cap(thing)} is in use`,
    body: `Another application is using your ${thing}. Close Zoom, Teams, WhatsApp Desktop `
      + `or any other tab using it, then try again.`,
  };
  if (name === 'OverconstrainedError') return {
    title: `That ${thing} is not available`,
    body: `The ${thing} you selected cannot be used. Pick a different one from the arrow `
      + `next to the button.`,
  };
  if (name === 'AbortError') return {
    title: `${cap(thing)} could not start`,
    body: 'The device was interrupted while starting. Try again.',
  };
  return {
    title: `Could not start your ${thing}`,
    body: e?.message ? String(e.message).slice(0, 160) : 'An unexpected error occurred.',
  };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function MediaError({ err, onDismiss }) {
  return (
    <div className="flex items-start gap-3 border-b px-4 py-3"
      style={{ background: 'rgba(185,28,28,.15)', borderColor: 'rgba(255,255,255,.10)' }}>
      <span aria-hidden="true">⚠️</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-red-200">{err.title}</div>
        <div className="text-[12.5px] leading-relaxed text-white/70">{err.body}</div>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss"
        className="text-white/50 hover:text-white">✕</button>
    </div>
  );
}

/* ── Diagnostics ─────────────────────────────────────────────────────────── */
/* Exactly the checklist in section 10, read live from the SDK and the browser.
 * NOTHING SENSITIVE: no token, no API key, no member contact details — device
 * labels and track states only. Behind a button, so it is available when
 * something is wrong without cluttering a working meeting. */
function Diagnostics({ room, connection }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [perm, setPerm] = useState({ camera: 'checking', microphone: 'checking' });
  const [devices, setDevices] = useState({ audioinput: 0, videoinput: 0, audiooutput: 0 });

  useEffect(() => {
    let off = false;
    (async () => {
      const read = async (name) => {
        try { return (await navigator.permissions.query({ name })).state; }
        catch { return 'unknown'; }   // Firefox and Safari do not expose these
      };
      const [camera, microphone] = await Promise.all([read('camera'), read('microphone')]);
      if (!off) setPerm({ camera, microphone });

      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (off) return;
        setDevices({
          audioinput: list.filter(d => d.kind === 'audioinput').length,
          videoinput: list.filter(d => d.kind === 'videoinput').length,
          audiooutput: list.filter(d => d.kind === 'audiooutput').length,
        });
      } catch { /* enumerateDevices needs a secure context */ }
    })();
    return () => { off = true; };
  }, []);

  const pubs = [...(localParticipant?.trackPublications?.values?.() || [])];
  const mic = pubs.find(p => p.source === Track.Source.Microphone);
  const cam = pubs.find(p => p.source === Track.Source.Camera);

  const rows = [
    ['Secure context (HTTPS)', window.isSecureContext],
    ['getUserMedia available', !!navigator.mediaDevices?.getUserMedia],
    ['LiveKit connected', connection === ConnectionState.Connected],
    ['Camera permission', perm.camera],
    ['Microphone permission', perm.microphone],
    ['Microphone track published', !!mic],
    ['Microphone muted', mic ? !!mic.isMuted : '—'],
    ['Camera track published', !!cam],
    ['Camera muted', cam ? !!cam.isMuted : '—'],
    ['Mic enabled (SDK)', !!isMicrophoneEnabled],
    ['Camera enabled (SDK)', !!isCameraEnabled],
    ['Microphones found', devices.audioinput],
    ['Cameras found', devices.videoinput],
    ['Speakers found', devices.audiooutput],
    ['Audio playback allowed', room ? !!room.canPlaybackAudio : '—'],
  ];

  return (
    <aside className="w-full max-w-sm overflow-y-auto border-l p-4"
      style={{ borderColor: 'rgba(255,255,255,.10)', background: '#0A4A35' }}>
      <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-white/50">
        Connection diagnostics
      </h3>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-1 text-[12px]"
            style={{ borderColor: 'rgba(255,255,255,.07)' }}>
            <dt className="text-white/60">{k}</dt>
            <dd className={`font-bold ${tone(v)}`}>{show(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        Device and track state only. No tokens, keys or member details are shown here.
      </p>
    </aside>
  );
}
const show = (v) => v === true ? 'yes' : v === false ? 'no' : String(v);
const tone = (v) => v === true || v === 'granted' ? 'text-green-300'
  : v === false || v === 'denied' ? 'text-red-300' : 'text-white/70';

/* ── People ──────────────────────────────────────────────────────────────── */
function PeoplePanel({ participants }) {
  return (
    <aside className="w-full max-w-sm overflow-y-auto border-l p-4"
      style={{ borderColor: 'rgba(255,255,255,.10)', background: '#0A4A35' }}>
      <h3 className="mb-3 text-[12px] font-black uppercase tracking-wider text-white/50">
        In the room ({participants.length})
      </h3>
      <ul className="space-y-1.5">
        {participants.map(p => {
          // Set by the SERVER when the token was minted — see lib/livekit.js.
          let meta = {};
          try { meta = JSON.parse(p.metadata || '{}'); } catch { /* not ours */ }
          return (
            <li key={p.identity} className="flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-white">
                  {p.name || 'Member'}
                </span>
                <span className="block font-mono text-[10.5px] text-white/40">
                  {meta.membership_id || ''}{meta.role && meta.role !== 'participant' ? ` · ${meta.role}` : ''}
                </span>
              </span>
              <span className="text-[13px]" title={p.isMicrophoneEnabled ? 'Unmuted' : 'Muted'}>
                {p.isMicrophoneEnabled ? '🎤' : '🔇'}
              </span>
              <span className="text-[13px]" title={p.isCameraEnabled ? 'Camera on' : 'Camera off'}>
                {p.isCameraEnabled ? '📹' : '⬛'}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/* ── The TNR bar ─────────────────────────────────────────────────────────── */
function TopBar({ id, meeting, isHost, connection, count, panel, setPanel, onLeave }) {
  const [waiting, setWaiting] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lobby, setLobby] = useState(false);

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

  const tab = (key, label) => (
    <button onClick={() => setPanel(panel === key ? '' : key)}
      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold text-white transition-colors
        hover:bg-white/10 ${panel === key ? 'bg-white/15' : ''}`}
      style={{ borderColor: 'rgba(255,255,255,.20)' }}>
      {label}
    </button>
  );

  return (
    <>
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5"
        style={{ background: C.deep, borderColor: 'rgba(255,255,255,.10)' }}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-bold text-white">{meeting?.title}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/45">
            <span className={`h-1.5 w-1.5 rounded-full ${connection === ConnectionState.Connected
              ? 'bg-green-400' : connection === ConnectionState.Reconnecting
                ? 'animate-pulse bg-amber-400' : 'bg-red-400'}`} />
            {connection === ConnectionState.Connected ? 'TNR Virtual Hall'
              : connection === ConnectionState.Reconnecting ? 'Reconnecting…' : String(connection)}
          </div>
        </div>

        {meeting?.recording_enabled && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1
            text-[11px] font-bold text-red-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording enabled
          </span>
        )}

        {tab('people', `People ${count}`)}
        {meeting?.chat_enabled && tab('chat', 'Chat')}
        {tab('diag', 'Diagnostics')}

        {isHost && meeting?.waiting_room_enabled && (
          <button onClick={() => setLobby(!lobby)}
            className="relative rounded-lg border px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-white/10"
            style={{ borderColor: 'rgba(255,255,255,.20)' }}>
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
            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[12px] font-bold text-white
              hover:bg-red-700 disabled:opacity-40">
            End for all
          </button>
        )}
        <button onClick={onLeave}
          className="rounded-lg border px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-white/10"
          style={{ borderColor: 'rgba(255,255,255,.20)' }}>
          Leave
        </button>
      </header>

      {lobby && isHost && (
        <div className="border-b px-4 py-3" style={{ background: '#0A4A35', borderColor: 'rgba(255,255,255,.10)' }}>
          {!waiting.length ? (
            <p className="text-[12.5px] text-white/50">Nobody is waiting.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold text-white/70">{waiting.length} waiting to join</span>
                <button onClick={() => decide('admit', waiting.map(p => p.member_id))} disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-black disabled:opacity-40"
                  style={{ background: C.gold, color: C.deep }}>Admit all</button>
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
