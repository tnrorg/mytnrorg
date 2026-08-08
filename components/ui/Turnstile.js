'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so local
 * development and any deployment without the keys keep working unchanged.
 *
 * @param {(token: string) => void} onToken  called with the token, '' when it expires
 */
const SCRIPT_ID = 'cf-turnstile-script';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function Turnstile({ onToken, theme = 'light', className = '' }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const boxRef = useRef(null);
  const widgetId = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !boxRef.current) return;
    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile || !boxRef.current) return;
      // Guard against a double render in React strict mode, which would stack
      // two widgets and make the second token invalid.
      if (widgetId.current !== null) return;
      try {
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: siteKey,
          theme,
          callback: (t) => onToken?.(t),
          'expired-callback': () => onToken?.(''),
          'error-callback': () => { setFailed(true); onToken?.(''); },
        });
      } catch {
        setFailed(true);
      }
    }

    if (window.turnstile) { render(); return () => { cancelled = true; }; }

    let s = document.getElementById(SCRIPT_ID);
    if (!s) {
      s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = SRC;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', render);
    s.addEventListener('error', () => setFailed(true));

    return () => {
      cancelled = true;
      s?.removeEventListener('load', render);
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, theme]);

  if (!siteKey) return null;

  return (
    <div className={className}>
      <div ref={boxRef} />
      {failed && (
        <p className="mt-1 text-[11px] text-gray-400">
          The security check could not load. You can still sign in.
        </p>
      )}
    </div>
  );
}
