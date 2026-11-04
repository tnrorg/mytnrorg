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
const shell = 'group relative flex flex-col rounded-2xl bg-white p-2.5 '
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

function Card({ m, i }) {
  const meta = [m.organisation || m.affiliation, m.country].filter(Boolean);
  const role = m.profession || academicTitle(m.qualification, m.field);

  return (
    <motion.article className={shell}
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: MOTION.reveal, delay: Math.min(i * 0.04, 0.3), ease: MOTION.ease }}>

      {/* ── Portrait ──
          3:4, not 4:3. A person is taller than they are wide, and the frosted
          plate below needs room to sit over the photograph without covering
          the face — which a landscape crop does not have. */}
      <div className="relative aspect-[3/4] shrink-0 overflow-hidden rounded-xl bg-[#EEF2F0]">
        {m.photo_url ? (
          <Image src={m.photo_url} alt={m.name} fill
            /* Must track the column count exactly: 2 up to md, 3 to lg, 4
               above. Without it the browser assumes full width and downloads
               a 1440px portrait for a card that renders at 165px on a phone.
               A `sizes` that disagrees with the grid is worse than none — it
               confidently fetches the wrong file. */
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
            className="object-cover transition-transform duration-[450ms] ease-out
              group-hover:scale-[1.05]"
            style={{ objectPosition: m.photo_position || FOCUS_DEFAULT }} />
        ) : (
          <div role="img" aria-label={m.name}
            className="grid h-full w-full place-items-center text-4xl font-extrabold text-white"
            style={{ background: `linear-gradient(140deg,${COLORS.green700},${COLORS.green950})` }}>
            <span aria-hidden="true">{initials(m.name || '')}</span>
          </div>
        )}

        {/* A wash from the foot of the photograph upward.
            The frosted plate alone is not enough: on a pale background —
            a white wall, a bright sky — translucent glass over light pixels
            leaves white type on near-white, and the name disappears. This
            guarantees something dark under it whatever the photograph. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          style={{ background: 'linear-gradient(to top, rgba(4,26,19,.78), transparent)' }} />

        {m.designation && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] backdrop-blur-md"
            style={{ background: 'rgba(4,26,19,.55)', color: '#fff' }}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full"
              style={{ background: COLORS.gold400 }} />
            <span className="truncate max-w-[88px] sm:max-w-[120px]">{m.designation}</span>
          </span>
        )}

        {/* The index, as on the reference. Decorative only — it is the
            position in the roster, so it is hidden from screen readers rather
            than read out as part of the person's name. */}
        <span aria-hidden="true"
          className="absolute right-2 top-2 rounded-full px-2 py-1 text-[9.5px] font-bold tabular-nums backdrop-blur-md"
          style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}>
          {String(i + 1).padStart(2, '0')}
        </span>

        {/* ── The name plate ──
            Inside the photograph, on frosted glass. */}
        <div className="absolute inset-x-2 bottom-2 rounded-xl px-2.5 py-2 backdrop-blur-md sm:px-3 sm:py-2.5"
          style={{ background: 'rgba(10,61,44,.52)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)' }}>
          {/* min-w-0 on the text, shrink-0 on the badge.
              A flex child defaults to min-width:auto, so its min-content width
              — the longest unbreakable run of the name — wins over the clamp
              and pushes the plate wider than the photograph. min-w-0 lets it
              actually shrink and the line-clamp do its job. */}
          <h3 className="flex items-start gap-1 text-[13px] font-bold leading-tight text-white sm:text-[15.5px]">
            <span className="min-w-0 line-clamp-2">{m.name}</span>
            <VerifiedBadge size={13} className="mt-[2px] shrink-0" />
          </h3>
          {role && (
            <p className="mt-0.5 text-[10.5px] leading-snug line-clamp-1 sm:text-[12px]"
              style={{ color: 'rgba(255,255,255,.76)' }}>
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
            className="group/btn flex items-center justify-between gap-2 rounded-full py-1.5 pl-3.5 pr-1.5
              text-[11.5px] font-bold text-white transition-colors duration-standard sm:text-[12.5px]"
            style={{ background: `linear-gradient(135deg,${COLORS.green700},${COLORS.green900})` }}>
            <span className="truncate">View profile</span>
            {/* The arrow in its own disc, as on the reference. It is the
                detail that makes the button look considered rather than
                default. */}
            <span aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full transition-transform
                duration-standard group-hover/btn:translate-x-[2px] sm:h-7 sm:w-7"
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
    /* The skeleton has to stand at roughly the height the real card settles
       at — a 3:4 portrait plus the status line and the button — or the page
       jumps when the roster lands, which is the layout shift this placeholder
       exists to prevent in the first place. */
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: limit || 8 }).map((_, i) => <Skeleton key={i} height="h-[26rem]" />)}
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
