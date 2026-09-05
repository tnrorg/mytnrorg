import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { purgePublic } from '@/lib/purgePublic';
import { ok, fail, readJson } from '@/lib/api';
import {
  CATEGORIES, ADMIN_STATUSES, APPLICATION_TYPES, publicStatus,
} from '@/lib/opportunities';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_opportunities_v2.sql.';

/* Admin management of opportunities.
 *
 * Reached under the `opportunities` permission area — see lib/adminScopes.js.
 * That area exists separately from "Website Content" because applications
 * carry an applicant's date of birth, contact details and address, and an
 * admin whose job is editing hero slides should not be handed that.
 */

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const status = (new URL(req.url).searchParams.get('status') || '').trim();

  const sb = supabaseAdmin();
  let q = sb.from('opportunities').select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (status && ADMIN_STATUSES.includes(status)) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return fail('READ_FAILED', 500, { message: 'Could not load opportunities.', hint: HINT });

  const rows = data || [];

  /* Application counts per opportunity, in one query rather than one per row.
   * Only the two columns needed to group — no applicant data is read here. */
  let stats = {};
  if (rows.length) {
    const { data: apps } = await sb.from('opportunity_applications')
      .select('opportunity_id, status').in('opportunity_id', rows.map(r => r.id));
    for (const a of (apps || [])) {
      const s = stats[a.opportunity_id] || (stats[a.opportunity_id] = { total: 0 });
      s.total += 1;
      s[a.status] = (s[a.status] || 0) + 1;
    }
  }

  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  return ok({
    opportunities: rows.map(o => ({ ...o, state: publicStatus(o), stats: stats[o.id] || { total: 0 } })),
    counts, categories: CATEGORIES,
  });
}

/** Create or update. `id` present means update. */
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const title = String(b.title || '').trim();
  if (!title) return fail('INVALID', 400, { errors: { title: 'A title is required.' } });

  const category = CATEGORIES.includes(b.category) ? b.category : 'Other';
  const applicationType = APPLICATION_TYPES.includes(b.application_type) ? b.application_type : 'none';

  if (applicationType === 'external' && !String(b.apply_url || '').trim())
    return fail('INVALID', 400, { errors: { apply_url: 'An official application URL is required.' } });
  if (category === 'Other' && !String(b.category_other || '').trim())
    return fail('INVALID', 400, { errors: { category_other: 'Name the category.' } });

  const patch = {
    // Public teaser
    title,
    category,
    category_other: category === 'Other' ? String(b.category_other || '').trim().slice(0, 60) : null,
    organization: String(b.organization || '').trim() || null,
    short_description: String(b.short_description || '').trim().slice(0, 300) || null,
    deadline: b.deadline || null,
    closes_at: normalizeStamp(b.closes_at),
    pinned: !!b.pinned,

    // Member-only
    full_description: txt(b.full_description),
    eligibility: txt(b.eligibility),
    benefits: txt(b.benefits),
    duration: txt(b.duration),
    location: txt(b.location),
    important_dates: txt(b.important_dates),
    instructions: txt(b.instructions),
    required_documents: txt(b.required_documents),
    terms: txt(b.terms),
    additional_info: txt(b.additional_info),

    application_type: applicationType,
    apply_url: applicationType === 'external' ? String(b.apply_url || '').trim() : null,

    updated_at: new Date().toISOString(),
  };

  // Cover image: uploaded only when new bytes arrive, so re-saving an existing
  // opportunity does not fill the bucket with copies of one picture.
  if (b.cover_data) {
    const head = String(b.cover_data).slice(0, 40);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(head))
      return fail('BAD_IMAGE', 400, { message: 'Cover must be a JPG, PNG or WEBP image.' });
    if (String(b.cover_data).length * 0.75 > 4 * 1024 * 1024)
      return fail('IMAGE_TOO_BIG', 400, { message: 'Cover image must be under 4 MB.' });
    try { patch.cover_url = await uploadDataUrl(b.cover_data, 'opportunities'); }
    catch { return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the cover image.' }); }
  } else if (b.cover_url !== undefined) {
    patch.cover_url = b.cover_url || null;
  }

  // Status transitions come from named actions, never from a free-form value.
  if (b.action === 'publish') { patch.status = 'published'; patch.published_at = new Date().toISOString(); }
  else if (b.action === 'unpublish') patch.status = 'draft';
  else if (b.action === 'close') patch.status = 'closed';
  else if (b.action === 'archive') patch.status = 'archived';

  let row;
  if (b.id) {
    const { data, error } = await sb.from('opportunities')
      .update(patch).eq('id', b.id).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message, hint: HINT });
    row = data;
  } else {
    patch.created_by = admin?.username || 'admin';
    if (!patch.status) patch.status = 'draft';
    const { data, error } = await sb.from('opportunities').insert(patch).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not create.', detail: error.message, hint: HINT });
    row = data;
  }

  await logAudit({
    action: b.action === 'publish' ? 'OPPORTUNITY_PUBLISHED' : (b.id ? 'OPPORTUNITY_UPDATED' : 'OPPORTUNITY_CREATED'),
    actor: admin?.username || 'admin',
    details: `${category}: ${title}`.slice(0, 200), ip: clientIp(req),
  });

  // See the note in lib/purgePublic.js.
  purgePublic('/opportunities');
  return ok({ opportunity: { ...row, state: publicStatus(row) } });
}

export async function DELETE(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing opportunity.' });

  const sb = supabaseAdmin();
  const { data: o } = await sb.from('opportunities').select('title').eq('id', id).maybeSingle();

  /* Refuse to delete an opportunity that people have applied to.
   *
   * The cascade would take their applications with it, and an applicant whose
   * submission disappears has no way to know what happened or to ask about it.
   * Archiving hides it from the site and keeps the record. */
  const { count } = await sb.from('opportunity_applications')
    .select('id', { count: 'exact', head: true }).eq('opportunity_id', id);
  if ((count || 0) > 0)
    return fail('HAS_APPLICATIONS', 409, {
      message: `${count} member(s) have applied to this. Archive it instead — deleting would erase their applications.`,
    });

  const { error } = await sb.from('opportunities').delete().eq('id', id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete.' });

  await logAudit({
    action: 'OPPORTUNITY_DELETED', actor: admin?.username || 'admin',
    details: o?.title || id, ip: clientIp(req),
  });
  purgePublic('/opportunities');
  return ok({ deleted: true });
}

const txt = (v) => (String(v ?? '').trim() || null);

/** A naive datetime-local string would be filed as UTC. Normalised here. */
function normalizeStamp(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
