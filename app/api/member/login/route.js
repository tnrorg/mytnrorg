import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { normalizeEmail } from '@/lib/membership/core';
import { verifyPassword, signMemberToken, canLogin } from '@/lib/membership/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const b = await readJson(req);
  const email = normalizeEmail(b.email);
  const password = String(b.password || '');
  if (!email || !password) return fail('INVALID', 400, { message: 'Enter your email and password.' });

  const { data: rows } = await supabaseAdmin().from('membership_members')
    .select('*').eq('email_normalized', email).is('deleted_at', null).limit(1);
  const m = rows && rows[0];

  // Generic message — never reveal whether an email exists.
  const BAD = fail('BAD_CREDENTIALS', 401, { message: 'Invalid email or password.' });
  if (!m || !m.password_hash) return BAD;
  if (!(await verifyPassword(password, m.password_hash))) return BAD;

  if (!canLogin(m.status))
    return fail('ACCOUNT_BLOCKED', 403, {
      message: 'Your membership is not currently active. Please contact the membership committee.' });

  await supabaseAdmin().from('membership_members')
    .update({ last_login_at: new Date().toISOString() }).eq('id', m.id);

  return ok({
    token: signMemberToken(m),
    member: { membership_id: m.membership_id, full_name: m.full_name, photo_url: m.photo_url },
  });
}
