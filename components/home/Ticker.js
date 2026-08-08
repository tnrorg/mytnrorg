'use client';
import { useEffect, useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { COLORS, FONT } from '@/lib/design/tokens';

/**
 * Continuously scrolling announcement strip, between the hero and the stats.
 *
 * The loop works by rendering the list twice and translating the track by
 * exactly -50%. When the first copy has scrolled fully out of view the second
 * is in precisely the position the first started at, so the reset is invisible
 * and there is no gap at the seam — which is what happens if you animate a
 * single copy and snap back.
 *
 * Duration scales with content length so a long list does not race past and a
 * short one does not crawl.
 */
export default function Ticker() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let off = false;
    fetch('/api/public/announcements', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off && j?.ok) setItems(j.items || []); })
      .catch(() => { if (!off) setItems([]); });
    return () => { off = true; };
  }, []);

  const seconds = useMemo(() => {
    if (!items?.length) return 30;
    const chars = items.reduce((n, i) => n + i.text.length + 6, 0);
    // ~11 characters per second reads comfortably without feeling sluggish.
    return Math.min(90, Math.max(18, Math.round(chars / 11)));
  }, [items]);

  if (!items?.length) return null;

  const Line = ({ i, copy }) => {
    const body = (
      <>
        <span className="mx-3 opacity-45" aria-hidden="true">◆</span>
        <span>{i.text}</span>
      </>
    );
    return (
      <span key={`${copy}-${i.id}`} className="inline-flex items-center whitespace-nowrap">
        {i.href
          ? <a href={i.href} className="inline-flex items-center hover:underline">{body}</a>
          : body}
      </span>
    );
  };

  return (
    <section aria-label="Announcements"
      className="w-full overflow-hidden border-y"
      style={{
        ...FONT,
        background: `linear-gradient(90deg,${COLORS.green950},${COLORS.green800},${COLORS.green950})`,
        borderColor: 'rgba(200,154,43,.28)',
      }}>
      <div className="relative flex items-center">
        {/* Fixed label. Sits above the track and masks the point where text
            enters, so a line never appears to slide out from under nothing. */}
        <div className="z-10 flex shrink-0 items-center gap-2 py-2.5 pl-4 pr-4 sm:pl-8"
          style={{ background: COLORS.green950 }}>
          <Megaphone size={14} strokeWidth={2.4} aria-hidden="true" style={{ color: COLORS.gold400 }} />
          <span className="text-[10px] font-black uppercase tracking-[.18em]"
            style={{ color: COLORS.gold400 }}>
            Notice
          </span>
        </div>

        <div className="tnr-ticker-mask relative flex-1 overflow-hidden py-2.5">
          <div className="tnr-ticker-track text-[13px]"
            style={{ color: 'rgba(255,255,255,.9)', animationDuration: `${seconds}s` }}>
            {/* aria-hidden on the duplicate: a screen reader should hear the
                announcements once, not twice. */}
            <div className="inline-flex">{items.map(i => <Line key={i.id} i={i} copy="a" />)}</div>
            <div className="inline-flex" aria-hidden="true">{items.map(i => <Line key={i.id} i={i} copy="b" />)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
