'use client';
import { useEffect, useState } from 'react';

/* One fetch of the membership statistics, shared by every statistics page.
 *
 * The endpoint returns all breakdowns in a single response, so the Education
 * and Employment pages read from the same call rather than each defining their
 * own — which is how two pages end up quoting different totals.
 */
export function useRounduStats() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    fetch('/api/public/roundu-stats', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        if (j?.ok) setD(j);
        else setErr(j?.message || 'Statistics are unavailable right now.');
      })
      .catch(() => { if (!off) setErr('Statistics are unavailable right now.'); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, []);

  return { d, err, loading };
}
