'use client';
import { useEffect, useState } from 'react';
import { COUNCIL } from '@/content/advisoryCouncil';
import { EXECUTIVE } from '@/content/executiveCommittee';

/**
 * Leadership rosters, from the admin-managed database.
 *
 * The built-in lists are a fallback so the section is never blank — but they
 * are placeholders ("To Be Announced"), so falling back when real people exist
 * is worse than a brief loading state. That is what used to happen: one fetch,
 * no retry, and any hiccup — a cold serverless start, a dropped mobile
 * connection, a transient database error — left the page showing placeholders
 * until the visitor happened to reload. Hence the retries below.
 */
const ATTEMPTS = 3;
const BACKOFF_MS = [400, 1200];   // waits between attempt 1→2 and 2→3

export function useLeadership() {
  const [data, setData] = useState({
    advisory: COUNCIL, executive: EXECUTIVE,
    /* No built-in fallback roster for ambassadors, on purpose.
     *
     * COUNCIL and EXECUTIVE exist because those two bodies have fixed, known
     * posts — President, General Secretary — so a placeholder card reading
     * "To Be Announced" is accurate between terms. University Ambassadors are
     * appointed per campus with no fixed establishment, so there is nothing
     * truthful to place-hold. An empty array means the section renders nothing
     * at all until a real ambassador is added, which is the honest result. */
    ambassadors: [],
    live: false, loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function attempt(n) {
      try {
        const r = await fetch('/api/public/leadership?t=' + Date.now(), { cache: 'no-store' });
        const j = await r.json();
        if (cancelled) return;

        // A server-side failure is worth another try. An empty-but-successful
        // response is not — the table really is empty, and retrying would just
        // delay the fallback the visitor is going to see anyway.
        const failed = !j?.ok || j.failed;
        if (failed && n < ATTEMPTS - 1) {
          setTimeout(() => attempt(n + 1), BACKOFF_MS[n] ?? 1200);
          return;
        }

        const advisory  = j?.advisory?.length  ? j.advisory  : COUNCIL;
        const executive = j?.executive?.length ? j.executive : EXECUTIVE;
        setData({
          advisory, executive,
          // Straight through — no fallback. See the note on the initial state.
          ambassadors: j?.ambassadors || [],
          live: !!(j?.advisory?.length || j?.executive?.length || j?.ambassadors?.length),
          loading: false,
        });
      } catch {
        if (cancelled) return;
        if (n < ATTEMPTS - 1) {
          setTimeout(() => attempt(n + 1), BACKOFF_MS[n] ?? 1200);
          return;
        }
        setData(d => ({ ...d, loading: false }));
      }
    }

    attempt(0);
    return () => { cancelled = true; };
  }, []);

  return data;
}
