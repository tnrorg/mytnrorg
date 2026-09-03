'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  LiveKitRoom, RoomAudioRenderer, StartAudio, GridLayout,
  MediaDeviceMenu, useTracks, useLocalParticipant, useRoomContext,
  useConnectionState, useParticipants, useDataChannel,
} from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import TnrTile, { readMeta } from './TnrTile';
import TnrChat from './TnrChat';
import { Track, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { mGet, mPost } from '@/components/member/memberApi';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D7AE4A', goldInk: '#7A5D10' };

/* Light chrome, dark stage.
 *
 * The header, the toolbar and the side panels are white; only the area the
 * faces live in stays deep green. That is the arrangement every serious
 * meeting product converges on, and for a reason: video looks its best
 * against a dark field, while controls and text are read faster on white.
 * A single wash of green everywhere made the tiles and the buttons compete.
 */
const SURFACE = {
  bg: '#FFFFFF',
  line: '#E7EAE8',
  ink: '#15231D',
  soft: '#6B7280',
  hover: 'rgba(11,107,79,.07)',
};

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
        background: SURFACE.bg,
        /* LiveKit's own tokens. The only LiveKit-rendered chrome left is the
           device menus and the Start Audio button, and both now sit on white
           chrome — so these are light. */
        '--lk-bg': SURFACE.bg, '--lk-bg2': '#F4F6F5',
        '--lk-fg': SURFACE.ink, '--lk-fg-secondary': SURFACE.soft,
        '--lk-accent-bg': C.green, '--lk-accent2': C.gold,
        '--lk-danger': '#B91C1C', '--lk-border-color': SURFACE.line,
        '--lk-grid-gap': '12px',
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

      {/* The host's nudge lands here, on the participant's own screen. */}
      <UnmuteRequest onError={setMediaError} />

      <div className="flex min-h-0 flex-1">
        {/* THE STAGE is the one dark surface: a deep radial wash, because
            video and faces sit far better on it than on white, and a rounded
            card so it reads as a distinct object rather than a filled area. */}
        <div className="min-h-0 flex-1 p-3">
          <div className="h-full overflow-hidden rounded-2xl p-2"
            style={{
              background: `radial-gradient(1200px 600px at 50% -10%, #0B5540 0%, ${C.deep} 55%, #041E16 100%)`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)',
            }}>
            <GridLayout tracks={tracks} style={{ height: '100%' }}>
              {/* Our tile: a real <video> when the camera is live, the
                  member's own TNR photograph when it is not. See TnrTile. */}
              <TnrTile />
            </GridLayout>
          </div>
        </div>

        {/* ── Chat ──
         *
         * MOUNTED FOR THE WHOLE MEETING, hidden rather than unmounted when
         * closed. useChat() keeps its messages in React state inside the hook,
         * so unmounting the panel threw the entire conversation away — close
         * the chat to see a face, reopen it, and the meeting's discussion was
         * gone. Hiding costs one offscreen element and keeps every message
         * until the member leaves. */}
        {data.meeting?.chat_enabled && (
          <aside className={`w-full max-w-sm flex-col border-l ${panel === 'chat' ? 'flex' : 'hidden'}`}
            style={{ borderColor: SURFACE.line, background: SURFACE.bg }}>
            <TnrChat onClose={() => setPanel('')} />
          </aside>
        )}
        {panel === 'people' && (
          <PeoplePanel id={id} participants={participants} isHost={data.is_host}
            meHostId={data.me?.id} onClose={() => setPanel('')} />
        )}
        {panel === 'diag' && (
          <Diagnostics room={room} connection={connection} onClose={() => setPanel('')} />
        )}
      </div>

      <Reactions />
      <MediaBar meeting={data.meeting} onError={setMediaError} />

      {/* Mounted ONCE. Without it a member is connected and hears nobody. */}
      <RoomAudioRenderer />

      {/* Browsers block audio until the page has been interacted with. This is
          LiveKit's own handler: it resumes the audio context and disappears
          once playback is allowed. */}
      <StartAudio label="Click to enable sound"
        className="lk-button absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-xl px-4 py-2
          text-sm font-bold text-white shadow-lg"
        style={{ background: C.green }} />
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
  const [hand, setHand] = useState(false);
  const [emoji, setEmoji] = useState(false);

  const run = async (what, fn) => {
    setBusy(what);
    try { await fn(); onError(null); }
    catch (e) { onError(describeMediaError(e, what)); }
    finally { setBusy(''); }
  };

  /* Raise hand as a participant ATTRIBUTE, not a broadcast message.
   *
   * Attributes are state the media server holds and replays to anyone who
   * joins later. A data message is a one-off: raise your hand at 8:02 and the
   * member who joins at 8:05 never sees it, so the host looks straight past
   * someone who has been waiting to speak. */
  const toggleHand = async () => {
    const next = !hand;
    setHand(next);
    try { await localParticipant.setAttributes({ hand: next ? String(Date.now()) : '' }); }
    catch { setHand(!next); }      // put the button back if it did not stick
  };

  // The host can ask for a hand to be lowered; the participant's own client
  // does it, which is also what keeps the attribute owner consistent.
  useDataChannel('tnr-host', (msg) => {
    try {
      const p = JSON.parse(new TextDecoder().decode(msg.payload));
      if (p?.type === 'lower_hand') {
        setHand(false);
        localParticipant.setAttributes({ hand: '' }).catch(() => {});
      }
    } catch { /* not ours */ }
  });

  const react = async (glyph) => {
    setEmoji(false);
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'reaction', glyph })),
        { reliable: false, topic: 'tnr-reaction' },
      );
    } catch { /* a dropped reaction is not worth an error banner */ }
  };

  const canShare = meeting?.screen_share_enabled !== false;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t px-3 py-3"
      style={{ background: SURFACE.bg, borderColor: SURFACE.line }}>

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

      <Toggle on={hand} onLabel="Lower hand" offLabel="Raise hand" icon="✋"
        onClick={toggleHand} />

      {/* Reactions. Fire-and-forget, unreliable on purpose — a clap that
          arrives four seconds late is worse than one that never arrives. */}
      <span className="relative">
        <button onClick={() => setEmoji(!emoji)}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px]
            font-bold transition-colors hover:bg-[rgba(11,107,79,.07)]"
          style={{ borderColor: SURFACE.line, background: SURFACE.bg, color: SURFACE.ink }}>
          <span aria-hidden="true">😀</span> React
        </button>
        {emoji && (
          <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-xl border
            p-1.5 shadow-lg"
            style={{ background: SURFACE.bg, borderColor: SURFACE.line }}>
            {REACTIONS.map(g => (
              <button key={g} onClick={() => react(g)} aria-label={`React ${g}`}
                className="rounded-lg px-1.5 py-1 text-xl transition-transform hover:scale-125">
                {g}
              </button>
            ))}
          </div>
        )}
      </span>

      {/* Speaker choice, where the browser supports setSinkId. */}
      <span className="hidden items-center gap-1 rounded-full border px-2.5 py-2 text-[12px] sm:inline-flex"
        style={{ borderColor: SURFACE.line, background: SURFACE.bg, color: SURFACE.soft }}>
        🔊 <MediaDeviceMenu kind="audiooutput" />
      </span>
    </div>
  );
}

