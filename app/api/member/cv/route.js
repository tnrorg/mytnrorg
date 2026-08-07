import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { buildCvContent } from '@/lib/membership/cv';
import { SECTIONS } from '@/lib/membership/profile';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const { data } = await supabaseAdmin().from('cv_documents')
    .select('id, title, template, is_default, updated_at')
    .eq('member_id', member.id).order('updated_at', { ascending: false });
  return ok({ cvs: data || [] });
}

// POST — create a CV, optionally seeded from the member's profile.
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);

  let content = b.content || null;
  if (!content) {
    // Snapshot the live profile so editing the CV never alters the profile.
    const [{ data: profile }, ...secs] = await Promise.all([
      sb.from('member_profiles').select('*').eq('member_id', member.id).maybeSingle(),
      ...Object.values(SECTIONS).map(s =>
        sb.from(s.table).select('*').eq('member_id', member.id).order('sort_order')),
    ]);
    const bundle = { core: member, profile: profile || {} };
    Object.keys(SECTIONS).forEach((k, i) => { bundle[k] = secs[i].data || []; });
    content = buildCvContent(bundle);
  }

  const { data, error } = await sb.from('cv_documents').insert({
    member_id: member.id,
    title: String(b.title || 'My CV').slice(0, 120),
    template: b.template || 'modern',
    content,
  }).select('*').single();
  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not create the CV.', detail: error.message });
  return ok({ cv: data });
}
