import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { logAudit, clientIp } from '@/lib/audit';
import { signPrivatePath, SIGNED_URL_TTL } from '@/lib/privateStorage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Mint short-lived links to an applicant's CNIC images.
 *
 *   GET /api/admin/membership/cnic?application_id=…
 *   GET /api/admin/membership/cnic?member_id=…
 *
 * The stored value is a path inside a private bucket, never a URL, so a link
 * only exists for as long as this endpoint says it does. Every view is written
 * to the audit log — looking at someone's identity document should leave a
 * trace, and it deters casual browsing of members' ID cards.
 */
export async function GET(req) {
  const { admin, res } = await requireAdmin(req);
  if (res) return res;

  const url = new URL(req.url);
  const applicationId = url.searchParams.get('application_id');
  const memberId = url.searchParams.get('member_id');
  if (!applicationId && !memberId)
    return fail('MISSING', 400, { message: 'application_id or member_id is required.' });

  const sb = supabaseAdmin();
  const table = applicationId ? 'membership_applications' : 'membership_members';
  const id = applicationId || memberId;

  const { data, error } = await sb
    .from(table)
    .select('cnic_number, cnic_front_path, cnic_back_path')
    .eq('id', id)
    .maybeSingle();

  if (error) return fail('READ_FAILED', 500, {
    message: error.message,
    hint: 'If this mentions a missing column, run supabase/migration_cnic_and_password.sql.',
  });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Record not found.' });

  const [front, back] = await Promise.all([
    signPrivatePath(data.cnic_front_path),
    signPrivatePath(data.cnic_back_path),
  ]);

  await logAudit({
    action: 'CNIC_VIEWED',
    actor: admin?.username || 'admin',
    details: `${table}:${id}`,
    ip: clientIp(req),
  });

  return ok({
    cnic_number: data.cnic_number || null,
    front, back,
    expires_in: SIGNED_URL_TTL,
    // Tell the client what is missing rather than silently returning nulls.
    missing: [
      !data.cnic_front_path && 'front',
      !data.cnic_back_path && 'back',
    ].filter(Boolean),
  });
}
