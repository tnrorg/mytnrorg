'use client';
import { useEffect, useRef, useState } from 'react';

/** Counts up to `value` the first time it enters the viewport.
 *  Never invents a number: renders 0 until real data arrives, and skips the
 *  animation entirely for reduced-motion users. */
export default function CountUp({ value = 0, duration = 900, className = '', style }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = Number(value) || 0;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setN(target); return; }

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || ran.current) return;
      ran.current = true;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        // easeOutCubic — fast start, gentle settle
        setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });

    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  // If the value arrives after the animation has already played, show it.
  useEffect(() => { if (ran.current) setN(Number(value) || 0); }, [value]);

  return <span ref={ref} className={className} style={style}>{n.toLocaleString()}</span>;
}
