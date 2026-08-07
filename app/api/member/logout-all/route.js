import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Bumping session_epoch invalidates every issued token for this member.
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  await supabaseAdmin().from('membership_members')
    .update({ session_epoch: (member.session_epoch || 0) + 1 }).eq('id', member.id);
  return ok({ logged_out: true });
}
