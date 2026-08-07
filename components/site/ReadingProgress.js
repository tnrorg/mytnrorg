'use client';
import { useEffect, useState } from 'react';
import { COLORS } from '@/lib/design/tokens';

/** Thin progress bar for long governance documents, so readers can see how
 *  much of a policy is left. Decorative — hidden from assistive tech. */
export default function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div aria-hidden="true" className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent">
      <div className="h-full transition-[width] duration-100 ease-out"
        style={{ width: `${p}%`, background: `linear-gradient(90deg,${COLORS.green700},${COLORS.gold500})` }} />
    </div>
  );
}
