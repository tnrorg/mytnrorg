'use client';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui';
import CardCarousel from '@/components/ui/CardCarousel';
import { FONT } from '@/lib/design/tokens';
import { CouncilRosterCard } from './CouncilDirectory';
import './council-carousel.css';

/* ── The Advisory Council, as a slowly moving row ─────────────────────────────
 *
 * The home page's council roster: every approved member, drifting right to
 * left, looping without a seam.
 *
 * The movement, the drag, the pausing and the loop all live in
 * components/ui/CardCarousel.js, which the Opinions row shares. This file is
 * what is particular to the council: where the members come from, what a
 * member's card is, the placeholder shown while they load, and what a click
 * on a card opens.
 *
 * Same data, same endpoint and same card as the full council page.
 */

/* The portrait's real width at each breakpoint — see .tnr-cc in the carousel
   stylesheet for the counts these come from (1.25, 2.3, 3 and 4 across). */
const CAROUSEL_SIZES = '(max-width: 639px) 78vw, (max-width: 767px) 42vw, (max-width: 1279px) 32vw, 340px';

/* The whole card opens the profile, not only its button — a face is what
   people click. */
const openProfile = (m, ev) => {
  const href = `/council/${m.slug}`;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey) window.open(href, '_blank', 'noopener');
  else window.location.assign(href);
};

export default function CouncilCarousel({ bodyLabel = 'Advisory Council' }) {
  const [rows, setRows] = useState(null);      // null = still loading

  // The same request the council page makes.
  useEffect(() => {
    let live = true;
    fetch('/api/public/council', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (live) setRows(j?.ok ? (j.members || []) : []); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);

  if (rows === null) return (
    <div className="tnr-cc" data-loop="false" style={FONT} aria-hidden="true">
      <div className="tnr-cc-view">
        <div className="tnr-cc-track" style={{ justifyContent: 'flex-start' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="tnr-cc-item"><div className="tnr-cc-ghost"><i /><i /></div></div>
          ))}
        </div>
      </div>
      {/* Holds the height of the line under the row, so nothing below moves
          when the real one appears. */}
      <p className="tnr-cc-hint" style={{ visibility: 'hidden' }}>&nbsp;</p>
    </div>
  );

  if (!rows.some(m => m?.slug)) return (
    <EmptyState icon="🎓" title="Council profiles coming soon"
      message="Advisory Council profiles will appear here once published." />
  );

  return (
    <CardCarousel items={rows} label={`${bodyLabel} members`} noun="members" onOpen={openProfile}
      renderItem={(m, i, { near }) => (
        <CouncilRosterCard m={m} i={i} bodyLabel={bodyLabel} showProfession
          card={{ reveal: false, imageSizes: CAROUSEL_SIZES, eager: near }} />
      )} />
  );
}
