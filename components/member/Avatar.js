'use client';
import { useState } from 'react';

export function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

// Member photo with an initials fallback.
// Falls back if there is no URL OR if the image fails to load (e.g. a private
// storage bucket returning 403) — so it never renders a broken-image icon.
export default function Avatar({ src, name, style, className, fontSize = 20 }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img src={src} alt={name || ''} style={style} className={className}
        onError={() => setFailed(true)} />
    );
  }
  return (
    <div style={{ ...style, display: 'grid', placeItems: 'center',
      background: 'linear-gradient(160deg,#0B6B4F,#063D2B)', color: '#F3E4B3',
      fontWeight: 900, fontSize, letterSpacing: '.04em' }} className={className}>
      {initials(name)}
    </div>
  );
}
