import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// The member's own record.
// Re-reads the row explicitly so the response can never be a stale copy,
// and returns an explicit field list (never password hashes or invite tokens).
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  const { data: fresh } = await supabaseAdmin()
    .from('membership_members')
    .select(`id, membership_id, first_name, last_name, full_name, gender, photo_url,
             email, mobile, village, union_council, category_id, education_level,
             field_of_study, current_position, contribution_areas, status,
             public_visible, whatsapp_opt_in, approved_at, issued_at, expires_at,
             role, leadership_profile_id, created_at, updated_at`)
    .eq('id', member.id)
    .maybeSingle();

  return ok({ member: fresh || member });
}
