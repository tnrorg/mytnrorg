/* Shared shape and limits for the admin-managed hero carousel.
 *
 * The clamps live here rather than only in the database so the admin form and
 * the API agree on what is valid — a value the form allows but the CHECK
 * constraint rejects would surface as an unexplained "save failed".
 */
export const SLIDE_LIMITS = {
  overlay:            { min: 0,  max: 95,  def: 55 },
  title_size_mobile:  { min: 16, max: 80,  def: 32 },
  title_size_desktop: { min: 20, max: 140, def: 56 },
  text_size_mobile:   { min: 11, max: 32,  def: 15 },
  text_size_desktop:  { min: 11, max: 40,  def: 17 },
};

export const ALIGNMENTS = ['left', 'center'];

/** Keep a number inside its allowed range, falling back to the default. */
export function clampField(field, value) {
  const { min, max, def } = SLIDE_LIMITS[field];
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** A fresh, empty slide for the "Add slide" form. */
export const blankSlide = () => ({
  eyebrow: '', title: '', subtitle: '', image_url: null,
  cta1_label: '', cta1_href: '', cta2_label: '', cta2_href: '',
  align: 'left', active: true, sort_order: 0,
  ...Object.fromEntries(Object.entries(SLIDE_LIMITS).map(([k, v]) => [k, v.def])),
});

const TEXT_FIELDS = [
  'eyebrow', 'title', 'subtitle',
  'cta1_label', 'cta1_href', 'cta2_label', 'cta2_href',
];

/**
 * Build a database row from a request body. Shared by create and update so the
 * two cannot drift apart.
 *
 * Lives here rather than in the route file because Next.js only permits HTTP
 * method and config exports from a route module — exporting a helper from one
 * fails the build.
 *
 * `partial` (used by PATCH) copies only the fields actually sent, so editing
 * the headline does not silently reset the font sizes.
 */
export function slideFromBody(b, { partial = false } = {}) {
  const row = {};
  for (const f of TEXT_FIELDS) if (!partial || f in b) row[f] = String(b[f] ?? '').trim();
  if (!partial || 'align' in b) row.align = ALIGNMENTS.includes(b.align) ? b.align : 'left';
  if (!partial || 'active' in b) row.active = b.active !== false;
  if (!partial || 'sort_order' in b) row.sort_order = Number(b.sort_order) || 0;
  for (const f of Object.keys(SLIDE_LIMITS)) if (!partial || f in b) row[f] = clampField(f, b[f]);
  return row;
}

/** Columns the public endpoint is allowed to return — privacy by construction. */
export const PUBLIC_SLIDE_COLUMNS = [
  'id', 'eyebrow', 'title', 'subtitle', 'image_url',
  'cta1_label', 'cta1_href', 'cta2_label', 'cta2_href',
  'align', 'overlay',
  'title_size_mobile', 'title_size_desktop', 'text_size_mobile', 'text_size_desktop',
  'sort_order',
].join(', ');
