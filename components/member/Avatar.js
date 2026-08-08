'use client';
import { useState } from 'react';
import { FemaleIcon } from '@/components/ui/Avatar';

export function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/**
 * Member photo with a fallback.
 *
 * Falls back when there is no URL OR when the image fails to load (a private
 * bucket returning 403, say), so it never renders a broken-image glyph.
 *
 * Female members may leave the photo blank — publishing a photograph is a real
 * privacy concern in this community — and get the hijab silhouette rather than
 * initials. Initials would still mark her out as "the one without a picture";
 * a designed icon reads as a deliberate choice.
 */
export default function Avatar({ src, name, gender = '', style, className, fontSize = 20 }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img src={src} alt={name || ''} style={style} className={className}
        onError={() => setFailed(true)} />
    );
  }

  if (String(gender || '').toLowerCase() === 'female') {
    return (
      <div style={{ ...style, display: 'grid', placeItems: 'center',
        background: 'linear-gradient(160deg,#0B6B4F,#063D2B)', color: '#F3E4B3' }}
        className={className}>
        <FemaleIcon className="w-[68%] h-[68%]" title={name || 'Member'} />
      </div>
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
