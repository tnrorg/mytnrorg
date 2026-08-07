import { STATUS_LABEL } from './projects';
import { cleanGallery } from './gallery';

/* Turns a request body into a tnr_projects row.
 *
 * Kept out of the route files because Next.js only permits HTTP method and
 * config exports from a route module — sharing this between the create and
 * update routes has to happen here.
 */

const TEXT = [
  'title', 'scheme_no', 'department', 'contractor', 'category',
  'union_council', 'village', 'summary', 'source',
];
const INTS = ['beneficiaries', 'sort_order'];
const MONEY = ['approved_cost', 'released_funds', 'utilised_funds'];
const DATES = ['approved_date', 'start_date', 'target_date', 'completion_date', 'last_verified'];

/** '' → null. A date column will not take an empty string. */
const asDate = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Strips commas, spaces and currency symbols people paste in from documents. */
const asMoney = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};

export function projectFromBody(b, { partial = false } = {}) {
  const row = {};
  // Gallery arrives as a list of already-uploaded URLs; new files come in
  // separately as data URLs and are uploaded by the route before this runs.
  if (!partial || 'gallery' in b) row.gallery = cleanGallery(b.gallery);
  for (const f of TEXT)  if (!partial || f in b) row[f] = String(b[f] ?? '').trim();
  for (const f of INTS)  if (!partial || f in b) row[f] = Math.max(0, Math.round(Number(b[f]) || 0));
  for (const f of MONEY) if (!partial || f in b) row[f] = asMoney(b[f]);
  for (const f of DATES) if (!partial || f in b) row[f] = asDate(b[f]);

  if (!partial || 'status' in b) row.status = STATUS_LABEL[b.status] ? b.status : 'pending_approval';
  if (!partial || 'published' in b) row.published = b.published !== false;

  if (!partial || 'progress_percent' in b) {
    row.progress_percent = Math.min(100, Math.max(0, Math.round(Number(b.progress_percent) || 0)));
  }
  if (!partial || 'year' in b) {
    const y = Number(b.year);
    // Null rather than 0 for a blank year — 0 would sort ahead of every real one.
    row.year = Number.isFinite(y) && y >= 1990 && y <= 2100 ? Math.round(y) : null;
  }
  return row;
}

const SETTING_FIELDS = [
  'page_title', 'page_intro', 'representative_name', 'representative_title',
  'constituency', 'currency', 'source_note',
];

export function settingsFromBody(b) {
  const row = { id: 1, updated_at: new Date().toISOString() };
  for (const f of SETTING_FIELDS) if (f in b) row[f] = String(b[f] ?? '').trim();
  if (row.currency === '') row.currency = 'PKR';
  return row;
}
