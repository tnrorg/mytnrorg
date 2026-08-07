import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { hashPassword, signMemberToken, canLogin } from '@/lib/membership/auth';

export const dynamic = 'force-dynamic';

// GET ?token= → validate an invite/reset link before showing the form.
export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!token) return fail('INVALID', 400, { message: 'Invalid link.' });
  const { data: rows } = await supabaseAdmin().from('membership_members')
    .select('id, first_name, email, invite_expires_at, status').eq('invite_token', token).limit(1);
  const m = rows && rows[0];
  if (!m) return fail('INVALID_TOKEN', 400, { message: 'This link is invalid or has already been used.' });
  if (m.invite_expires_at && new Date(m.invite_expires_at) < new Date())
    return fail('EXPIRED', 400, { message: 'This link has expired. Please request a new one.' });
  return ok({ first_name: m.first_name, email: m.email });
}

// POST { token, password } → set password, consume token, sign in.
export async function POST(req) {
  const b = await readJson(req);
  const token = String(b.token || '');
  const password = String(b.password || '');
  if (password.length < 8) return fail('WEAK', 400, { message: 'Password must be at least 8 characters.' });

  const sb = supabaseAdmin();
  const { data: rows } = await sb.from('membership_members').select('*').eq('invite_token', token).limit(1);
  const m = rows && rows[0];
  if (!m) return fail('INVALID_TOKEN', 400, { message: 'This link is invalid or has already been used.' });
  if (m.invite_expires_at && new Date(m.invite_expires_at) < new Date())
    return fail('EXPIRED', 400, { message: 'This link has expired. Please request a new one.' });
  if (!canLogin(m.status))
    return fail('ACCOUNT_BLOCKED', 403, { message: 'Your membership is not currently active.' });

  const now = new Date().toISOString();
  const { data: updated } = await sb.from('membership_members').update({
    password_hash: await hashPassword(password),
    invite_token: null, invite_expires_at: null,
    password_set_at: now, last_login_at: now,
    session_epoch: (m.session_epoch || 0) + 1,     // invalidate any older sessions
    updated_at: now,
  }).eq('id', m.id).select('*').single();

  return ok({
    token: signMemberToken(updated),
    member: { membership_id: updated.membership_id, full_name: updated.full_name },
  });
}
