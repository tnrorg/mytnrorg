// News rules, shared by the admin editor, the public pages and the API so the
// three cannot drift apart.

export const CATEGORIES = ['News', 'Announcement', 'Event', 'Achievement', 'Press Release'];

/** Colour per category, for the chip on a card. */
export const CATEGORY_TONE = {
  'News':          { bg: 'rgba(23,107,73,.10)',  fg: '#176B49' },
  'Announcement':  { bg: 'rgba(212,167,44,.16)', fg: '#8A6A0B' },
  'Event':         { bg: 'rgba(37,99,235,.10)',  fg: '#1D4ED8' },
  'Achievement':   { bg: 'rgba(190,24,93,.10)',  fg: '#9D174D' },
  'Press Release': { bg: 'rgba(71,85,105,.12)',  fg: '#334155' },
};

export const LIMITS = { title: 160, summary: 300, body: 30000 };

export const wordCount = (s) =>
  String(s || '').trim().split(/\s+/).filter(Boolean).length;

export const readingMinutes = (body) => Math.max(1, Math.round(wordCount(body) / 200));

/** @returns {object} field → message. Empty when the post may be published. */
export function validateNews(f = {}, { publishing = false } = {}) {
  const e = {};
  const str = (k) => String(f[k] ?? '').trim();

  if (!str('title')) e.title = 'A headline is required.';
  else if (str('title').length > LIMITS.title) e.title = `Keep the headline under ${LIMITS.title} characters.`;

  if (str('summary').length > LIMITS.summary) e.summary = `Keep the summary under ${LIMITS.summary} characters.`;
  if (str('body').length > LIMITS.body) e.body = 'This is longer than the editor supports.';

  if (f.category && !CATEGORIES.includes(f.category)) e.category = 'Choose a category.';

  /* Only checked when publishing.
   *
   * A draft is somewhere to think — refusing to save a headline with no body
   * yet would mean losing the headline. The rules apply at the moment the
   * piece becomes public, which is when they matter. */
  if (publishing) {
    if (!str('summary')) e.summary = 'A summary is needed — it is what appears on cards and shared links.';
    if (!str('body')) e.body = 'Write the article before publishing.';
  }
  return e;
}

/* URL slug from a headline.
 *
 * Latin letters, digits and dashes only. Urdu and Balti headlines transliterate
 * to nothing here, so a seed is appended when the result would be empty —
 * a URL of `/media/news/` is worse than an ugly one. */
export function makeSlug(title, seed = '') {
  const base = String(title || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  const tail = String(seed || '').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase();
  if (!base) return `post-${tail || Date.now().toString(36)}`;
  return tail ? `${base}-${tail}` : base;
}

/* Rendered as separate paragraphs, each a React text node.
 *
 * Nothing an editor types can become HTML on a public page — React escapes
 * these strings. That is the whole protection, and it is why the body is plain
 * text rather than a rich editor. */
export const paragraphs = (body) =>
  String(body || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

/** Is this post visible to the public right now? */
export function isLive(p, now = Date.now()) {
  if (!p || p.status !== 'published' || !p.slug) return false;
  if (p.publish_at && new Date(p.publish_at).getTime() > now) return false;
  if (p.expires_at && new Date(p.expires_at).getTime() < now) return false;
  return true;
}

/** Newest first, with pinned posts held above everything. */
export function orderPosts(list = []) {
  const when = (p) => new Date(p.publish_at || p.created_at || 0).getTime();
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || when(b) - when(a));
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
}) : '');
