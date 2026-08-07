import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyOtpHash, OTP_MAX_ATTEMPTS } from '@/lib/otp';
import { signVoteToken } from '@/lib/voteToken';
import { getActiveElection } from '@/lib/election';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const sb = supabaseAdmin();
  const { otp_id, code } = await readJson(req);
  const ip = clientIp(req);
  if (!otp_id || !code) return fail('MISSING', 400, { message: 'Enter the code sent to your number.' });

  const { data: otp } = await sb.from('otp_verifications').select('*').eq('id', otp_id).maybeSingle();
  if (!otp)            return fail('OTP_NOT_FOUND', 404, { message: 'OTP session not found. Please request a new code.' });
  if (otp.consumed)    return fail('OTP_USED', 409, { message: 'This code has already been used. Request a new one.' });
  if (new Date(otp.expires_at).getTime() < Date.now())
    return fail('OTP_EXPIRED', 410, { message: 'Your code has expired. Please request a new one.' });
  if (otp.attempts >= OTP_MAX_ATTEMPTS)
    return fail('OTP_LOCKED', 429, { message: 'Too many attempts. Please request a new code.' });

  if (!verifyOtpHash(String(code).trim(), otp.code_hash)) {
    await sb.from('otp_verifications').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    return fail('OTP_WRONG', 401, { message: 'Incorrect code. Please try again.' });
  }

  // Mark consumed (one-time use). We keep it consumed only after issuing the vote token,
  // but to prevent reuse we consume now and rely on the signed token for the cast step.
  await sb.from('otp_verifications').update({ consumed: true }).eq('id', otp.id);
  await logAudit({ action: 'OTP_VERIFIED', actor: 'member', details: otp.mobile, election_id: otp.election_id, ip });

  // Short-lived signed token authorizing exactly one cast for this member+election.
  const token = signVoteToken({ election_id: otp.election_id, member_id: otp.member_id });

  // Return the member's own details for the identity-confirmation screen.
  const { data: member } = await sb.from('members')
    .select('full_name, member_code, mobile, village, union_id, gender').eq('id', otp.member_id).maybeSingle();
  let union_name = null;
  if (member?.union_id) {
    const { data: u } = await sb.from('unions').select('union_name').eq('id', member.union_id).maybeSingle();
    union_name = u?.union_name || null;
  }
  return ok({
    vote_token: token,
    member: member ? {
      full_name: member.full_name, member_code: member.member_code,
      email: member.email, mobile: member.mobile,
      village: member.village, gender: member.gender, union_name,
    } : null,
  });
}