const REACTIONS = ['👍', '👏', '❤️', '😂', '🎉', '🤔', '👋'];

/* Reactions float up from the bottom and disappear.
 *
 * Ephemeral by design — nothing is stored, nothing is in the minutes, and a
 * reaction that arrives after the moment has passed is dropped rather than
 * queued. This is the one part of the room that does not need to be reliable. */
function Reactions() {
  const [live, setLive] = useState([]);

  useDataChannel('tnr-reaction', (msg) => {
    try {
      const p = JSON.parse(new TextDecoder().decode(msg.payload));
      if (p?.type !== 'reaction' || !REACTIONS.includes(p.glyph)) return;   // only our own set
      const item = { key: `${Date.now()}-${Math.random()}`, glyph: p.glyph, who: msg.from?.name || '' };
      setLive(l => [...l.slice(-11), item]);                                 // never more than 12
      setTimeout(() => setLive(l => l.filter(x => x.key !== item.key)), 3200);
    } catch { /* not ours */ }
  });

  if (!live.length) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex
      flex-wrap items-end justify-center gap-3">
      {live.map(r => (
        <span key={r.key} className="flex flex-col items-center"
          style={{ animation: 'tnrFloat 3.2s ease-out forwards' }}>
          <span className="text-3xl">{r.glyph}</span>
          {r.who && <span className="text-[10px] text-white/70">{r.who}</span>}
        </span>
      ))}
      <style>{`@keyframes tnrFloat{
        0%{opacity:0;transform:translateY(20px) scale(.6)}
        18%{opacity:1;transform:translateY(0) scale(1)}
        100%{opacity:0;transform:translateY(-90px) scale(1)}}`}</style>
    </div>
  );
}

