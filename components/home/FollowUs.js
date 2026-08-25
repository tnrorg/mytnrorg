'use client';
import { useCallback, useEffect, useState } from 'react';
import useRefreshOnFocus from '@/components/site/useRefreshOnFocus';
import { BRANDS, BrandGlyph } from '@/components/site/BrandMarks';
import { HEADER_DEFAULTS, normaliseUrl } from '@/lib/siteHeader';
import { COLORS, FONT } from '@/lib/design/tokens';

/* "Follow TNR" — the social channels, above the footer.
 *
 * The links come from Admin → Branding, which already stores them in
 * membership_settings and already serves them to the header. No new table, no
 * second admin screen: two places to edit the same Facebook URL is how a site
 * ends up advertising a page nobody maintains.
 *
 * Each channel renders ONLY when an admin has entered a link. An empty circle
 * for a platform TNR is not on invites a click that goes nowhere, and a row of
 * six greyed-out icons says less about the organisation than three live ones.
 */

/* Order is deliberate: WhatsApp first because it is where this community
 * actually is, then the platforms by how much TNR uses them. */
const ORDER = [
  ['whatsapp', 'social_whatsapp'],
  ['facebook', 'social_facebook'],
  ['instagram', 'social_instagram'],
  ['linkedin', 'social_linkedin'],
  ['twitter', 'social_twitter'],
  ['youtube', 'social_youtube'],
];

export default function FollowUs() {
  const [header, setHeader] = useState(HEADER_DEFAULTS);

  const load = useCallback(() => {
    fetch('/api/public/site-header', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j?.ok && j.header) setHeader(j.header); })
      .catch(() => { /* defaults already in state */ });
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);

  const live = ORDER
    .map(([brand, key]) => ({ brand, url: normaliseUrl(header[key] || '') }))
    .filter(x => x.url);

  // Nothing configured yet — the section does not exist rather than appearing
  // empty. Same rule as the news and opinions sections.
  if (!live.length) return null;

  return (
    <section className="w-full" style={FONT}>
      <div className="max-w-tnr-wide mx-auto px-4 pb-16">
        <div className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-12 text-center"
          style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>

          {/* The same faint dot field the page headers use, so this reads as
              part of the site rather than a widget dropped on the end. */}
          <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }} />

          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[.28em]"
              style={{ color: COLORS.gold400 }}>Stay Connected</div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white leading-tight">
              Follow Tehreek-e-Nojawanan Roundu
            </h2>
            <p className="mt-3 text-white/75 text-[14.5px] max-w-xl mx-auto leading-relaxed">
              Announcements, opportunities and the work of the committee — shared
              first on our channels.
            </p>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              {live.map(({ brand, url }) => {
                const b = BRANDS[brand];
                return (
                  <li key={brand}>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      aria-label={`TNR on ${b.label}`} title={b.label}
                      className="group flex flex-col items-center gap-2">
                      {/* The circle carries the platform's own colour. A row of
                          identical green circles would be tidy and would tell a
                          reader nothing — the colour IS the recognition. */}
                      <span
                        className="grid place-items-center w-14 h-14 sm:w-16 sm:h-16 rounded-full text-white
                          shadow-lg transition-transform duration-standard
                          group-hover:-translate-y-1 group-hover:scale-105"
                        style={{ background: b.brand }}>
                        <BrandGlyph name={brand} size={26} />
                      </span>
                      <span className="text-[11px] font-semibold text-white/60 group-hover:text-white/90 transition-colors">
                        {b.label}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
