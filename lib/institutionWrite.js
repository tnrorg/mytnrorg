import { KIND_LABEL, LEVEL_LABEL, SERVES_LABEL, SECTOR_LABEL } from './institutions';
import { cleanGallery } from './gallery';

/* Builds a tnr_institutions row from a request body.
 *
 * Outside the route files because Next.js only allows HTTP method and config
 * exports from a route module.
 */

const TEXT = [
  'name', 'union_council', 'village', 'head_teacher', 'contact',
  'notes', 'source', 'fee_note', 'elsewhere_note',
];
const INTS = [
  'sanctioned_posts', 'posted_here', 'serving_here', 'serving_elsewhere',
  'attached_in', 'teachers_needed', 'community_teachers',
  'students_total', 'students_boys', 'students_girls', 'sort_order',
];

const ENUMS = {
  kind:   [KIND_LABEL,   'school'],
  level:  [LEVEL_LABEL,  'primary'],
  serves: [SERVES_LABEL, 'co_ed'],
  sector: [SECTOR_LABEL, 'government'],
};

const asDate = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Tolerates "1,500" and "Rs 300" pasted from a document. */
const asMoney = (v) => {
  const x = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0;
};

export function institutionFromBody(b, { partial = false } = {}) {
  const row = {};
  if (!partial || 'gallery' in b) row.gallery = cleanGallery(b.gallery);
  for (const f of TEXT) if (!partial || f in b) row[f] = String(b[f] ?? '').trim();
  for (const f of INTS) if (!partial || f in b) row[f] = Math.max(0, Math.round(Number(b[f]) || 0));

  for (const [field, [labels, fallback]] of Object.entries(ENUMS)) {
    if (!partial || field in b) row[field] = labels[b[field]] ? b[field] : fallback;
  }

  if (!partial || 'community_fee_monthly' in b) row.community_fee_monthly = asMoney(b.community_fee_monthly);
  if (!partial || 'last_verified' in b) row.last_verified = asDate(b.last_verified);
  if (!partial || 'published' in b) row.published = b.published !== false;

  return row;
}