/* A panel header that can close itself. */
function PanelHead({ title, onClose }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5"
      style={{ borderColor: SURFACE.line, background: SURFACE.bg }}>
      <h3 className="text-[12px] font-black uppercase tracking-wider" style={{ color: SURFACE.soft }}>{title}</h3>
      <button onClick={onClose} aria-label={`Close ${title}`}
        className="rounded-md px-2 py-0.5 hover:bg-[rgba(11,107,79,.08)]"
        style={{ color: SURFACE.soft }}>✕</button>
    </div>
  );
}

/* A control that reads as one object.
 *
 * The label is hidden below `sm` and the icon carries it, so the bar never
 * wraps to two rows on a phone — which is where these controls matter most,
 * because that is where a mis-tap unmutes you in front of the committee.
 * aria-label keeps the name for screen readers either way. */
function Toggle({ on, busy, onLabel, offLabel, icon, onClick, menu, danger }) {
  const label = busy ? 'Working…' : (on ? onLabel : offLabel);
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-full border transition-colors"
      style={{
        borderColor: on ? C.green : SURFACE.line,
        background: on ? 'rgba(11,107,79,.10)' : SURFACE.bg,
      }}>
      <button onClick={onClick} disabled={busy} aria-pressed={on} aria-label={label}
        title={label}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-bold
          transition-colors hover:bg-[rgba(11,107,79,.07)] disabled:opacity-40"
        style={{ color: danger ? '#B91C1C' : (on ? C.green : SURFACE.ink) }}>
        <span aria-hidden="true" className="text-[15px] leading-none">{icon}</span>
        <span className="hidden sm:inline">{label}</span>
      </button>
      {menu && (
        <span className="grid place-items-center border-l px-1"
          style={{ borderColor: SURFACE.line, color: SURFACE.soft }}>{menu}</span>
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
      style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
      <span aria-hidden="true">⚠️</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-red-700">{err.title}</div>
        <div className="text-[12.5px] leading-relaxed text-red-900/80">{err.body}</div>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss"
        className="text-red-400 hover:text-red-700">✕</button>
    </div>
  );
}

/* ── Diagnostics ─────────────────────────────────────────────────────────── */
/* Exactly the checklist in section 10, read live from the SDK and the browser.
 * NOTHING SENSITIVE: no token, no API key, no member contact details — device
 * labels and track states only. Behind a button, so it is available when
 * something is wrong without cluttering a working meeting. */
function Diagnostics({ room, connection, onClose }) {
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
    <aside className="flex w-full max-w-sm flex-col border-l"
      style={{ borderColor: SURFACE.line, background: SURFACE.bg }}>
      <PanelHead title="Connection diagnostics" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-1.5 text-[12px]"
            style={{ borderColor: SURFACE.line }}>
            <dt style={{ color: SURFACE.soft }}>{k}</dt>
            <dd className={`font-bold ${tone(v)}`}>{show(v)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: SURFACE.soft }}>
        Device and track state only. No tokens, keys or member details are shown here.
      </p>
      </div>
    </aside>
  );
}
const show = (v) => v === true ? 'yes' : v === false ? 'no' : String(v);
// On the white panel: green for good, red for blocked, grey for unknown.
const tone = (v) => v === true || v === 'granted' ? 'text-emerald-700'
  : v === false || v === 'denied' ? 'text-red-600' : 'text-gray-600';

/* ── "The host would like you to speak" ──────────────────────────────────── */
/* A PROMPT, NOT A COMMAND — see the long note in lib/livekit.js. The host can
 * silence a microphone from the server; only the person sitting behind it can
 * open one. This is the second half of that: one tap to accept.
 *
 * It also gives the member somewhere to fail visibly. If their microphone is
 * unplugged or held by another application, the same error banner explains it
 * rather than the host wondering why nothing happened. */
