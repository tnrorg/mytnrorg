'use client';
import { useEffect, useState } from 'react';
import { COUNCIL } from '@/content/advisoryCouncil';
import { EXECUTIVE } from '@/content/executiveCommittee';

// Leadership comes from the admin-managed database. The built-in lists are the
// fallback: if the table is empty, the request fails, or the migration has not
// been run yet, the site still renders a complete section instead of nothing.
export function useLeadership() {
  const [data, setData] = useState({ advisory: COUNCIL, executive: EXECUTIVE, live: false });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/leadership?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (cancelled || !j?.ok) return;
        const advisory  = j.advisory?.length  ? j.advisory  : COUNCIL;
        const executive = j.executive?.length ? j.executive : EXECUTIVE;
        setData({ advisory, executive, live: !!(j.advisory?.length || j.executive?.length) });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return data;
}
