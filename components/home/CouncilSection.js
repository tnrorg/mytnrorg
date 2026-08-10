'use client';
import { ArrowRight } from 'lucide-react';
import CouncilDirectory from '@/components/council/CouncilDirectory';
import { SectionHeading, Reveal } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';

// Homepage preview: card-level information only. The full professional profile
// — biography, education, publications, certifications — lives on the profile
// page behind "View Full Profile".
export default function CouncilSection() {
  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="Senior Leadership" title="TNR Advisory Council Members"
          lead="Experienced professionals, academics and community leaders guiding TNR." />
        <a href="/about/advisory-council"
          className="group inline-flex items-center gap-1.5 rounded-tnr px-5 py-2.5 text-sm font-bold
            transition-colors duration-micro hover:bg-[rgba(23,107,73,.14)]"
          style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>
          View Full Council
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true"
            className="transition-transform duration-micro group-hover:translate-x-0.5" />
        </a>
      </Reveal>
      {/* Slight delay so the heading settles before the cards arrive, rather
          than the whole block appearing at once. */}
      <Reveal className="mt-10" delay={0.08}>
        {/* Every advisory member, not a preview.
            This was capped at 8 — two desktop rows — which quietly hid anyone
            beyond the eighth. On a page whose purpose is to show who guides
            TNR, a member being invisible because of their sort order is the
            wrong trade for a shorter page. The endpoint returns the advisory
            body only, so there is no risk of other roles appearing here. */}
        <CouncilDirectory showFilters={false} />
      </Reveal>
    </section>
  );
}
