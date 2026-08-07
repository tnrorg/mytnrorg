import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { normalizeEmail } from '@/lib/membership/core';

export const dynamic = 'force-dynamic';

// Public status check — reference number + email must BOTH match.
// Returns only non-sensitive fields.
export async function POST(req) {
  const b = await readJson(req);
  const ref = String(b.reference_no || '').trim().toUpperCase();
  const email = normalizeEmail(b.email);
  if (!ref || !email)
    return fail('INVALID', 400, { message: 'Enter both your reference number and email address.' });

  const { data } = await supabaseAdmin().from('membership_applications')
    .select('reference_no, created_at, status, admin_message, email_normalized')
    .eq('reference_no', ref).limit(1);
  const app = data && data[0];

  // Generic message — never confirm whether a reference or email exists alone.
  if (!app || app.email_normalized !== email)
    return fail('NOT_FOUND', 404, { message: 'No application found with those details.' });

  return ok({
    reference_no: app.reference_no,
    submitted_at: app.created_at,
    status: app.status,
    admin_message: app.admin_message || null,
  });
}
