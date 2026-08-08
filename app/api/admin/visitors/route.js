import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Profile-visit log. Super Admin only — this shows one member's browsing
 * behaviour to an administrator, which is not something a normal admin
 * account should be able to open.
 *
 *   ?profile=TNR-MN-0001   visits to one profile (default: all)
 *   ?days=30               window
 */
export async function GET(req) {
  const { res } = requireSuperAdmin(req);
  if (res) return res;

  const url = new URL(req.url);
  const profile = (url.searchParams.get('profile') || '').trim().toUpperCase();
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const sb = supabaseAdmin();

  let q = sb.from('profile_views')
    .select('id, viewed_membership_id, viewer_membership_id, seconds, started_at')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(500);
  if (profile) q = q.eq('viewed_membership_id', profile);

  const { data: rows, error } = await q;
  if (error) return fail('READ_FAILED', 500, {
    message: error.message,
    hint: 'Run supabase/migration_profile_views.sql',
  });

  // Resolve names and photos in one round trip rather than per row.
  const ids = [...new Set(
    (rows || []).flatMap(r => [r.viewed_membership_id, r.viewer_membership_id]).filter(Boolean)
  )];
  const people = new Map();
  if (ids.length) {
    const { data: ms } = await sb.from('membership_members')
      .select('membership_id, full_name, photo_url, gender, village, union_council')
      .in('membership_id', ids);
    for (const m of ms || []) people.set(m.membership_id, m);
  }

  const visits = (rows || []).map(r => ({
    id: r.id,
    at: r.started_at,
    seconds: r.seconds,
    profile: {
      membership_id: r.viewed_membership_id,
      ...(people.get(r.viewed_membership_id) || {}),
    },
    viewer: r.viewer_membership_id
      ? { membership_id: r.viewer_membership_id, ...(people.get(r.viewer_membership_id) || {}) }
      : null,      // signed-out visitor
  }));

  // Per-profile totals for the summary table.
  const byProfile = new Map();
  for (const v of visits) {
    const k = v.profile.membership_id;
    const cur = byProfile.get(k) || {
      membership_id: k,
      full_name: v.profile.full_name || null,
      photo_url: v.profile.photo_url || null,
      gender: v.profile.gender || null,
      views: 0, seconds: 0, identified: 0,
    };
    cur.views += 1;
    cur.seconds += v.seconds;
    if (v.viewer) cur.identified += 1;
    byProfile.set(k, cur);
  }

  const summary = [...byProfile.values()]
    .map(p => ({ ...p, avg: p.views ? Math.round(p.seconds / p.views) : 0 }))
    .sort((a, b) => b.views - a.views);

  return ok({
    visits,
    summary,
    days,
    totals: {
      views: visits.length,
      identified: visits.filter(v => v.viewer).length,
      seconds: visits.reduce((n, v) => n + v.seconds, 0),
    },
  });
}
