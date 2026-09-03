import 'server-only';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

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
