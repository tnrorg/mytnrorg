'use client';
import { ArrowRight } from 'lucide-react';
import CouncilCarousel from '@/components/council/CouncilCarousel';
import { SectionHeading, Reveal } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';

// Homepage preview: card-level information only. The full professional profile
// — biography, education, publications, certifications — lives on the profile
// page behind "View Full Profile".
export default function CouncilSection() {
  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      {/* Not wrapped in <Reveal>: the heading runs its own sequence, and the
          link follows it in — see components/ui/SectionHeading.js. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="Senior Leadership" title="TNR Advisory Council Members"
          lead="Experienced professionals, academics and community leaders guiding TNR." />
        <Reveal delay={0.3}>
          <a href="/about/advisory-council"
            className="group inline-flex items-center gap-1.5 rounded-tnr px-5 py-2.5 text-sm font-bold
              transition-colors duration-micro hover:bg-[rgba(23,107,73,.14)]"
            style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>
            View Full Council
            <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true"
              className="transition-transform duration-micro group-hover:translate-x-0.5" />
          </a>
        </Reveal>
      </div>
      {/* Slight delay so the heading settles before the cards arrive, rather
          than the whole block appearing at once. */}
      <Reveal className="mt-10" delay={0.08}>
        {/* Every advisory member, as one slowly moving row — not a preview and
            not a grid. Nobody is left out by their sort order: the row loops,
            so each member passes through the window in turn. The full roster
            with search and filters is one click away on "View Full Council".
            Same endpoint as that page, which returns the advisory body only,
            so no other role can appear here. */}
        <CouncilCarousel />
      </Reveal>
    </section>
  );
}
