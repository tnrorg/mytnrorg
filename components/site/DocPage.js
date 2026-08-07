'use client';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { HANDBOOK } from '@/content/aboutTnr';
import { COLORS, FONT } from '@/lib/design/tokens';
import ReadingProgress from './ReadingProgress';
import DocToc from './DocToc';

// Sourced from the design tokens rather than redeclared, so a brand change is
// one edit. Re-exported because the About pages import `C` from here.
export const C = {
  deep: COLORS.green900, green: COLORS.green700, gold: COLORS.gold500,
  soft: '#F3E4B3', ink: COLORS.charcoal,
};
export { DocToc };

// Shared shell for every About TNR page, so the governance documents all read
// as one publication rather than eight separately-styled pages.
export default function DocPage({ eyebrow, title, lead, children, source, toc }) {
  return (
    <div className="light-page min-h-screen bg-white" style={{ color: C.ink, ...FONT }}>
      {/* Long governance documents get a reading-progress indicator. */}
      {toc && <ReadingProgress />}
      <SiteNav />

      <header className="relative overflow-hidden" style={{ background: C.deep }}>
        <div aria-hidden className="absolute inset-0 opacity-[.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
        <div className="relative max-w-4xl mx-auto px-5 py-14 sm:py-20">
          {eyebrow && <div className="text-[11px] font-bold uppercase tracking-[.28em] mb-3" style={{ color: C.gold }}>{eyebrow}</div>}
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">{title}</h1>
          {lead && <p className="mt-4 text-white/75 text-base sm:text-lg max-w-2xl leading-relaxed">{lead}</p>}
        </div>
      </header>

      {/* With a table of contents the page becomes a two-column reading view;
          without one it stays a single measured column. */}
      {toc ? (
        <main id="main" className="max-w-tnr mx-auto px-5 py-12 sm:py-16
          grid lg:grid-cols-[220px,minmax(0,1fr)] gap-10 lg:gap-14">
          <DocToc items={toc} />
          <div className="min-w-0">{children}</div>
        </main>
      ) : (
        <main id="main" className="max-w-4xl mx-auto px-5 py-12 sm:py-16">{children}</main>
      )}

      <div className="max-w-4xl mx-auto px-5 pb-14">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-[13px] text-gray-600 leading-relaxed">
          <span className="font-bold" style={{ color: C.deep }}>Source: </span>
          {source || `${HANDBOOK.title}, ${HANDBOOK.version} — approved ${HANDBOOK.approved} by the ${HANDBOOK.approvedBy}.`}
          {' '}Where any inconsistency arises between governance documents, the Constitution shall prevail.
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

/** Turns a heading into a stable anchor id, so the sticky TOC and the section
 *  it points at are always generated from the same string. */
export const sectionId = (t = '') =>
  t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function Section({ title, kicker, id, children }) {
  return (
    <section id={id || (title ? sectionId(title) : undefined)} className="mb-12 scroll-mt-24">
      {kicker && <div className="text-[11px] font-bold uppercase tracking-[.22em] mb-2" style={{ color: C.gold }}>{kicker}</div>}
      {title && <h2 className="text-2xl font-black mb-4" style={{ color: C.deep }}>{title}</h2>}
      {children}
    </section>
  );
}

export function P({ children }) {
  return <p className="text-[15px] leading-[1.85] text-gray-700 mb-4">{children}</p>;
}

// Gold-ticked list used for every "shall / must" list in the handbook.
export function TickList({ items }) {
  return (
    <ul className="space-y-3">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-[1.75] text-gray-700">
          <span className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: C.gold }} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({ children, label }) {
  return (
    <div className="rounded-2xl p-5 sm:p-6 border-l-4" style={{ background: '#F7FBF9', borderColor: C.gold }}>
      {label && <div className="text-[11px] font-bold uppercase tracking-[.2em] mb-2" style={{ color: C.green }}>{label}</div>}
      <div className="text-[15px] leading-[1.8] text-gray-700">{children}</div>
    </div>
  );
}
