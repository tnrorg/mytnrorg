'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Search, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton, EmptyState, VerifiedBadge } from '@/components/ui';
import { COLORS, FONT, MOTION } from '@/lib/design/tokens';
import { initials } from '@/content/advisoryCouncil';
import { academicTitle } from '@/lib/membership/options';

/* 14px, not the 20px `rounded-tnr-lg` this used to carry. A directory of
 * small portrait cards reads as softer and less institutional the rounder it
 * gets; 14px is the radius the rest of the system uses for controls. */
const shell = 'group relative flex flex-col overflow-hidden rounded-tnr bg-white '
  + 'border border-[rgba(23,33,28,.09)] shadow-tnr-flat '
  + 'transition-[transform,box-shadow,border-color] duration-standard ease-out '
  + 'hover:-translate-y-[5px] hover:shadow-tnr-raise hover:border-[rgba(200,154,43,.55)] '
  + 'focus-within:border-[rgba(200,154,43,.55)]';

/* Where the face sits in the frame.
 *
 * Every portrait used to be pinned with `object-top` — object-position 50% 0%.
 * That is right only for photographs where the subject is high in the frame,
 * and most of these are centred, so the top of the head got the space and the
 * chin was cut. 20% down is the standard framing for a headshot crop: it
 * keeps the eyes on the upper third and leaves the jaw inside the frame.
 *
 * `photo_position` on the record overrides it per member, for the handful
 * where a general rule will not do — a wide group shot cropped to one person,
 * say. The field is optional and nothing breaks when it is absent, so no
 * migration is needed to start using this; set it when a face needs it. */
const FOCUS_DEFAULT = '50% 20%';

function Card({ m, i }) {
  const meta = [m.organisation || m.affiliation, m.country].filter(Boolean);
  const role = m.profession || academicTitle(m.qualification, m.field);

  return (
    <motion.article className={shell}
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: MOTION.reveal, delay: Math.min(i * 0.04, 0.3), ease: MOTION.ease }}>

      {/* ── Portrait ──
          One container, one aspect ratio, one height for every card in the
          row — whatever the source image's own proportions are. */}
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-[#EEF2F0]">
        {m.photo_url ? (
          <Image src={m.photo_url} alt={m.name} fill
            /* Must track the column count exactly: 2 up to md, 3 to lg, 4
               above. Without it the browser assumes full width and downloads
               a 1440px portrait for a card that renders at 165px on a phone.
               A `sizes` that disagrees with the grid is worse than none — it
               confidently fetches the wrong file. */
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
            className="object-cover transition-transform duration-standard ease-out
              group-hover:scale-[1.03]"
            style={{ objectPosition: m.photo_position || FOCUS_DEFAULT }} />
        ) : (
          <div role="img" aria-label={m.name}
            className="grid h-full w-full place-items-center text-4xl font-extrabold text-white"
            style={{ background: `linear-gradient(140deg,${COLORS.green700},${COLORS.green950})` }}>
            <span aria-hidden="true">{initials(m.name || '')}</span>
          </div>
        )}

        {m.designation && (
          <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm"
            style={{ background: 'rgba(6,45,33,.78)', color: COLORS.gold400 }}>
            {m.designation}
          </span>
        )}
      </div>

      {/* ── Details ──
          min-h rather than fixed h on each row. Fixed heights kept the buttons
          aligned but clipped any name or employer that ran long — the page was
          tidy at the cost of being wrong about people. min-h holds the rhythm
          when the text is short; line-clamp holds it when the text is long;
          mt-auto on the button keeps every call to action on the same line
          either way. */}
      {/* Two cards across a 360px phone leaves about 165px each, so the
          smallest size gets tighter padding and a step down in type. Without
          it the name wraps to three lines and the card stops looking designed.
          Everything returns to the full scale from `sm` up. */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="flex items-start gap-1 sm:gap-1.5 text-[13.5px] sm:text-[16px] font-bold leading-snug"
          style={{ color: COLORS.green900 }}>
          <span className="line-clamp-2 sm:line-clamp-1">{m.name}</span>
          {/* ONE badge, not a small one and a large one behind breakpoint
              classes. Two would both sit in the DOM and a screen reader would
              announce "Verified member" twice on every card — a visual tidy
              paid for with an audible stutter. 14px reads correctly against
              both the 13.5px phone name and the 16px desktop one. */}
          <VerifiedBadge size={14} />
        </h3>

        {role && (
          <p className="mt-1 text-[11.5px] sm:text-[13px] font-medium leading-snug line-clamp-2 sm:line-clamp-1"
            style={{ color: COLORS.green700 }}>
            {role}
          </p>
        )}

        {!!meta.length && (
          <p className="mt-0.5 text-[10.5px] sm:text-[12px] leading-snug line-clamp-2"
            style={{ color: COLORS.muted }}>
            {meta.join(' · ')}
          </p>
        )}

        {/* Only when there is something to say. An empty reserved block on the
            members who have not written an introduction is whitespace that
            looks like a loading failure.

            Hidden below `sm`: at 165px wide two lines of 12px biography is a
            grey smudge nobody reads, and it pushes the button off the fold. */}
        {m.intro && (
          <p className="mt-2 hidden sm:line-clamp-2 text-[12.5px] leading-relaxed"
            style={{ color: COLORS.muted }}>
            {m.intro}
          </p>
        )}

        {/* One tag on a phone, two from `sm`. Two 10px pills side by side do
            not fit 165px without wrapping into a second row. */}
        {!!(m.expertise || []).length && (
          <div className="mt-2 sm:mt-2.5 flex flex-wrap gap-1 sm:gap-1.5 overflow-hidden">
            {m.expertise.slice(0, 1).map(e => (
              <span key={e} className="rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[10.5px] font-semibold truncate max-w-full"
                style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>{e}</span>
            ))}
            {m.expertise.slice(1, 2).map(e => (
              <span key={e} className="hidden sm:inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>{e}</span>
            ))}
            {m.expertise.length > 2 && (
              <span className="hidden sm:inline px-1 py-0.5 text-[10.5px]" style={{ color: COLORS.muted }}>
                +{m.expertise.length - 2}
              </span>
            )}
          </div>
        )}

        {/* The wrapper carries BOTH jobs, because the button cannot.
            `mt-auto` pushes it to the foot of the card so every button in the
            row lines up; `pt-4` guarantees a gap above it on the shortest
            card. Putting both on the <a> itself meant two conflicting margin
            utilities on one element, where whichever Tailwind emitted last
            silently won. */}
        <div className="mt-auto pt-4">
          {/* No focus utilities here on purpose: globals.css already gives
              every :focus-visible a 2px gold outline, and .tnr-btn-profile
              has its own keyboard treatment. Adding Tailwind's outline
              classes on top would set a width with no colour and fight the
              rule that is already right. */}
          <a href={`/council/${m.slug}`}
            className="tnr-btn-profile block rounded-[10px] py-2.5 text-center text-[12.5px] font-bold text-white"
            style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
            <span className="inline-flex items-center gap-1.5">
              View Full Profile
              <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" className="tnr-btn-arrow" />
            </span>
          </a>
        </div>
      </div>
    </motion.article>
  );
}

