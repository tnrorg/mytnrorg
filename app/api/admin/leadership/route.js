import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BODIES = ['advisory', 'executive'];
const slugify = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);
const toArray = (v) => Array.isArray(v)
  ? v.map(x => String(x).trim()).filter(Boolean)
  : String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const body = new URL(req.url).searchParams.get('body');
  let q = supabaseAdmin().from('leadership_profiles').select('*').order('body').order('sort_order').order('created_at');
  if (BODIES.includes(body)) q = q.eq('body', body);
  const { data, error } = await q;
  if (error) return fail('READ_FAILED', 500, { message: error.message });
  return ok({ profiles: data || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!BODIES.includes(b.body)) return fail('BAD_BODY', 400, { message: 'Choose Advisory Council or Executive Committee.' });
  if (!b.name && !b.designation) return fail('MISSING', 400, { message: 'Enter a name or a designation.' });

  let photo_url = b.photo_url || null;
  if (b.photo_data) {
    try { photo_url = await uploadDataUrl(b.photo_data, 'leadership'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Photo upload failed: ' + e.message }); }
  }

  const row = {
    body: b.body,
    slug: slugify(b.slug || b.name || b.designation),
    name: b.name || null, designation: b.designation || null,
    qualification: b.qualification || null, field: b.field || null,
    affiliation: b.affiliation || null, summary: b.summary || null,
    expertise: toArray(b.expertise), duties: toArray(b.duties),
    photo_url, sort_order: Number(b.sort_order) || 0, active: b.active !== false,
    // ── Professional profile portal fields ──
    country: b.country || null, profession: b.profession || null,
    organisation: b.organisation || null, tagline: b.tagline || null,
    intro: b.intro || null, bio: b.bio || null,
    email: b.email || null, mobile: b.mobile || null,
    // Contact stays private unless explicitly published.
    show_email: b.show_email === true, show_mobile: b.show_mobile === true,
    verified: b.verified === true,
    accepts_guidance: b.accepts_guidance !== false,
    skills: toArray(b.skills), research_areas: toArray(b.research_areas),
    cv_url: b.cv_url || null, cv_approved: b.cv_approved === true,
  };
  const { data, error } = await supabaseAdmin().from('leadership_profiles').insert(row).select().maybeSingle();
  if (error) {
    if (String(error.message).includes('uq_leadership_body_slug'))
      return fail('DUPLICATE', 400, { message: 'A profile with this URL name already exists in that body.' });
    return fail('INSERT_FAILED', 500, { message: error.message });
  }
  await logAudit({ action: 'LEADERSHIP_ADDED', actor: admin.username, details: `${row.body}: ${row.name || row.designation}`, ip: clientIp(req) });
  return ok({ profile: data });
}
