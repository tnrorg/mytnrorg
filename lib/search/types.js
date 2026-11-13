/* ── Search: result types, tabs and highlighting ─────────────────────────────
 *
 * Client-safe: no database, no secrets. Shared by the server (to label and
 * group results) and by the overlay and results page (to draw them).
 *
 * TO ADD A SEARCHABLE MODULE LATER: add its type here, then add one provider
 * in lib/search/providers.js. Nothing else needs to change — the API, the
 * overlay and the results page all read this registry.
 */

/** key → label, tab it appears under, lucide icon name. */
export const TYPES = {
  member:                { label: 'Member',                tab: 'people',  icon: 'User' },
  cec:                   { label: 'Executive Committee',   tab: 'people',  icon: 'Award' },
  advisory:              { label: 'Advisory Council',      tab: 'people',  icon: 'GraduationCap' },
  country_ambassador:    { label: 'Country Ambassador',    tab: 'people',  icon: 'Globe' },
  university_ambassador: { label: 'University Ambassador', tab: 'people',  icon: 'Landmark' },
  scholarship:           { label: 'Scholarship',           tab: 'opps',    icon: 'BookOpen' },
  opportunity:           { label: 'Opportunity',           tab: 'opps',    icon: 'Briefcase' },
  news:                  { label: 'News',                  tab: 'news',    icon: 'Newspaper' },
  opinion:               { label: 'Opinion',               tab: 'news',    icon: 'PenLine' },
  story:                 { label: 'Success Story',         tab: 'news',    icon: 'Trophy' },
  uc:                    { label: 'Union Council',         tab: 'region',  icon: 'Map' },
  village:               { label: 'Village',               tab: 'region',  icon: 'MapPin' },
  statistic:             { label: 'Statistics',            tab: 'stats',   icon: 'BarChart3' },
  institution:           { label: 'School / College',      tab: 'stats',   icon: 'School' },
  project:               { label: 'Development Project',   tab: 'stats',   icon: 'Hammer' },
  university:            { label: 'University',            tab: 'stats',   icon: 'Building2' },
  page:                  { label: 'TNR Information',       tab: 'info',    icon: 'FileText' },
};

export const TABS = [
  ['all', 'All results'],
  ['people', 'Members & Leadership'],
  ['news', 'News & Stories'],
  ['opps', 'Scholarships & Opportunities'],
  ['region', 'Villages & UCs'],
  ['stats', 'Statistics'],
  ['info', 'About TNR'],
];
export const TAB_KEYS = TABS.map(([k]) => k);

export const typeLabel = (t) => TYPES[t]?.label || 'Result';
export const tabOf = (t) => TYPES[t]?.tab || 'info';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Split text into [{ text, hit }] so the matching words can be emphasised.
 *
 * Returns parts rather than HTML on purpose: the caller renders each part as a
 * text node, so nothing from a title or a snippet is ever interpreted as
 * markup. Titles come from member-written content.
 */
export function highlightParts(text, query) {
  const s = String(text ?? '');
  const words = String(query || '').trim().split(/\s+/).filter(w => w.length >= 2).slice(0, 8);
  if (!s || !words.length) return [{ text: s, hit: false }];
  let re;
  try { re = new RegExp(`(${words.map(esc).join('|')})`, 'giu'); }
  catch { return [{ text: s, hit: false }]; }
  return s.split(re).filter(Boolean).map(part => ({
    text: part,
    hit: words.some(w => w.toLowerCase() === part.toLowerCase()),
  }));
}
