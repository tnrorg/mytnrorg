'use client';
import { useEffect, useRef } from 'react';
import { getToken } from '@/components/member/memberApi';

/**
 * Times how long a reader stays on a member profile and reports it on exit.
 *
 * Renders nothing.
 *
 * Time spent on a hidden tab is not counted — a page left open in a background
 * tab for two hours is not two hours of reading, and counting it would make
 * every dwell figure meaningless.
 *
 * The report is sent with sendBeacon so it survives the page being closed;
 * a normal fetch is cancelled when the document unloads, which is exactly the
 * moment this needs to fire.
 */
export default function ViewTracker({ membershipId }) {
  const active = useRef(0);        // accumulated visible milliseconds
  const since = useRef(Date.now());
  const sent = useRef(false);

  useEffect(() => {
    if (!membershipId) return;

    active.current = 0;
    since.current = Date.now();
    sent.current = false;

    const bank = () => {
      if (since.current) active.current += Date.now() - since.current;
      since.current = 0;
    };
    const resume = () => { if (!since.current) since.current = Date.now(); };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { bank(); report(); }
      else resume();
    };

    function report() {
      if (sent.current) return;
      bank();
      const seconds = Math.round(active.current / 1000);
      if (seconds < 2) return;
      sent.current = true;

      const body = JSON.stringify({ membership_id: membershipId, seconds });
      const token = getToken();

      // sendBeacon cannot carry an Authorization header, so a signed-in member
      // uses keepalive fetch instead — otherwise every view would be recorded
      // as anonymous and the feature would show nothing useful.
      if (token) {
        fetch('/api/public/profile-view', {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body,
        }).catch(() => {});
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/public/profile-view',
          new Blob([body], { type: 'application/json' }));
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', report);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', report);
      report();                      // client-side navigation away
    };
  }, [membershipId]);

  return null;
}
