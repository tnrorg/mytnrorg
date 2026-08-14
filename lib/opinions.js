/* Shared rules for Opinions — member-written pieces published after review.
 *
 * Imported by the member form, the member API, the admin queue and the public
 * pages, so all four agree on what a valid opinion is and what each status
 * means. The same arrangement the membership and CEC applications use.
 */

export const STATUSES = ['draft', 'pending', 'published', 'changes_requested', 'rejected'];

export const STATUS_LABEL = {
  draft: 'Draft',
  pending: 'Awaiting review',
  published: 'Published',
  changes_requested: 'Changes requested',
  rejected: 'Not accepted',
};

/** What the author should understand by each state. */
export const STATUS_HELP = {
  draft: 'Only you can see this. Submit it when you are ready.',
  pending: 'With the committee. You will see their reply here.',
  published: 'Live on the site. Editing it sends the changes for review — the published version stays up meanwhile.',
  changes_requested: 'The committee has asked for changes. Edit and submit again.',
  rejected: 'Not accepted for publication. The reason is below.',
};

export const LIMITS = {
  title: 140,
  summary: 300,
  body: 20000,
};

/* Enough to be an opinion rather than a comment. Deliberately not high — a
 * sharp 150-word piece is worth more than padding to reach a word count. */
export const MIN_BODY_WORDS = 80;

export const wordCount = (s) =>
  String(s || '').trim().split(/\s+/).filter(Boolean).length;

export function validateOpinion(f = {}) {
  const e = {};
  const str = (k) => String(f[k] ?? '').trim();

  if (!str('title')) e.title = 'A title is required.';
  if (!str('summary')) e.summary = 'Write a one-line summary for the listing page.';
  if (!str('body')) e.body = 'Please write your opinion.';
  else if (wordCount(str('body')) < MIN_BODY_WORDS) {
    e.body = `Please write at least ${MIN_BODY_WORDS} words — this is currently ${wordCount(str('body'))}.`;
  }

  for (const [k, max] of Object.entries(LIMITS)) {
    if (str(k).length > max) e[k] = `Please keep this under ${max} characters.`;
  }

  return e;
}

/* URL-safe slug from the title, with a short random suffix.
 *
 * The suffix is not decoration: two members writing "Education in Roundu" must
 * not collide, and the second one should not be told their title is taken.
 * Generated once at first publication and never regenerated — a changing URL
 * breaks every link already shared.
 */
export function makeSlug(title, seed = '') {
  const base = String(title || 'opinion')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '') || 'opinion';
  const tail = (seed || Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase();
  return `${base}-${tail}`;
}

/** Plain text into paragraphs. Blank lines separate; no HTML is ever stored. */
export const paragraphs = (body) =>
  String(body || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

/** Rough reading time, for the listing page. */
export const readingMinutes = (body) => Math.max(1, Math.round(wordCount(body) / 200));
