/* Row builders for Executive Committee recruitment.
 *
 * Outside the route files because Next.js only allows HTTP method and config
 * exports from a route module.
 */
import { APP_STATUS_LABEL } from './cec';

const VACANCY_TEXT = ['title', 'summary', 'scenario_question', 'eligibility_note'];
const VACANCY_LISTS = ['responsibilities', 'requirements'];
const VACANCY_STATUS = ['draft', 'open', 'closed'];

/** Textarea → array, one entry per line. */
const lines = (v) => Array.isArray(v)
  ? v.map(x => String(x).trim()).filter(Boolean)
  : String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

const asDate = (v) => {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export function vacancyFromBody(b, { partial = false } = {}) {
  const row = {};
  for (const f of VACANCY_TEXT)  if (!partial || f in b) row[f] = String(b[f] ?? '').trim();
  for (const f of VACANCY_LISTS) if (!partial || f in b) row[f] = lines(b[f]);
  if (!partial || 'seats' in b)      row.seats = Math.max(1, Math.round(Number(b.seats) || 1));
  if (!partial || 'sort_order' in b) row.sort_order = Number(b.sort_order) || 0;
  if (!partial || 'closes_on' in b)  row.closes_on = asDate(b.closes_on);
  if (!partial || 'status' in b) {
    row.status = VACANCY_STATUS.includes(b.status) ? b.status : 'open';
  }
  if (partial) row.updated_at = new Date().toISOString();
  return row;
}

/**
 * Review fields only.
 *
 * An admin may change the STATUS and the NOTES of an application — never the
 * answers. What the applicant wrote is the record being judged, and a panel
 * that can quietly edit it is not a fair process.
 */
export function reviewFromBody(b, actor) {
  const row = { updated_at: new Date().toISOString() };
  if ('status' in b && APP_STATUS_LABEL[b.status]) {
    row.status = b.status;
    row.reviewed_by = actor || '';
    row.reviewed_at = new Date().toISOString();
  }
  if ('admin_notes' in b) row.admin_notes = String(b.admin_notes ?? '').trim();
  if ('interview_on' in b) {
    const s = String(b.interview_on ?? '').trim();
    row.interview_on = s ? new Date(s).toISOString() : null;
  }
  return row;
}
