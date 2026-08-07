'use client';
import { useEffect, useState } from 'react';
import { COLORS, FONT } from '@/lib/design/tokens';

/** Sticky table of contents for long policy documents.
 *  Highlights the section currently in view and stays out of the way on
 *  mobile, where it collapses into a details/summary disclosure. */
export default function DocToc({ items, label = 'Contents' }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const targets = items.map(i => document.getElementById(i.id)).filter(Boolean);
    if (!targets.length) return;
    // rootMargin pulls the trigger line to roughly a third down the viewport,
    // so the highlight matches what the reader is actually looking at.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0 },
    );
    targets.forEach(t => io.observe(t));
    return () => io.disconnect();
  }, [items]);

  const list = (
    <ol className="space-y-0.5">
      {items.map(i => {
        const on = active === i.id;
        return (
          <li key={i.id}>
            <a href={`#${i.id}`}
              aria-current={on ? 'true' : undefined}
              className="block border-l-2 pl-3 py-1.5 text-[13px] leading-snug transition-colors duration-micro"
              style={{
                borderColor: on ? COLORS.gold500 : 'rgba(23,33,28,.10)',
                color: on ? COLORS.green900 : COLORS.muted,
                fontWeight: on ? 700 : 400,
              }}>
              {i.kicker && <span className="font-semibold">{i.kicker} — </span>}{i.title}
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      {/* Mobile: collapsed by default so it never buries the document. */}
      <details className="lg:hidden mb-8 rounded-tnr-lg border border-gray-200 p-4" style={FONT}>
        <summary className="text-[11px] font-bold uppercase tracking-[.22em] cursor-pointer"
          style={{ color: COLORS.gold500 }}>{label}</summary>
        <div className="mt-3">{list}</div>
      </details>

      {/* Desktop: sticky rail beside the text. */}
      <nav aria-label={label} className="hidden lg:block sticky top-24 self-start" style={FONT}>
        <div className="text-[11px] font-bold uppercase tracking-[.22em] mb-3"
          style={{ color: COLORS.gold500 }}>{label}</div>
        {list}
      </nav>
    </>
  );
}
