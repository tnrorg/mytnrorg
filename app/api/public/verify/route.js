import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { findForVerification, publicView } from '@/lib/membership/verify';

export const dynamic = 'force-dynamic';

// Simple in-memory rate limit — blunts casual scraping of the ID space.
const hits = new Map();
const LIMIT = 20, WINDOW = 60_000;
function limited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > WINDOW) { rec.n = 0; rec.t = now; }
  rec.n += 1; hits.set(ip, rec);
  return rec.n > LIMIT;
}

export async function GET(req) {
  const url = new URL(req.url);
  const lookup = url.searchParams.get('id') || '';
  const ip = clientIp(req);

  if (limited(ip))
    return fail('RATE_LIMIT', 429, { message: 'Too many verification attempts. Please wait a minute and try again.' });
  if (!lookup.trim())
    return fail('INVALID', 400, { message: 'Enter a Membership ID or certificate number.' });

  const hit = await findForVerification(lookup);
  supabaseAdmin().from('certificate_verifications')
    .insert({ lookup: lookup.slice(0, 60), found: !!hit, ip }).then(() => {}, () => {});

  if (!hit) return ok({ found: false, state: 'Not Found' });

  // Attach the category name (never the raw id).
  let category_name = null;
  if (hit.member.category_id) {
    const { data: cat } = await supabaseAdmin().from('membership_categories')
      .select('name').eq('id', hit.member.category_id).maybeSingle();
    category_name = cat?.name || null;
  }
  return ok(publicView({ ...hit.member, category_name }, hit.cert));
}
