import 'server-only';
import {
  AccessToken, TrackSource, TrackType, RoomServiceClient, DataPacket_Kind,
} from 'livekit-server-sdk';

/* LiveKit access tokens — SERVER ONLY.
 *
 * THE API SECRET NEVER LEAVES THIS FILE'S PROCESS. It is not sent to the
 * browser, not embedded in a page, and not exposed through any NEXT_PUBLIC_
 * variable. The browser receives a short-lived signed token that grants the
 * exact permissions the database says this member has, and nothing more.
 *
 * The room URL is the one value the client legitimately needs, and it is
 * returned alongside the token rather than published as NEXT_PUBLIC_, so a
 * visitor who is not entitled to a meeting never learns it either.
 */

export function livekitConfig() {
  const url = process.env.LIVEKIT_URL || '';
  const key = process.env.LIVEKIT_API_KEY || '';
  const secret = process.env.LIVEKIT_API_SECRET || '';
  return { url, key, secret, configured: !!(url && key && secret) };
}

/**
 * Mint a token for one member, in one room.
 *
 * CALLERS MUST HAVE ALREADY AUTHORISED THE REQUEST. This function does not
 * check whether the member may join — it only translates a decision that was
 * already made into LiveKit's permission vocabulary. Everything it grants is
 * derived from arguments the SERVER computed from the database; nothing here
 * comes from the browser, because a client that could name its own role could
 * name itself host.
 *
 * @param {object}  o
 * @param {string}  o.room          the meeting's opaque room_id
 * @param {string}  o.identity      stable per-member id — the membership uuid
 * @param {string}  o.name          display name shown in the room
 * @param {boolean} o.canPublish    may send audio/video at all
 * @param {boolean} o.canShareScreen
 * @param {object}  o.metadata      small, PUBLIC-in-room facts (never contact details)
 * @param {number}  o.ttlMinutes
 */
export function mintToken({
  room, identity, name, canPublish = true, canShareScreen = true,
  metadata = {}, ttlMinutes = 240,
}) {
  const { key, secret, configured } = livekitConfig();
  if (!configured) throw new Error('LIVEKIT_NOT_CONFIGURED');
  if (!room || !identity) throw new Error('LIVEKIT_BAD_ARGS');

  const at = new AccessToken(key, secret, {
    identity: String(identity),
    name: String(name || 'TNR Member'),
    /* Long enough to outlast the meeting, because a token that expires
     * mid-session drops the participant with an error nobody can act on.
     * Bounded anyway: it is only valid for THIS room. */
    ttl: `${ttlMinutes}m`,
    // Rendered next to the participant's tile. Deliberately only the
    // membership ID and role — never mobile, email, address or date of birth,
    // because everyone else in the room can read this.
    metadata: JSON.stringify(metadata),
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: true,          // chat, raise hand, reactions
    canUpdateOwnMetadata: true,    // raise/lower hand
    /* Restricting screen share means listing what they MAY publish, since
     * LiveKit has no "deny one source" grant.
     *
     * These must be TrackSource enum values, not the strings they serialise
     * to: the SDK maps enum → string when signing and throws on anything else,
     * so passing 'camera' fails at token creation — after the member has
     * already pressed Join. */
    ...(canShareScreen ? {} : {
      canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    }),
  });

  return at.toJwt();
}

/* ── Host moderation ──────────────────────────────────────────────────────
 *
 * A HOST CAN SILENCE SOMEONE. A HOST CANNOT SWITCH ON THEIR MICROPHONE.
 *
 * Muting is enforced here, on the server, against the media server itself, so
 * it holds whatever the participant's browser does about it. Un-muting is
 * deliberately NOT implemented as a forced action, and that is a decision
 * rather than an omission: remotely opening a person's microphone is a
 * listening device, not a meeting control. A committee member sitting in their
 * kitchen has to be the one who decides their room can be heard.
 *
 * So "unmute" is a REQUEST — the participant gets a prompt and one tap. It is
 * what Zoom and Teams do, for the same reason.
 */

