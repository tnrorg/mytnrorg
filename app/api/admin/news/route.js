import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { purgePublic } from '@/lib/purgePublic';
import { ok, fail, readJson } from '@/lib/api';
import { validateNews, makeSlug, CATEGORIES, LIMITS } from '@/lib/news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FIELDS =
  'id, title, summary, body, cover_url, category, slug, status, pinned, ' +
  'publish_at, expires_at, views, author_name, created_by, created_at, updated_at';

const MIGRATION_HINT = 'Administrator: run supabase/migration_news.sql.';

/* A timestamp we are willing to store.
 *
 * Returns null for anything empty or unparseable, and a full ISO string
 * otherwise. A bare "2026-08-17T20:00" carries no timezone, so Postgres would
 * read it as UTC — which is how a post published from Pakistan ended up
 * scheduled five hours into its own future and vanished from the site. */
function normalizeStamp(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const status = (new URL(req.url).searchParams.get('status') || '').trim();

  let q = supabaseAdmin().from('news_posts').select(FIELDS)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return fail('READ_FAILED', 500, { message: 'Could not load news.', hint: MIGRATION_HINT });

  const counts = {};
  for (const p of (data || [])) counts[p.status] = (counts[p.status] || 0) + 1;
  return ok({ posts: data || [], counts, categories: CATEGORIES });
}

/** Create or update. `id` present means update. */
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const publishing = b.action === 'publish';
  const errors = validateNews(b, { publishing });
  if (Object.keys(errors).length)
    return fail('INVALID', 400, { errors, message: 'Please check the highlighted fields.' });

  const patch = {
    title: String(b.title || '').trim().slice(0, LIMITS.title),
    summary: String(b.summary || '').trim().slice(0, LIMITS.summary),
    body: String(b.body || '').trim().slice(0, LIMITS.body),
    category: CATEGORIES.includes(b.category) ? b.category : 'News',
    pinned: !!b.pinned,
    // Normalised, so a value without a timezone can never be filed as UTC and
    // silently push a post hours into the future. The editor already sends
    // proper ISO; this catches anything that does not.
    publish_at: normalizeStamp(b.publish_at),
    expires_at: normalizeStamp(b.expires_at),
    author_name: String(b.author_name || '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  /* Cover image.
   *
   * Uploaded only when a NEW one arrives as a data URL. An existing post being
   * edited sends back its cover_url unchanged, and re-uploading the same bytes
   * on every save would fill the bucket with duplicates of one picture. */
  if (b.cover_data) {
    const head = String(b.cover_data).slice(0, 40);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(head))
      return fail('BAD_IMAGE', 400, { message: 'Cover must be a JPG, PNG or WEBP image.' });
    if (String(b.cover_data).length * 0.75 > 4 * 1024 * 1024)
      return fail('IMAGE_TOO_BIG', 400, { message: 'Cover image must be smaller than 4 MB.' });
    try { patch.cover_url = await uploadDataUrl(b.cover_data, 'news'); }
    catch { return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the cover image.' }); }
  } else if (b.cover_url !== undefined) {
    patch.cover_url = b.cover_url || null;      // allows clearing it
  }

  let row;
  if (b.id) {
    const { data: existing } = await sb.from('news_posts')
      .select('id, slug, status').eq('id', b.id).maybeSingle();
    if (!existing) return fail('NOT_FOUND', 404, { message: 'That post no longer exists.' });

    if (publishing) {
      patch.status = 'published';
      // Slug is claimed once and never regenerated — see the migration.
      if (!existing.slug) patch.slug = makeSlug(patch.title, existing.id);
      if (!patch.publish_at) patch.publish_at = new Date().toISOString();
    } else if (b.action === 'unpublish') {
      patch.status = 'draft';
    }

    const { data, error } = await sb.from('news_posts')
      .update(patch).eq('id', b.id).select(FIELDS).single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });
    row = data;
  } else {
    patch.created_by = admin?.username || 'admin';
    patch.status = publishing ? 'published' : 'draft';
    const { data: seed, error: insErr } = await sb.from('news_posts')
      .insert(patch).select('id').single();
    if (insErr) return fail('SAVE_FAILED', 500, {
      message: /news_posts/i.test(insErr.message || '') ? MIGRATION_HINT : 'Could not save.',
      detail: insErr.message,
    });

    // The slug needs the row id to stay unique, so it is set straight after
    // the insert rather than guessed before it.
    const after = {};
    if (publishing) {
      after.slug = makeSlug(patch.title, seed.id);
      if (!patch.publish_at) after.publish_at = new Date().toISOString();
    }
    const { data } = Object.keys(after).length
      ? await sb.from('news_posts').update(after).eq('id', seed.id).select(FIELDS).single()
      : await sb.from('news_posts').select(FIELDS).eq('id', seed.id).single();
    row = data;
  }

  await logAudit({
    action: publishing ? 'NEWS_PUBLISHED' : (b.id ? 'NEWS_UPDATED' : 'NEWS_CREATED'),
    actor: admin?.username || 'admin',
    details: `${patch.category}: ${patch.title}`.slice(0, 200),
    ip: clientIp(req),
  });

  // The home page holds a cached copy for up to 60 seconds. Drop it now
  // so an admin who saves and switches tab sees their own change.
  purgePublic('/media/news');
  return ok({ post: row });
}

export async function DELETE(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing post.' });

  const sb = supabaseAdmin();
  const { data: p } = await sb.from('news_posts').select('title, status').eq('id', id).maybeSingle();

  const { error } = await sb.from('news_posts').delete().eq('id', id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete that post.' });

  await logAudit({
    action: 'NEWS_DELETED', actor: admin?.username || 'admin',
    details: `${p?.status || ''} — ${p?.title || id}`.slice(0, 200), ip: clientIp(req),
  });
  purgePublic('/media/news');
  return ok({ deleted: true });
}
