import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Diagnostic endpoint — visit /api/public/health on the deployed site.
// Reports env-var presence, DB connectivity, and row counts per table.
// Never leaks secret values (only masked previews).
const TABLES = [
  'organizations',
  'admin_users',
  'unions',
  'elections',
  'positions',
  'candidates',
  'members',
  'leadership_profiles',
  'projects',
  'institutions',
  'hero_slides',
];

function mask(v) {
  if (!v) return null;
  return `${v.slice(0, 6)}…${v.slice(-4)} (len ${v.length})`;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: url || '❌ MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? mask(anon) : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: svc ? mask(svc) : '❌ MISSING',
    urlLooksWrong: url ? /\/rest\/v1\/?$/.test(url) : null,
  };

  if (!url || !svc) {
    return Response.json(
      { ok: false, reason: 'Supabase env vars missing on this deployment', env },
      { status: 200 }
    );
  }

  let sb;
  try {
    sb = createClient(url, svc, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (e) {
    return Response.json({ ok: false, reason: 'createClient failed', error: e.message, env });
  }

  const tables = {};
  for (const t of TABLES) {
    try {
      const { count, error } = await sb
        .from(t)
        .select('*', { count: 'exact', head: true });
      tables[t] = error ? `❌ ${error.message}` : count;
    } catch (e) {
      tables[t] = `❌ ${e.message}`;
    }
  }

  const missing = Object.entries(tables).filter(([, v]) => typeof v === 'string');
  const empty = Object.entries(tables).filter(([, v]) => v === 0);

  return Response.json({
    ok: missing.length === 0,
    env,
    tables,
    summary: {
      tablesWithErrors: missing.map(([k]) => k),
      emptyTables: empty.map(([k]) => k),
      hint:
        missing.length > 0
          ? 'Tables are missing or the key is wrong — re-run schema.sql / check SERVICE_ROLE key.'
          : empty.length === Object.keys(tables).length
          ? 'Schema exists but the database is completely empty — data was never migrated from the old Supabase project.'
          : empty.length > 0
          ? 'Schema is fine; some tables have no rows yet.'
          : 'Database looks healthy — the problem is elsewhere (caching, RLS, or the page code).',
    },
  });
}
