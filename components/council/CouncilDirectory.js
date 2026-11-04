'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Search, ArrowRight, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Skeleton, EmptyState, VerifiedBadge } from '@/components/ui';
import { COLORS, FONT, MOTION } from '@/lib/design/tokens';
import { initials } from '@/content/advisoryCouncil';
import { academicTitle } from '@/lib/membership/options';

/* The card is a white frame around a tall portrait, not a photo with a text
 * block bolted under it. The name sits ON the photograph, on frosted glass —
 * which is what makes this read as a designed object rather than a database
 * row: there is one subject per card and the type belongs to it.
 *
 * `overflow-visible` on the shell, `overflow-hidden` on the portrait. The
 * frame has padding, so clipping at the outer edge would crop the padding
 * rather than the image and the rounded photo corners would never show. */
const shell = 'group relative flex flex-col rounded-[28px] bg-white p-2.5 '
  + 'shadow-[0_1px_2px_rgba(23,33,28,.05)] '
  + 'transition-[transform,box-shadow] duration-standard ease-out '
  + 'hover:-translate-y-[5px] hover:shadow-[0_14px_34px_-12px_rgba(10,61,44,.30)]';

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

function Card({ m, i, bodyLabel }) {
  const meta = [m.organisation || m.affiliation, m.country].filter(Boolean);
  /* The office outranks the day job on a leadership card.
   *
   * "Convener" tells a visitor what this person does FOR TNR, which is the
   * question the roster exists to answer; "Senior Research Officer" is who
   * they are elsewhere. Both are on the profile page — only one fits here,
   * and when someone holds an office it is that one. */
  const role = m.designation || m.profession || academicTitle(m.qualification, m.field);

  return (
    <motion.article className={shell}
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: MOTION.reveal, delay: Math.min(i * 0.04, 0.3), ease: MOTION.ease }}>

      {/* ── The outline, drawn on hover ──
          An SVG rectangle whose stroke is dashed to exactly its own length and
          offset out of sight, then pulled back to zero — so the line appears
          to travel around the card rather than simply fading in.
          `pathLength="100"` is what makes that work without knowing the card's
          pixel size: it renormalises the geometry so a dash of 100 is always
          precisely one full lap, at any width, in any column count.
          Green into gold, the two brand colours, so the stroke changes
          character as it travels. The gradient id carries the slug because two
          cards sharing one id means the second silently inherits the first. */}
      <svg aria-hidden="true" focusable="false"
        className="pointer-events-none absolute inset-[1px] h-[calc(100%-2px)] w-[calc(100%-2px)] overflow-visible">
        <defs>
          <linearGradient id={`tnr-outline-${m.slug}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.green700} />
            <stop offset="55%" stopColor={COLORS.gold500} />
            <stop offset="100%" stopColor={COLORS.gold400} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" rx="27" ry="27" fill="none"
          stroke={`url(#tnr-outline-${m.slug})`} strokeWidth="2" pathLength="100"
          className="[stroke-dasharray:100] [stroke-dashoffset:100]
            transition-[stroke-dashoffset] duration-[900ms] ease-out
            group-hover:[stroke-dashoffset:0]" />
      </svg>


      {/* ── Portrait ──
          4:5, and a 22px radius inside a 28px frame — the measurements the
          reference actually uses, read off the live page rather than guessed
          from a screenshot. A 10px frame around a 22px photo is what gives
          the concentric, machined look; mismatched radii read as a mistake. */}
      <div className="relative aspect-[4/5] shrink-0 overflow-hidden rounded-[22px] bg-[#EEF2F0]">
        {m.photo_url ? (
          <Image src={m.photo_url} alt={m.name} fill
            /* Must track the column count exactly: 2 up to md, 3 to lg, 4
               above. Without it the browser assumes full width and downloads
               a 1440px portrait for a card that renders at 165px on a phone.
               A `sizes` that disagrees with the grid is worse than none — it
               confidently fetches the wrong file. */
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
            /* 1.2s, not 250ms. A slow, long zoom is most of why the reference
               feels expensive — a quick snap reads as a hover state, a drift
               reads as the photograph being alive. */
            className="object-cover transition-[scale] duration-[1200ms] ease-out
              group-hover:scale-[1.06]"
            style={{ objectPosition: m.photo_position || FOCUS_DEFAULT }} />
        ) : (
          <div role="img" aria-label={m.name}
            className="grid h-full w-full place-items-center text-4xl font-extrabold text-white"
            style={{ background: `linear-gradient(140deg,${COLORS.green700},${COLORS.green950})` }}>
            <span aria-hidden="true">{initials(m.name || '')}</span>
          </div>
        )}

        {/* Two thirds of the photograph, not the bottom fifth.
            The reference leans on this gradient rather than on a dark plate —
            its name panel is only white/0.07, almost clear glass. That is why
            the photograph still reads as a photograph under the type. A tall,
            soft wash does the contrast work invisibly; a short hard one looks
            like a band stuck across the picture. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: 'linear-gradient(to top, rgba(4,26,19,.82), rgba(4,26,19,.35) 45%, transparent)' }} />

        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          {/* The BODY, on every card — the way the reference stamps its team
              name on all four. This slot was wired to m.designation, which
              most advisory members do not have, so most cards showed an empty
              corner. A chip that appears on some cards and not others is not
              a brand mark, it is a gap. */}
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold backdrop-blur-md sm:px-2.5 sm:text-[11px]"
            style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)' }}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: COLORS.gold400 }} />
            <span className="min-w-0 truncate">{bodyLabel}</span>
          </span>

          {/* A white pill with TNR green type, as the reference does it —
              not white-on-translucent, which disappears over a pale photo.
              Decorative: it is a position in a roster, not part of the
              person's name, so it stays out of the accessibility tree. */}
          <span aria-hidden="true"
            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold tabular-nums sm:px-2.5"
            style={{ background: 'rgba(255,255,255,.9)', color: COLORS.green700 }}>
            {String(i + 1).padStart(2, '0')}
          </span>
        </div>

        {/* ── The name plate ──
            Near-clear glass with a hairline, floating on the gradient.
            Centred: the portrait behind it is centred, so left-aligned type
            sat off-axis against the face. */}
        <div className="absolute inset-x-2.5 bottom-2.5 rounded-2xl px-3 py-2.5 text-center backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:px-4 sm:py-3.5"
          style={{ background: 'rgba(255,255,255,.07)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.16)' }}>
          {/* min-w-0 on the text, shrink-0 on the badge.
              A flex child defaults to min-width:auto, so its min-content width
              — the longest unbreakable run of the name — wins over the clamp
              and pushes the plate wider than the photograph. min-w-0 lets it
              actually shrink and the line-clamp do its job. */}
          <h3 className="flex items-start justify-center gap-1.5 text-[15px] font-bold leading-tight text-white sm:text-[20px]">
            <span className="min-w-0 line-clamp-2">{m.name}</span>
            <VerifiedBadge size={14} className="mt-[3px] shrink-0" />
          </h3>
          {role && (
            <p className="mt-1 text-[11.5px] font-medium leading-snug line-clamp-2 sm:text-[14px]"
              style={{ color: '#BFE3D1' }}>
              {role}
            </p>
          )}
        </div>
      </div>

      {/* ── Below the portrait ──
          Where the reference puts "PROFILE COMING SOON", TNR has something
          true to say instead: where this person actually works. A status line
          that never changes is decoration; the employer is the thing a
          visitor is scanning the roster for. */}
      <div className="flex flex-1 flex-col px-1 pt-2.5 sm:pt-3">
        {!!meta.length && (
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.1em] sm:text-[10px]"
            style={{ color: COLORS.muted }}>
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: COLORS.green700 }} />
            {/* min-w-0, same reason as the name plate. A long employer —
                "Planning and Development Department, Gilgit-Baltistan" — was
                setting this card's minimum width and making its column wider
                than its neighbours', which is what broke the row. */}
            <span className="min-w-0 line-clamp-1">{meta.join(' · ')}</span>
          </p>
        )}

        {/* mt-auto pushes the button to the foot so every one in the row lines
            up; pt-2.5 keeps a gap above it on the card with no employer. */}
        <div className="mt-auto pt-2.5 sm:pt-3">
          <a href={`/council/${m.slug}`}
            className="group/btn relative isolate flex items-center justify-between gap-2 overflow-hidden
              rounded-full py-1.5 pl-3.5 pr-1.5 text-[11.5px] font-bold text-white
              transition-colors duration-500 group-hover/btn:text-[#0A3D2C] sm:text-[12.5px]"
            style={{ background: `linear-gradient(135deg,${COLORS.green700},${COLORS.green900})` }}>
            {/* Gold, wiping in from the left.
                scaleX from a left origin rather than a background-position
                slide: a transform runs on the compositor, so it stays smooth
                with twelve of these on screen, and it cannot be knocked out
                of step by the card's own transition. */}
            <span aria-hidden="true"
              className="absolute inset-0 -z-10 origin-left scale-x-0 rounded-full
                transition-transform duration-500 ease-out group-hover/btn:scale-x-100"
              style={{ background: `linear-gradient(90deg,${COLORS.gold500},${COLORS.gold400})` }} />

            <span className="truncate">View profile</span>
            {/* The arrow in its own disc, as on the reference. Its wash flips
                from white-on-green to green-on-gold, because a white veil over
                gold all but disappears. */}
            <span aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-all
                duration-500 group-hover/btn:translate-x-[2px] group-hover/btn:bg-[rgba(10,61,44,.22)] sm:h-7 sm:w-7"
              style={{ background: 'rgba(255,255,255,.18)' }}>
              <ArrowRight size={12} strokeWidth={2.75} />
            </span>
          </a>
        </div>
      </div>
    </motion.article>
  );
}

/** Council roster with search and filters. `limit` renders a homepage preview. */
/**
 * Council roster with search and filters. `limit` renders a homepage preview.
 *
 * `bodyLabel` is the chip stamped on every card. It defaults to Advisory
 * Council because that is the only body this endpoint serves today — but it
 * is a prop, not a hardcoded string, so pointing the component at another
 * roster later does not mean every card quietly mislabelling itself.
 */
export default function CouncilDirectory({
  limit, showFilters = true, bodyLabel = 'Advisory Council',
}) {
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
    /* The skeleton has to stand at roughly the height the real card settles
       at — a 4:5 portrait, 10px of frame either side, the status line and the
       button — or the page jumps when the roster lands, which is the layout
       shift this placeholder exists to prevent in the first place. */
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: limit || 8 }).map((_, i) => <Skeleton key={i} height="h-[25rem]" />)}
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
          {members.map((m, i) => <Card key={m.slug} m={m} i={i} bodyLabel={bodyLabel} />)}
        </div>
      )}
    </div>
  );
}
