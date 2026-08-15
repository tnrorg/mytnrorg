// Comment rules, shared by the browser and the API so the two cannot drift.

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 2000;

/** Collapse runs of blank lines; trim. Stored plain, never as markup. */
export const cleanComment = (s) =>
  String(s ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/** @returns {string} an error message, or '' when the text is acceptable. */
export function validateComment(s) {
  const v = cleanComment(s);
  if (!v) return 'Write something first.';
  if (v.length < COMMENT_MIN) return 'That is a little short.';
  if (v.length > COMMENT_MAX) return `Please keep comments under ${COMMENT_MAX} characters.`;
  return '';
}

/* Split on blank lines for rendering.
 *
 * The array is rendered as separate <p> elements and React escapes each one,
 * so nothing a commenter types can become HTML on a public page. That is the
 * whole protection, and it is why comments are plain text rather than a rich
 * editor — the same decision the article body makes. */
export const commentParagraphs = (body) =>
  cleanComment(body).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

/** Who may remove a comment. Mirrored exactly on the server. */
export function canDelete({ comment, viewerMemberId, opinionAuthorId, isAdmin }) {
  if (isAdmin) return 'admin';
  if (viewerMemberId && comment.member_id === viewerMemberId) return 'self';
  if (viewerMemberId && opinionAuthorId && viewerMemberId === opinionAuthorId) return 'author';
  return null;
}

/** Short relative time — "2 hours ago". Long enough ago, show the date. */
export function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
