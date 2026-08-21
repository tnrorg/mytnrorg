'use client';
import { useEffect } from 'react';

/* Re-run a loader when the reader comes back to the page.
 *
 * WHY THIS IS NEEDED EVEN THOUGH EVERY FETCH SAYS no-store.
 * The requests are not cached — the components are. Next keeps a client-side
 * router cache, so returning to a page you visited moments ago re-uses the
 * mounted component rather than mounting a fresh one. `useEffect` does not run
 * again, so nothing asks the server anything, and the page shows what it
 * loaded the first time.
 *
 * That is exactly the admin's workflow: edit in one tab, switch to the public
 * tab, see the old version, conclude the save did not work.
 *
 * Two triggers, deliberately:
 *   visibilitychange — switching back to this browser tab
 *   focus            — returning to the window from another application
 *
 * Both are cheap: a list endpoint, only when someone is actually looking.
 * Nothing polls, so a phone sitting in a pocket makes no requests at all.
 */
export default function useRefreshOnFocus(load, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof load !== 'function') return;

    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
    // `load` is expected to be stable or cheap to re-bind; the listeners are
    // re-attached if it changes, which is correct rather than merely tolerable.
  }, [load, enabled]);
}
