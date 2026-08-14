'use client';
import { useEffect } from 'react';

/**
 * Counts one read of an Opinion. Renders nothing.
 *
 * sessionStorage, not localStorage — the same choice the site visit counter
 * makes. localStorage would count a returning reader once and never again;
 * sessionStorage resets when the tab closes, so refreshing an article does not
 * inflate the number while coming back tomorrow still counts.
 *
 * Keyed by slug, so reading three different pieces in one session counts three
 * times rather than once.
 */
export default function OpinionViewTracker({ slug }) {
  useEffect(() => {
    if (!slug) return;
    const KEY = `tnr_opinion_seen_${slug}`;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      // Private browsing can throw on sessionStorage. Counting the read is
      // better than skipping it, so fall through rather than return.
    }

    // keepalive so the request survives the reader navigating away
    // immediately — without it a quick bounce is never counted.
    fetch('/api/public/opinions/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => { /* a missed count must never disturb the reader */ });
  }, [slug]);

  return null;
}
