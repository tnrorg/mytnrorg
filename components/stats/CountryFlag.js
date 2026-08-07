'use client';
import { useState } from 'react';
import { COLORS } from '@/lib/design/tokens';

/* A country flag from an ISO 3166-1 alpha-2 code.
 *
 * The emoji approach (regional-indicator letters) is elegant and works on
 * macOS, iOS and Android — but WINDOWS SHIPS NO FLAG GLYPHS AT ALL. On every
 * Windows browser 🇲🇾 renders as the bare letters "MY", which is what the
 * statistics page was showing. Since most of TNR's admins and a large share of
 * visitors are on Windows, the emoji cannot be the primary rendering.
 *
 * So: a small flag image, with the code itself as the fallback if the image
 * fails to load. Alt text is empty because the country name is always beside
 * it — a screen reader announcing "Malaysia flag Malaysia" is worse than
 * silence.
 */
export default function CountryFlag({ code, size = 20, className = '' }) {
  const [failed, setFailed] = useState(false);
  const c = String(code || '').trim().toLowerCase();

  // No usable code — show nothing rather than a broken box.
  if (!/^[a-z]{2}$/.test(c)) return null;

  if (failed) {
    return (
      <span className={`shrink-0 inline-grid place-items-center rounded-[3px] font-bold ${className}`}
        style={{
          width: size * 1.4, height: size, fontSize: size * 0.5,
          background: COLORS.neutral, color: COLORS.muted, letterSpacing: '.02em',
        }}
        aria-hidden="true">{c.toUpperCase()}</span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      width={size * 1.4} height={size} alt="" aria-hidden="true" loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[3px] object-cover ${className}`}
      style={{ width: size * 1.4, height: size }}
    />
  );
}