function UnmuteRequest({ onError }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [ask, setAsk] = useState(null);

  useDataChannel('tnr-host', (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      if (payload?.type === 'ask_unmute') setAsk(payload);
    } catch { /* not one of ours */ }
  });

  // Nothing to ask once they are already speaking.
  useEffect(() => { if (isMicrophoneEnabled) setAsk(null); }, [isMicrophoneEnabled]);

  if (!ask) return null;

  const accept = async () => {
    try { await localParticipant.setMicrophoneEnabled(true); setAsk(null); }
    catch (e) { setAsk(null); onError(describeMediaError(e, 'microphone')); }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
      style={{ background: 'rgba(215,174,74,.14)', borderColor: SURFACE.line }}>
      <span aria-hidden="true">🎤</span>
      <p className="min-w-0 flex-1 text-[13px]" style={{ color: SURFACE.ink }}>
        <strong>{ask.from || 'The host'}</strong> has asked you to unmute.
      </p>
      <button onClick={accept}
        className="rounded-lg px-3 py-1.5 text-[12.5px] font-black text-white"
        style={{ background: C.green }}>Unmute</button>
      <button onClick={() => setAsk(null)}
        className="rounded-lg border px-3 py-1.5 text-[12.5px] font-bold"
        style={{ borderColor: SURFACE.line, background: SURFACE.bg, color: SURFACE.ink }}>Stay muted</button>
    </div>
  );
}