/* Which of a participant's published tracks is their microphone.
 *
 * Source first, since that is what LiveKit sets for a normal mic. The type
 * check is the fallback for a track published without a source — and it must
 * compare against TrackType.AUDIO explicitly, because that enum value is ZERO.
 * A truthiness test here silently picks nothing, and `t.type === 1` is VIDEO,
 * which would have muted the participant's CAMERA when the host asked for
 * silence. Both are the kind of mistake that only shows up in a live meeting.
 */
const isMicTrack = (t) =>
  t?.source === TrackSource.MICROPHONE
  || (t?.source === TrackSource.UNKNOWN && t?.type === TrackType.AUDIO);

/** REST client for the media server. Server-side only, by construction. */
function roomService() {
  const { url, key, secret, configured } = livekitConfig();
  if (!configured) throw new Error('LIVEKIT_NOT_CONFIGURED');
  // The signalling URL is wss://; the management API is the https:// origin.
  const http = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  return new RoomServiceClient(http, key, secret);
}

/**
 * Force a participant's microphone off.
 *
 * Finds their published audio track and mutes it at the media server, so the
 * silence is real rather than a request their client may ignore.
 * Returns false when they have no microphone published — already silent.
 */
export async function forceMuteAudio(room, identity) {
  const svc = roomService();
  const p = await svc.getParticipant(room, String(identity));
  const audio = (p?.tracks || []).find(isMicTrack);
  if (!audio?.sid) return false;
  if (audio.muted) return true;                       // already muted; nothing to do
  await svc.mutePublishedTrack(room, String(identity), audio.sid, true);
  return true;
}

/** Everyone except the identities listed — used for "mute everyone else". */
export async function forceMuteEveryone(room, exceptIdentities = []) {
  const svc = roomService();
  const skip = new Set(exceptIdentities.map(String));
  const people = await svc.listParticipants(room);
  let muted = 0;
  for (const p of people || []) {
    if (skip.has(String(p.identity))) continue;
    const audio = (p.tracks || []).find(isMicTrack);
    if (!audio?.sid || audio.muted) continue;
    try { await svc.mutePublishedTrack(room, p.identity, audio.sid, true); muted += 1; }
    catch { /* someone who left mid-loop is not an error worth failing on */ }
  }
  return muted;
}

/**
 * Disconnect someone from the room, now.
 *
 * The database flag alone is not enough: `admission = 'removed'` stops them
 * getting a NEW token, but someone already connected stays connected — they
 * would sit in the meeting they had just been removed from until they chose
 * to leave. This closes the connection at the media server.
 *
 * Never throws for a participant who has already gone; that is the outcome
 * the caller wanted.
 */
export async function ejectParticipant(room, identity) {
  try {
    await roomService().removeParticipant(room, String(identity));
    return true;
  } catch (e) {
    if (/not found|does not exist/i.test(e?.message || '')) return true;
    throw e;
  }
}

/**
 * Ask a participant to unmute. A message, not a command.
 *
 * Delivered over the room's data channel to that one person, so nobody else
 * sees the nudge.
 */
export async function askToUnmute(room, identity, from = '') {
  const svc = roomService();
  const payload = new TextEncoder().encode(JSON.stringify({
    type: 'ask_unmute', from: String(from).slice(0, 60), at: Date.now(),
  }));
  await svc.sendData(room, payload, DataPacket_Kind.RELIABLE, {
    destinationIdentities: [String(identity)],
    topic: 'tnr-host',
  });
  return true;
}

/* What a given standing in a meeting is allowed to do.
 *
 * One place, so the room UI and the token agree. `role` and the meeting's
 * settings both come from the database — the browser has no say in either.
 */
export function grantsFor({ role, meeting }) {
  const host = role === 'host' || role === 'co_host';
  return {
    canPublish: true,
    // Screen sharing off means HOST ONLY, not nobody — a training session
    // where the trainer cannot show slides is not a training session.
    canShareScreen: host || meeting?.screen_share_enabled !== false,
    isHost: host,
  };
}