/** Council roster with search and filters. `limit` renders a homepage preview. */
export default function CouncilDirectory({ limit, showFilters = true }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState({ q: '', country: '', profession: '', expertise: '' });
  const [openFilters, setOpenFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/public/council?' + new URLSearchParams(f), { cache: 'no-store' })
        .then(r => r.json()).then(j => j?.ok && setD(j)).catch(() => setD({ members: [], filters: {} }));
    }, 200);
    return () => clearTimeout(t);
  }, [f]);

  const members = useMemo(
    () => (limit ? (d?.members || []).slice(0, limit) : d?.members || []), [d, limit]);
  const active = Object.entries(f).filter(([k, v]) => k !== 'q' && v).length;
  const sel = 'rounded-tnr border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#176B49] bg-white';

  if (!d) return (
    /* h-96, not h-80. The skeleton has to stand at roughly the height the real
       card settles at — a 4:3 portrait plus its details block — or the page
       jumps when the roster lands, which is the layout shift this placeholder
       exists to prevent in the first place. */
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: limit || 8 }).map((_, i) => <Skeleton key={i} height="h-96" />)}
    </div>
  );

  return (
    <div style={FONT}>
      {showFilters && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} strokeWidth={2.2} aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
              <input value={f.q} onChange={e => setF(s => ({ ...s, q: e.target.value }))}
                aria-label="Search council members"
                placeholder="Search by name, profession, expertise, organisation or country"
                className={sel + ' w-full pl-10'} />
            </div>
            <button onClick={() => setOpenFilters(o => !o)}
              className="sm:hidden inline-flex items-center gap-1.5 rounded-tnr px-4 text-sm font-bold text-white shrink-0"
              style={{ background: COLORS.green700 }}>
              <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />
              {active > 0 && <span>{active}</span>}
            </button>
          </div>

          <div className={`${openFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2`}>
            {[['country', 'All Countries', 'countries'],
              ['profession', 'All Professions', 'professions'],
              ['expertise', 'All Expertise', 'expertise']].map(([key, label, list]) => (
              <select key={key} value={f[key]} aria-label={label} className={sel}
                onChange={e => setF(s => ({ ...s, [key]: e.target.value }))}>
                <option value="">{label}</option>
                {(d.filters?.[list] || []).map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            ))}
          </div>

          {(active > 0 || f.q) && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[12px]" style={{ color: COLORS.muted }}>
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
              <button onClick={() => setF({ q: '', country: '', profession: '', expertise: '' })}
                className="text-[12px] font-bold underline" style={{ color: COLORS.green700 }}>Clear</button>
            </div>
          )}
        </>
      )}

      {members.length === 0 ? (
        <EmptyState className="mt-6" icon="🎓"
          title={f.q || active ? 'No members match your search' : 'Council profiles coming soon'}
          message={f.q || active
            ? 'Try a different name, profession or country.'
            : 'Advisory Council profiles will appear here once published.'} />
      ) : (
        <div className={`${showFilters ? 'mt-6' : ''} grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5`}>
          {members.map((m, i) => <Card key={m.slug} m={m} i={i} />)}
        </div>
      )}
    </div>
  );
}
