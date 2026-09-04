// Member authentication — mirrors the proven admin pattern already in this
// project (bcrypt + signed JWT + nodemailer), so there is ONE auth approach,
// one SMTP configuration, and no new secrets. Server only.
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { fail } from '@/lib/api';
import { TNR_TZ } from '@/lib/contributions';

import { jwtSecret } from '@/lib/jwtSecret';

const SECRET = () => jwtSecret();
const TTL = '7d';
const LOGIN_STATUSES = ['approved', 'active'];   // suspended/inactive/expired cannot log in

export function signMemberToken(m) {
  return jwt.sign(
    { sub: m.id, mid: m.membership_id, email: m.email, epoch: Number(m.session_epoch || 0), kind: 'member' },
    SECRET(), { expiresIn: TTL }
  );
}
export function verifyMemberToken(token) {
  try {
    const p = jwt.verify(token, SECRET());
    return p.kind === 'member' ? p : null;
  } catch { return null; }
}

// Guard for every /api/member/* route.
export async function requireMember(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const claim = token && verifyMemberToken(token);
  if (!claim) return { member: null, res: fail('UNAUTHORIZED', 401, { message: 'Please sign in.' }) };

  const { data: m } = await supabaseAdmin().from('membership_members')
    .select('*').eq('id', claim.sub).is('deleted_at', null).maybeSingle();
  if (!m) return { member: null, res: fail('UNAUTHORIZED', 401, { message: 'Account not found.' }) };

  // Suspended / inactive / expired members lose portal access immediately.
  if (!LOGIN_STATUSES.includes(m.status))
    return { member: null, res: fail('ACCOUNT_BLOCKED', 403, {
      message: 'Your membership is not currently active. Please contact the membership committee.' }) };

  // "Log out from all devices" invalidates older tokens.
  // Coerce both sides: Postgres may hand back the value as a string, and a
  // string/number mismatch would wrongly log everybody out.
  const tokenEpoch = Number(claim.epoch ?? 0);
  const dbEpoch = Number(m.session_epoch ?? 0);
  if (Number.isFinite(tokenEpoch) && Number.isFinite(dbEpoch) && tokenEpoch < dbEpoch)
    return { member: null, res: fail('SESSION_EXPIRED', 401, { message: 'Your session has expired. Please sign in again.' }) };

  /* Record that the portal was used today.
   *
   * Fire-and-forget, and deliberately at most ONE write per member per day:
   * the member row is already loaded, so comparing last_seen_at against
   * today's date in TNR time costs nothing, and every request after the first
   * one that day skips the write entirely.
   *
   * NOT awaited. An authenticated request must never fail, or slow down,
   * because a usage counter could not be written — the counter is the least
   * important thing happening in this function.
   *
   * A DAY, not a page view. This is the smallest unit that answers "is this
   * member using the portal" without becoming a record of what they looked at.
   */
  touchActiveDay(m).catch(() => {});

  return { member: m, res: null };
}

async function touchActiveDay(m) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TNR_TZ });
  const seen = m.last_seen_at
    ? new Date(m.last_seen_at).toLocaleDateString('en-CA', { timeZone: TNR_TZ })
    : null;
  if (seen === today) return;          // already counted today

  const sb = supabaseAdmin();
  const now = new Date().toISOString();

  // onConflict so two requests arriving in the same second cannot create two
  // rows for one day, and cannot fail the second one with a duplicate key.
  await sb.from('member_active_days')
    .upsert({ member_id: m.id, day: today, hits: 1, first_seen_at: now, last_seen_at: now },
      { onConflict: 'member_id,day', ignoreDuplicates: true });

  await sb.from('membership_members').update({ last_seen_at: now }).eq('id', m.id);
}

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => hash ? bcrypt.compare(plain, hash) : Promise.resolve(false);

export function makeInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}
export const inviteExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

export function canLogin(status) { return LOGIN_STATUSES.includes(status); }
