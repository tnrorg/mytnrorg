'use client';
import { useEffect } from 'react';

/**
 * Counts one visit per browser session.
 *
 * sessionStorage rather than localStorage: localStorage would count a returning
 * visitor only once, ever, which makes the figure meaningless over time.
 * sessionStorage resets when the tab closes, so it counts sessions — the usual
 * meaning of "visitors" — while still not counting every page navigation.
 *
 * Renders nothing. Failures are swallowed; a counter must never break a page.
 */
const KEY = 'tnr_visit_counted';

export default function VisitTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      return; // private mode or storage disabled — skip rather than double-count
    }

    // keepalive so the request survives the user navigating away immediately.
    fetch('/api/public/visit', { method: 'POST', keepalive: true }).catch(() => {});
  }, []);

  return null;
}
