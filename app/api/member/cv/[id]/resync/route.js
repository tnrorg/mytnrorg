import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { SECTIONS } from '@/lib/membership/profile';
import { buildCvContent } from '@/lib/membership/cv';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Pull the member's current profile back into an existing CV.
 *
 * A CV is a snapshot taken when it was created, so editing it never disturbs
 * the profile. The cost of that design is staleness: anything added to the
 * profile afterwards — a new job, a certificate — is missing, and the section
 * appears empty even with its checkbox ticked. This is the way back.
 *
 * Hand-typed edits to the header are preserved: someone who changed their CV
 * headline to suit an application should not lose it because they added a
 * language to their profile.
 */
const KEEP = ['full_name', 'headline', 'email', 'phone', 'location',
              'linkedin', 'portfolio', 'github', 'summary'];

export async function POST(req, props) {
  const params = await props.params;
  const { member, res } = await requireMember(req);if (res) return res;
  const sb = supabaseAdmin();

  const { data: cv } = await sb.from('cv_documents')
    .select('*').eq('id', params.id).eq('member_id', member.id).maybeSingle();
  if (!cv) return fail('NOT_FOUND', 404, { message: 'CV not found.' });

  try {
    const [{ data: profile }, ...secs] = await Promise.all([
      sb.from('member_profiles').select('*').eq('member_id', member.id).maybeSingle(),
      ...Object.values(SECTIONS).map(s =>
        sb.from(s.table).select('*').eq('member_id', member.id).order('sort_order')),
    ]);
    const bundle = { core: member, profile: profile || {} };
    Object.keys(SECTIONS).forEach((k, i) => { bundle[k] = secs[i].data || []; });

    const fresh = buildCvContent(bundle);
    const old = cv.content || {};

    // Keep whatever the member typed into the header of this CV; refresh every
    // list from the profile.
    const merged = { ...fresh };
    for (const k of KEEP) {
      if (old[k] && String(old[k]).trim()) merged[k] = old[k];
    }

    const { data, error } = await sb.from('cv_documents')
      .update({ content: merged, updated_at: new Date().toISOString() })
      .eq('id', params.id).eq('member_id', member.id)
      .select('*').single();
    if (error) return fail('SYNC_FAILED', 500, { message: error.message });

    // Report what arrived so the UI can say something specific rather than
    // "done" when nothing actually changed.
    const counts = {};
    for (const k of ['experience', 'education', 'skills', 'projects',
                     'certifications', 'languages', 'volunteer']) {
      counts[k] = (merged[k] || []).length;
    }

    return ok({ cv: data, counts });
  } catch (e) {
    return fail('SYNC_FAILED', 500, { message: e.message });
  }
}
