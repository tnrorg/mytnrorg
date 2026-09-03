'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  LiveKitRoom, RoomAudioRenderer, StartAudio, GridLayout, ParticipantTile,
  Chat, MediaDeviceMenu, useTracks, useLocalParticipant, useRoomContext,
  useConnectionState, useParticipants, useDataChannel,
} from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
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

      {/* The host's nudge lands here, on the participant's own screen. */}
      <UnmuteRequest onError={setMediaError} />

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 p-2">
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            {/* ParticipantTile attaches the real track to a real <video>.
                Its own placeholder covers the no-camera case. */}
            <ParticipantTile />
          </GridLayout>
        </div>

        {/* Chat sits BESIDE the speaker rather than over them, and closes from
            its own header — a panel you can only dismiss from a toolbar button
            somewhere else is one people leave open and then complain about. */}
        {panel === 'chat' && data.meeting?.chat_enabled && (
          <aside className="flex w-full max-w-sm flex-col border-l"
            style={{ borderColor: 'rgba(255,255,255,.10)', background: '#0A4A35' }}>
            <PanelHead title="Chat" onClose={() => setPanel('')} />
            <div className="min-h-0 flex-1"><Chat /></div>
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

      <Toggle on={hand} onLabel="Lower hand" offLabel="Raise hand" icon="✋"
        onClick={toggleHand} />

      {/* Reactions. Fire-and-forget, unreliable on purpose — a clap that
          arrives four seconds late is worse than one that never arrives. */}
      <span className="relative">
        <button onClick={() => setEmoji(!emoji)}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px]
            font-bold text-white transition-colors hover:bg-white/10"
          style={{ borderColor: 'rgba(255,255,255,.18)' }}>
          <span aria-hidden="true">😀</span> React
        </button>
        {emoji && (
          <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-xl border
            p-1.5 shadow-lg"
            style={{ background: '#0A4A35', borderColor: 'rgba(255,255,255,.18)' }}>
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
      <span className="hidden items-center gap-1 rounded-xl border px-2 py-1.5 text-[12px] text-white/70 sm:inline-flex"
        style={{ borderColor: 'rgba(255,255,255,.18)' }}>
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
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2"
      style={{ borderColor: 'rgba(255,255,255,.10)' }}>
      <h3 className="text-[12px] font-black uppercase tracking-wider text-white/60">{title}</h3>
      <button onClick={onClose} aria-label={`Close ${title}`}
        className="rounded-md px-2 py-0.5 text-white/50 hover:bg-white/10 hover:text-white">✕</button>
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
      style={{ borderColor: 'rgba(255,255,255,.10)', background: '#0A4A35' }}>
      <PanelHead title="Connection diagnostics" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
      </div>
    </aside>
  );
}
const show = (v) => v === true ? 'yes' : v === false ? 'no' : String(v);
const tone = (v) => v === true || v === 'granted' ? 'text-green-300'
  : v === false || v === 'denied' ? 'text-red-300' : 'text-white/70';

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
      style={{ background: 'rgba(215,174,74,.16)', borderColor: 'rgba(255,255,255,.10)' }}>
      <span aria-hidden="true">🎤</span>
      <p className="min-w-0 flex-1 text-[13px] text-white">
        <strong>{ask.from || 'The host'}</strong> has asked you to unmute.
      </p>
      <button onClick={accept}
        className="rounded-lg px-3 py-1.5 text-[12.5px] font-black"
        style={{ background: C.gold, color: C.deep }}>Unmute</button>
      <button onClick={() => setAsk(null)}
        className="rounded-lg border px-3 py-1.5 text-[12.5px] font-bold text-white/80"
        style={{ borderColor: 'rgba(255,255,255,.25)' }}>Stay muted</button>
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
      style={{ borderColor: 'rgba(255,255,255,.10)', background: '#0A4A35' }}>
      <PanelHead title={`In the room (${participants.length})`} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {hands > 0 && (
          <p className="mb-2 rounded-lg px-2.5 py-1.5 text-[12px] font-bold"
            style={{ background: 'rgba(215,174,74,.16)', color: C.gold }}>
            ✋ {hands} {hands === 1 ? 'hand' : 'hands'} raised
          </p>
        )}

        {isHost && others.length > 0 && (
          <button onClick={() => act('mute_all', [], 'all')} disabled={!!busy}
            className="mb-2 w-full rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold text-white/85
              hover:bg-white/10 disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,.25)' }}>
            {busy === 'all' ? 'Muting…' : 'Mute everyone'}
          </button>
        )}

      <ul className="space-y-1.5">
        {ordered.map(p => {
          // Set by the SERVER when the token was minted — see lib/livekit.js.
          let meta = {};
          try { meta = JSON.parse(p.metadata || '{}'); } catch { /* not ours */ }
          const isMe = String(p.identity) === String(meHostId);
          const theyAreHost = meta.role === 'host' || meta.role === 'co_host';

          return (
            <li key={p.identity} className="rounded-lg px-2.5 py-1.5"
              style={{ background: raised(p) ? 'rgba(215,174,74,.14)' : 'rgba(255,255,255,.05)' }}>
              <div className="flex items-center gap-2.5">
                {raised(p) && <span className="text-[15px]" title="Hand raised">✋</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {p.name || 'Member'}{isMe ? ' (you)' : ''}
                  </span>
                  <span className="block font-mono text-[10.5px] text-white/40">
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
                      className="rounded-md border px-2 py-0.5 text-[11px] font-bold text-white/80
                        hover:bg-white/10 disabled:opacity-40"
                      style={{ borderColor: 'rgba(255,255,255,.25)' }}>
                      {busy === p.identity ? '…' : 'Mute'}
                    </button>
                  ) : (
                    <button onClick={() => act('ask_unmute', [p.identity], p.identity)}
                      disabled={!!busy}
                      className="rounded-md px-2 py-0.5 text-[11px] font-bold disabled:opacity-40"
                      style={{ background: 'rgba(215,174,74,.2)', color: C.gold }}
                      title="They will be asked — only they can switch their microphone on">
                      {busy === p.identity ? '…' : 'Ask to unmute'}
                    </button>
                  )}

                  {raised(p) && (
                    <button onClick={() => lowerHand(p.identity)}
                      className="rounded-md border px-2 py-0.5 text-[11px] font-bold text-white/80
                        hover:bg-white/10"
                      style={{ borderColor: 'rgba(255,255,255,.25)' }}>
                      Lower hand
                    </button>
                  )}

                  {/* Last, and red. A destructive action should not sit next to
                      Mute where a mis-tap costs someone their seat. */}
                  <button onClick={() => eject(p)} disabled={!!busy}
                    className="rounded-md border px-2 py-0.5 text-[11px] font-bold text-red-300
                      hover:bg-red-500/15 disabled:opacity-40"
                    style={{ borderColor: 'rgba(248,113,113,.4)' }}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

        {isHost && (
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
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