/* ── People ──────────────────────────────────────────────────────────────── */
function PeoplePanel({ id, participants, isHost, meHostId, onClose }) {
  const room = useRoomContext();
  const [busy, setBusy] = useState('');
  const [, bump] = useState(0);

  /* Attributes change without any track changing, so the participant list
   * would not re-render on its own when someone raises a hand. */
  useEffect(() => {
    if (!room) return;
    const redraw = () => bump(n => n + 1);
    room.on(RoomEvent.ParticipantAttributesChanged, redraw);
    return () => { room.off(RoomEvent.ParticipantAttributesChanged, redraw); };
  }, [room]);

  const act = async (action, memberIds, key) => {
    setBusy(key);
    await mPost('/api/member/meetings/room', { meeting_id: id, action, member_ids: memberIds });
    setBusy('');
  };

  const lowerHand = async (identity) => {
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'lower_hand' })),
        { reliable: true, topic: 'tnr-host', destinationIdentities: [String(identity)] },
      );
    } catch { /* they have left */ }
  };

  const eject = async (p) => {
    if (!confirm(`Remove ${p.name || 'this member'} from the meeting?\n\n`
      + `They will be disconnected immediately and cannot rejoin unless you re-admit them.`)) return;
    await act('remove', [p.identity], p.identity);
  };

  // Identity IS the member uuid — set by the server at token time.
  const others = participants.filter(p => String(p.identity) !== String(meHostId));
  const raised = (p) => !!p.attributes?.hand;

  /* Raised hands first, oldest first — whoever has been waiting longest is
   * top of the list, which is the whole point of raising a hand. */
  const ordered = [...participants].sort((a, b) => {
    const ha = a.attributes?.hand || '', hb = b.attributes?.hand || '';
    if (ha && hb) return Number(ha) - Number(hb);
    if (ha) return -1;
    if (hb) return 1;
    return 0;
  });
  const hands = ordered.filter(raised).length;

  return (
    <aside className="flex w-full max-w-sm flex-col border-l"
      style={{ borderColor: SURFACE.line, background: SURFACE.bg }}>
      <PanelHead title={`In the room (${participants.length})`} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {hands > 0 && (
          <p className="mb-2 rounded-lg px-2.5 py-1.5 text-[12px] font-bold"
            style={{ background: 'rgba(215,174,74,.16)', color: C.goldInk }}>
            ✋ {hands} {hands === 1 ? 'hand' : 'hands'} raised
          </p>
        )}

        {isHost && others.length > 0 && (
          <button onClick={() => act('mute_all', [], 'all')} disabled={!!busy}
            className="mb-2 w-full rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold
              hover:bg-[rgba(11,107,79,.07)] disabled:opacity-40"
            style={{ borderColor: SURFACE.line, color: SURFACE.ink }}>
            {busy === 'all' ? 'Muting…' : 'Mute everyone'}
          </button>
        )}

      <ul className="space-y-1.5">
        {ordered.map(p => {
          // Set by the SERVER when the token was minted — see lib/livekit.js.
          const meta = readMeta(p);
          const isMe = String(p.identity) === String(meHostId);
          const theyAreHost = meta.role === 'host' || meta.role === 'co_host';

          return (
            <li key={p.identity} className="rounded-xl border px-2.5 py-2"
              style={{
                background: raised(p) ? 'rgba(215,174,74,.12)' : SURFACE.bg,
                borderColor: raised(p) ? 'rgba(215,174,74,.45)' : SURFACE.line,
              }}>
              <div className="flex items-center gap-2.5">
                {raised(p) && <span className="text-[15px]" title="Hand raised">✋</span>}
                {meta.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover"
                    style={{ boxShadow: `0 0 0 1.5px ${SURFACE.line}` }} />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-black text-white"
                    style={{ background: 'linear-gradient(150deg,#0F6B4E,#083527)' }}>
                    {String(p.name || 'M').trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: SURFACE.ink }}>
                    {p.name || 'Member'}{isMe ? ' (you)' : ''}
                  </span>
                  <span className="block font-mono text-[10.5px]" style={{ color: SURFACE.soft }}>
                    {meta.membership_id || ''}
                    {meta.role && meta.role !== 'participant' ? ` · ${meta.role.replace('_', '-')}` : ''}
                  </span>
                </span>
                <span className="text-[13px]" title={p.isMicrophoneEnabled ? 'Unmuted' : 'Muted'}>
                  {p.isMicrophoneEnabled ? '🎤' : '🔇'}
                </span>
                <span className="text-[13px]" title={p.isCameraEnabled ? 'Camera on' : 'Camera off'}>
                  {p.isCameraEnabled ? '📹' : '⬛'}
                </span>
              </div>

              {/* Host controls. Co-hosts are left alone — a chair silencing the
                  other chair mid-sentence is a different kind of problem. */}
              {isHost && !isMe && !theyAreHost && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.isMicrophoneEnabled ? (
                    <button onClick={() => act('mute_participant', [p.identity], p.identity)}
                      disabled={!!busy}
                      className="rounded-md border px-2 py-0.5 text-[11px] font-bold
                        hover:bg-[rgba(11,107,79,.07)] disabled:opacity-40"
                      style={{ borderColor: SURFACE.line, color: SURFACE.ink }}>
                      {busy === p.identity ? '…' : 'Mute'}
                    </button>
                  ) : (
                    <button onClick={() => act('ask_unmute', [p.identity], p.identity)}
                      disabled={!!busy}
                      className="rounded-md px-2 py-0.5 text-[11px] font-bold disabled:opacity-40"
                      style={{ background: 'rgba(215,174,74,.18)', color: C.goldInk }}
                      title="They will be asked — only they can switch their microphone on">
                      {busy === p.identity ? '…' : 'Ask to unmute'}
                    </button>
                  )}

                  {raised(p) && (
                    <button onClick={() => lowerHand(p.identity)}
                      className="rounded-md border px-2 py-0.5 text-[11px] font-bold
                        hover:bg-[rgba(11,107,79,.07)]"
                      style={{ borderColor: SURFACE.line, color: SURFACE.ink }}>
                      Lower hand
                    </button>
                  )}

                  {/* Last, and red. A destructive action should not sit next to
                      Mute where a mis-tap costs someone their seat. */}
                  <button onClick={() => eject(p)} disabled={!!busy}
                    className="rounded-md border px-2 py-0.5 text-[11px] font-bold text-red-600
                      hover:bg-red-50 disabled:opacity-40"
                    style={{ borderColor: 'rgba(220,38,38,.35)' }}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

        {isHost && (
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: SURFACE.soft }}>
            Muting takes effect immediately. Unmuting is a request — only the
            member can switch their own microphone on. Removing disconnects
            them at once.
          </p>
        )}
      </div>
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

  const tab = (key, label, badge) => {
    const on = panel === key;
    return (
      <button onClick={() => setPanel(on ? '' : key)} aria-pressed={on}
        className="relative rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
        style={{
          borderColor: on ? C.green : SURFACE.line,
          background: on ? C.green : SURFACE.bg,
          color: on ? '#fff' : SURFACE.ink,
        }}>
        {label}
        {badge > 0 && (
          <span className="ml-1.5 rounded-full px-1.5 text-[10px] font-black"
            style={on
              ? { background: 'rgba(255,255,255,.22)', color: '#fff' }
              : { background: 'rgba(11,107,79,.12)', color: C.green }}>{badge}</span>
        )}
      </button>
    );
  };

  const state = connection === ConnectionState.Connected ? ['bg-emerald-400', 'TNR Virtual Hall']
    : connection === ConnectionState.Reconnecting ? ['animate-pulse bg-amber-400', 'Reconnecting…']
      : ['bg-red-400', String(connection)];

  return (
    <>
      <header className="flex flex-wrap items-center gap-2 border-b px-3.5 py-2.5"
        style={{ background: SURFACE.bg, borderColor: SURFACE.line }}>
        {/* A small green rule as the mark — a full logo in a meeting header
            competes with the faces, which are the point of the screen. */}
        <span aria-hidden="true" className="h-7 w-1 shrink-0 rounded-full"
          style={{ background: `linear-gradient(${C.green}, ${C.gold})` }} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-black" style={{ color: C.deep }}>
            {meeting?.title}
          </div>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: SURFACE.soft }}>
            <span className={`h-1.5 w-1.5 rounded-full ${state[0]}`} />
            {state[1]}
          </div>
        </div>

        {meeting?.recording_enabled && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
            text-[11px] font-bold text-red-700"
            style={{ background: 'rgba(220,38,38,.10)' }}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
            <span className="hidden sm:inline">Recording enabled</span>
            <span className="sm:hidden">REC</span>
          </span>
        )}

        {tab('people', 'People', count)}
        {meeting?.chat_enabled && tab('chat', 'Chat')}
        {tab('diag', 'Diagnostics')}

        {isHost && meeting?.waiting_room_enabled && (
          <button onClick={() => setLobby(!lobby)}
            className="relative rounded-full border px-3 py-1.5 text-[12px] font-bold"
            style={{
              borderColor: waiting.length ? C.goldInk : SURFACE.line,
              background: waiting.length ? 'rgba(215,174,74,.16)' : SURFACE.bg,
              color: waiting.length ? C.goldInk : SURFACE.ink,
            }}>
            Waiting room
            {waiting.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full
                px-1 text-[10px] font-black text-white shadow" style={{ background: C.goldInk }}>
                {waiting.length}
              </span>
            )}
          </button>
        )}

        {isHost && (
          <button onClick={end} disabled={busy}
            className="rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white
              shadow-sm transition hover:bg-red-700 disabled:opacity-40">
            End for all
          </button>
        )}
        <button onClick={onLeave}
          className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
          style={{ borderColor: SURFACE.line, background: SURFACE.bg, color: SURFACE.ink }}>
          Leave
        </button>
      </header>

      {lobby && isHost && (
        <div className="border-b px-4 py-3" style={{ background: '#FBFAF6', borderColor: SURFACE.line }}>
          {!waiting.length ? (
            <p className="text-[12.5px]" style={{ color: SURFACE.soft }}>Nobody is waiting.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold" style={{ color: SURFACE.ink }}>
                  {waiting.length} waiting to join
                </span>
                <button onClick={() => decide('admit', waiting.map(p => p.member_id))} disabled={busy}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-black text-white disabled:opacity-40"
                  style={{ background: C.green }}>Admit all</button>
              </div>
              <ul className="space-y-1.5">
                {waiting.map(p => (
                  <li key={p.id} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5"
                    style={{ background: SURFACE.bg, borderColor: SURFACE.line }}>
                    {p.member?.photo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.member.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      : <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: 'linear-gradient(150deg,#0F6B4E,#083527)' }}>
                        {(p.member?.full_name || '?').charAt(0).toUpperCase()}
                      </span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold" style={{ color: SURFACE.ink }}>
                        {p.member?.full_name || 'Member'}
                      </span>
                      <span className="block font-mono text-[10.5px]" style={{ color: SURFACE.soft }}>
                        {p.member?.membership_id}
                      </span>
                    </span>
                    <button onClick={() => decide('admit', [p.member_id])} disabled={busy}
                      className="rounded-md px-2.5 py-1 text-[11.5px] font-bold text-white disabled:opacity-40"
                      style={{ background: C.green }}>Admit</button>
                    <button onClick={() => decide('reject', [p.member_id])} disabled={busy}
                      className="rounded-md border px-2.5 py-1 text-[11.5px] font-bold disabled:opacity-40"
                      style={{ borderColor: SURFACE.line, color: SURFACE.ink }}>Reject</button>
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
