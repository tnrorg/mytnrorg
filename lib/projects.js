/* Shared vocabulary and roll-ups for the development projects tracker.
 *
 * These are government schemes in the constituency, published so residents can
 * see what has been sanctioned for their area — approval stage, cost, start
 * date and progress, broken down by Union Council and village.
 */

// Order matters: this is the pipeline a scheme moves through, and the public
// page shows the stages in this sequence rather than by size.
export const PROJECT_STATUSES = [
  ['proposed',         'Proposed'],
  ['pending_approval', 'Pending Approval'],
  ['approved',         'Approved'],
  ['ongoing',          'Ongoing'],
  ['completed',        'Completed'],
  ['on_hold',          'On Hold'],
  ['dropped',          'Dropped'],
];

export const STATUS_LABEL = Object.fromEntries(PROJECT_STATUSES);
export const STATUS_KEYS = PROJECT_STATUSES.map(([k]) => k);

/** Tailwind-free colour per stage, used for chips and the pipeline bar. */
export const STATUS_TONE = {
  proposed:         { bg: 'rgba(100,113,105,.12)', fg: '#4A554E' },
  pending_approval: { bg: 'rgba(200,154,43,.16)',  fg: '#7A5C10' },
  approved:         { bg: 'rgba(23,107,73,.12)',   fg: '#0F5138' },
  ongoing:          { bg: 'rgba(30,122,182,.12)',  fg: '#155E8A' },
  completed:        { bg: 'rgba(16,140,90,.16)',   fg: '#0A5B3A' },
  on_hold:          { bg: 'rgba(180,120,20,.14)',  fg: '#8A5D0A' },
  dropped:          { bg: 'rgba(170,60,60,.12)',   fg: '#8A2F2F' },
};

/** Suggestions only — the admin can type any department or sector. */
export const PROJECT_CATEGORIES = [
  'Roads & Bridges', 'Water Supply', 'Education', 'Health', 'Electricity',
  'Irrigation', 'Sanitation', 'Sports', 'Tourism', 'Public Buildings',
];

export const blankProject = () => ({
  title: '', scheme_no: '', department: '', contractor: '', category: '',
  status: 'pending_approval', union_council: '', village: '',
  year: new Date().getFullYear(),
  approved_cost: 0, released_funds: 0, utilised_funds: 0,
  approved_date: '', start_date: '', target_date: '', completion_date: '',
  progress_percent: 0, beneficiaries: 0,
  summary: '', source: '', last_verified: '',
  image_url: null, gallery: [], published: true, sort_order: 0,
});

/** Columns the public endpoint may return. */
export const PUBLIC_PROJECT_COLUMNS = [
  'id', 'title', 'scheme_no', 'department', 'contractor', 'category', 'status',
  'union_council', 'village', 'year',
  'approved_cost', 'released_funds', 'utilised_funds',
  'approved_date', 'start_date', 'target_date', 'completion_date',
  'progress_percent', 'beneficiaries', 'summary', 'source', 'last_verified',
  'image_url', 'gallery', 'sort_order',
].join(', ');

// Re-exported so existing imports keep working; the single implementation
// lives in lib/gallery.js alongside the upload helpers.
export { allPhotos } from './gallery';

const num = (v) => Number(v) || 0;

/**
 * Compact money, e.g. "Rs 45.2 M". Public spending figures run to hundreds of
 * millions; printing every digit in a card makes the number harder to read,
 * not easier. The exact value is shown alongside in a tooltip.
 */
export function money(value, currency = 'PKR') {
  const n = num(value);
  const unit = currency === 'PKR' ? 'Rs' : currency;
  if (n >= 1e9) return `${unit} ${(n / 1e9).toFixed(2)} B`;
  if (n >= 1e6) return `${unit} ${(n / 1e6).toFixed(1)} M`;
  if (n >= 1e3) return `${unit} ${(n / 1e3).toFixed(0)} K`;
  return `${unit} ${n.toLocaleString()}`;
}

export const exactMoney = (value, currency = 'PKR') =>
  `${currency === 'PKR' ? 'Rs' : currency} ${num(value).toLocaleString()}`;

/** Roll a project list up into the figures the public page displays. */
export function summarise(projects) {
  const total = projects.length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const sum = (list, field) => list.reduce((a, p) => a + num(p[field]), 0);

  const byStatus = PROJECT_STATUSES
    .map(([key, label]) => {
      const list = projects.filter(p => p.status === key);
      return { key, label, count: list.length, percent: pct(list.length), cost: sum(list, 'approved_cost') };
    })
    .filter(s => s.count > 0);

  /** Group by an area field, carrying the cost and stage counts with it. */
  const byArea = (field) => {
    const m = new Map();
    for (const p of projects) {
      const v = String(p[field] || '').trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (!m.has(k)) {
        m.set(k, {
          label: v, count: 0, approved_cost: 0, released_funds: 0,
          completed: 0, ongoing: 0, pending: 0,
        });
      }
      const g = m.get(k);
      g.count++;
      g.approved_cost += num(p.approved_cost);
      g.released_funds += num(p.released_funds);
      if (p.status === 'completed') g.completed++;
      else if (p.status === 'ongoing') g.ongoing++;
      else if (p.status === 'pending_approval' || p.status === 'proposed') g.pending++;
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count || b.approved_cost - a.approved_cost || a.label.localeCompare(b.label))
      .map(g => ({ ...g, percent: pct(g.count) }));
  };

  const tally = (fn) => {
    const m = new Map();
    for (const p of projects) {
      const v = String(fn(p) ?? '').trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (!m.has(k)) m.set(k, { label: v, count: 0 });
      m.get(k).count++;
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map(x => ({ ...x, percent: pct(x.count) }));
  };

  const countOf = (...keys) => projects.filter(p => keys.includes(p.status)).length;

  return {
    total,
    pending: countOf('proposed', 'pending_approval'),
    approved: countOf('approved'),
    ongoing: countOf('ongoing'),
    completed: countOf('completed'),
    onHold: countOf('on_hold'),

    approvedCost: sum(projects, 'approved_cost'),
    releasedFunds: sum(projects, 'released_funds'),
    utilisedFunds: sum(projects, 'utilised_funds'),
    completedCost: sum(projects.filter(p => p.status === 'completed'), 'approved_cost'),
    beneficiaries: sum(projects, 'beneficiaries'),

    byStatus,
    byCouncil: byArea('union_council'),
    byVillage: byArea('village'),
    byCategory: tally(p => p.category),
    byDepartment: tally(p => p.department),
    byYear: tally(p => p.year).sort((a, b) => b.label.localeCompare(a.label)),
  };
}
