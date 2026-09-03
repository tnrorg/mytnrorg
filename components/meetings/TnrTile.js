'use client';
import { VideoTrack, useTrackRefContext, useIsSpeaking } from '@livekit/components-react';
import { Track } from 'livekit-client';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D7AE4A' };

/* A participant tile, TNR's own.
 *
 * WHY NOT THE STOCK <ParticipantTile>: its no-camera placeholder is a generic
 * grey silhouette. Every TNR member already has a profile photograph on their
 * membership record, and the server puts its URL in the participant metadata
 * when it mints the token — so a room of people with their cameras off can
 * show the actual committee rather than a wall of identical outlines. That is
 * most of the difference between this feeling like our product and feeling
 * like a generic embed.
 *
 * Everything about the media path is unchanged: VideoTrack still attaches the
 * real MediaStreamTrack to a real <video>. Only the fallback and the chrome
 * around it are ours.
 */
export default function TnrTile() {
  const trackRef = useTrackRefContext();
  const p = trackRef?.participant;
  const speaking = useIsSpeaking(p);

  if (!p) return null;

  const meta = readMeta(p);
  const isScreen = trackRef.source === Track.Source.ScreenShare;

  /* A publication exists but is muted when someone stops their camera without
   * unpublishing. Both cases must show the photo, so the check is on the
   * TRACK being live rather than merely present. */
  const live = !!trackRef.publication && !trackRef.publication.isMuted && !!trackRef.publication.track;

  const host = meta.role === 'host' || meta.role === 'co_host';
  const hand = !!p.attributes?.hand;

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-2xl transition-all duration-300"
      style={{
        background: 'linear-gradient(155deg,#0C5540,#083527)',
        // The speaking ring is the single most useful signal in a grid of
        // faces — it answers "who is talking" before anyone reads a name.
        boxShadow: speaking
          ? `0 0 0 2.5px ${C.gold}, 0 8px 30px rgba(0,0,0,.45)`
          : '0 0 0 1px rgba(255,255,255,.07), 0 4px 18px rgba(0,0,0,.28)',
      }}>

      {live ? (
        <VideoTrack trackRef={trackRef}
          className="h-full w-full object-cover"
          // A shared screen is content, not a face: letterbox it rather than
          // cropping the edges off a slide.
          style={isScreen ? { objectFit: 'contain', background: '#04211A' } : undefined} />
      ) : (
        <Placeholder meta={meta} name={p.name} speaking={speaking} />
      )}

      {/* ── Name plate ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5"
        style={{ background: live ? 'linear-gradient(to top, rgba(3,25,18,.86), transparent)' : 'transparent' }}>
        <span className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 backdrop-blur-sm"
          style={{ background: 'rgba(3,25,18,.55)' }}>
          <MicDot on={p.isMicrophoneEnabled} speaking={speaking} />
          <span className="truncate text-[12.5px] font-semibold text-white">
            {p.name || 'Member'}
          </span>
          {host && (
            <span className="rounded px-1.5 py-px text-[9px] font-black uppercase tracking-wider"
              style={{ background: 'rgba(215,174,74,.22)', color: C.gold }}>
              {meta.role === 'host' ? 'Host' : 'Co-host'}
            </span>
          )}
        </span>

        {isScreen && (
          <span className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white"
            style={{ background: 'rgba(11,107,79,.85)' }}>Sharing</span>
        )}
      </div>

      {/* ── Raised hand ── */}
      {hand && (
        <span className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full text-[15px] shadow-lg"
          style={{ background: C.gold, color: C.deep, animation: 'tnrWave 1.6s ease-in-out infinite' }}>
          ✋
        </span>
      )}

      <style>{`@keyframes tnrWave{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}`}</style>
    </div>
  );
}

/* Camera off — the member's own photograph, not a silhouette. */
function Placeholder({ meta, name, speaking }) {
  const initials = String(name || 'M').trim().split(/\s+/).slice(0, 2)
    .map(w => w.charAt(0).toUpperCase()).join('');

  return (
    <div className="grid h-full w-full place-items-center">
      <div className="relative">
        {/* A soft pulse behind the photo while they speak, so the tile still
            reads as active with the camera off. */}
        {speaking && (
          <span className="absolute -inset-3 animate-ping rounded-full opacity-30"
            style={{ background: C.gold, animationDuration: '1.8s' }} />
        )}
        {meta.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.photo_url} alt=""
            className="relative h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28"
            style={{ boxShadow: `0 0 0 3px ${speaking ? C.gold : 'rgba(255,255,255,.16)'}` }} />
        ) : (
          <span className="relative grid h-24 w-24 place-items-center rounded-full text-3xl font-black
            text-white sm:h-28 sm:w-28"
            style={{
              background: 'linear-gradient(150deg,#0F6B4E,#083527)',
              boxShadow: `0 0 0 3px ${speaking ? C.gold : 'rgba(255,255,255,.16)'}`,
            }}>
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

/* Mic state as a dot rather than an emoji: it sits on a name plate at 12px,
 * where a 🎤 glyph renders differently on every platform and reads as noise. */
function MicDot({ on, speaking }) {
  if (!on) return (
    <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-red-500/90"
      title="Muted" aria-label="Muted">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
        <path d="M4 4l16 16" strokeLinecap="round" />
      </svg>
    </span>
  );
  return (
    <span className="h-2 w-2 shrink-0 rounded-full transition-colors"
      style={{ background: speaking ? C.gold : 'rgba(255,255,255,.45)' }}
      title={speaking ? 'Speaking' : 'Unmuted'} aria-label={speaking ? 'Speaking' : 'Unmuted'} />
  );
}

/** Metadata the SERVER set at token time — membership id, role, photo. */
export function readMeta(p) {
  try { return JSON.parse(p?.metadata || '{}') || {}; } catch { return {}; }
}
