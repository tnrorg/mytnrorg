import { supabaseAdmin } from '@/lib/supabaseServer';
import { loadAllDocuments } from './providers';
import { buildIndex, searchIndex } from './engine';

/* ── Search index — SERVER ONLY ──────────────────────────────────────────────
 *
 * The public documents are loaded once, prepared, and kept in memory for
 * INDEX_TTL. Searching is then pure in-memory work: typing a query does not
 * touch the database at all, which is what keeps suggestions instant and keeps
 * a visitor's keystrokes from becoming ten queries each.
 *
 * FRESHNESS. The index is rebuilt from the live tables at most every
 * INDEX_TTL, by re-reading them — there is no separate copy to keep in sync
 * and no trigger to forget. So within one minute of content being published,
 * edited, unpublished, deleted or hidden, search reflects it. That minute is
 * the trade: a member hidden by an admin can still appear by NAME in search
 * for up to 60 seconds, though their profile page refuses to open at once.
 *
 * SCALE. Right for a community site — thousands of members, hundreds of
 * articles; a query over 10,000 documents is a few milliseconds. If TNR ever
 * outgrows that, the providers can feed a Postgres full-text table instead and
 * nothing above this file needs to change.
 */

export const INDEX_TTL = 60_000;

let cache = null;        // { index, builtAt, health, size }
let building = null;     // de-duplicates concurrent rebuilds

async function rebuild() {
  const started = Date.now();
  const { docs, health } = await loadAllDocuments(supabaseAdmin());
  cache = { index: buildIndex(docs), builtAt: Date.now(), health, size: docs.length, buildMs: Date.now() - started };
  return cache;
}

export async function getIndex() {
  if (cache && Date.now() - cache.builtAt < INDEX_TTL) return cache;
  if (!building) building = rebuild().finally(() => { building = null; });
  try { return await building; }
  catch (e) {
    /* A failed rebuild serves the previous index rather than an error — but
       never one older than five minutes, so stale visibility cannot linger. */
    if (cache && Date.now() - cache.builtAt < 5 * INDEX_TTL) return cache;
    throw e;
  }
}

/** Run a search. Returns the engine result plus timing. */
export async function search(query, opts) {
  const t0 = Date.now();
  const c = await getIndex();
  const out = searchIndex(c.index, query, opts);
  return { ...out, took_ms: Date.now() - t0, index_size: c.size };
}
