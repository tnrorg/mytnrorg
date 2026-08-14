'use client';
import { useEffect, useState } from 'react';

/* Which of these articles the reader has already liked.
 *
 * ONE request for the whole page. Each card asking for itself would mean sixty
 * requests on the Opinions index, all of them to the same endpoint, for an
 * answer the server can give in a single query.
 *
 * Returns a Set of slugs, and `known` — false until the answer arrives, so
 * cards can avoid drawing an empty heart and then filling it a moment later.
 */
export default function useLikedSlugs(slugs = []) {
  const [liked, setLiked] = useState(() => new Set());
  const [known, setKnown] = useState(false);

  // Joined into a string so the effect compares by value: a fresh array each
  // render would otherwise re-fetch forever.
  const key = slugs.filter(Boolean).join(',');

  useEffect(() => {
    if (!key) { setKnown(true); return; }
    let off = false;

    let browser = '';
    try {
      browser = localStorage.getItem('tnr_like_key') || '';
    } catch { /* private browsing — the member token below may still identify them */ }

    let auth = {};
    try {
      const t = localStorage.getItem('tnr_member_token');
      if (t) auth = { Authorization: `Bearer ${t}` };
    } catch { /* no token available */ }

    // Nothing to identify this reader by: they have liked nothing we can prove.
    if (!browser && !auth.Authorization) { setKnown(true); return; }

    fetch(`/api/public/opinions/like?slugs=${encodeURIComponent(key)}&key=${encodeURIComponent(browser)}`,
      { headers: auth, cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        setLiked(new Set(Array.isArray(j?.liked) ? j.liked : []));
        setKnown(true);
      })
      .catch(() => { if (!off) setKnown(true); });

    return () => { off = true; };
  }, [key]);

  return { liked, known };
}
