import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember, hashPassword, verifyPassword } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Members may change: password, public visibility, WhatsApp preference.
// They may NEVER change membership_id or status.
export async function PATCH(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();
  const patch = { updated_at: new Date().toISOString() };

  // Members no longer control this. Directory visibility is a TNR-wide policy
  // decision, not a per-member preference — and the setting silently kept the
  // whole directory empty because nobody knew it was there. An admin can still
  // hide an individual member if there is a reason to.
  if (b.whatsapp_opt_in !== undefined) patch.whatsapp_opt_in = !!b.whatsapp_opt_in;

  if (b.new_password) {
    if (String(b.new_password).length < 8)
      return fail('WEAK', 400, { message: 'Password must be at least 8 characters.' });
    if (!(await verifyPassword(String(b.current_password || ''), member.password_hash)))
      return fail('BAD_PASSWORD', 403, { message: 'Your current password is incorrect.' });
    patch.password_hash = await hashPassword(String(b.new_password));
    patch.session_epoch = (member.session_epoch || 0) + 1;   // sign out other devices
  }

  await sb.from('membership_members').update(patch).eq('id', member.id);
  return ok({ saved: true, password_changed: !!b.new_password });
}

// Secure WhatsApp link — only for approved members who opted in.
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  if (!member.whatsapp_opt_in)
    return ok({ whatsapp_link: null, reason: 'You have not opted in to the WhatsApp group.' });
  const { data } = await supabaseAdmin().from('membership_settings')
    .select('value').eq('key', 'whatsapp_group_link').maybeSingle();
  const link = (data?.value || '').trim();
  return ok({ whatsapp_link: link || null, reason: link ? null : 'The group link has not been configured yet.' });
}
