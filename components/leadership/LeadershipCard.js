'use client';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { VerifiedBadge } from '@/components/ui';
import CountryFlag from '@/components/stats/CountryFlag';
import { COLORS, MOTION } from '@/lib/design/tokens';
import { initials } from '@/content/advisoryCouncil';

/* ── The TNR leadership card ──────────────────────────────────────────────────
 *
 * ONE CARD, EVERY ROSTER: Advisory Council, Central Executive Committee,
 * Country Ambassadors, University Ambassadors.
 *
 * It was built for the Advisory Council and lived inside CouncilDirectory as a
 * local function. Copying it into the executive card to match the styling
 * would have left two versions of a design with a hover outline, a gold sweep,
 * a measured type scale and a set of mobile breakpoints that took several
 * passes to get right — and the next fix would have landed in one of them.
 * So it moved here and both call sites render it.
 *
 * The card is a white frame around a tall portrait, not a photo with a text
 * block bolted under it. The name sits ON the photograph, on frosted glass —
 * which is what makes this read as a designed object rather than a database
 * row: there is one subject per card and the type belongs to it.
 *
 * `overflow-visible` on the shell, `overflow-hidden` on the portrait. The
 * frame has padding, so clipping at the outer edge would crop the padding
 * rather than the image and the rounded photo corners would never show.
 */
const shell = 'group relative flex flex-col rounded-[28px] bg-white p-1.5 sm:p-2.5 '
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
 * `photoPosition` on the record overrides it per member, for the handful
 * where a general rule will not do — a wide group shot cropped to one person,
 * say. The field is optional and nothing breaks when it is absent. */
const FOCUS_DEFAULT = '50% 20%';

/* ── The name plate ───────────────────────────────────────────────────────────
 *
 * Near-clear glass with a hairline, floating on the gradient, at every width —
 * so the photograph fills the card on a phone exactly as it does on a desktop.
 * Centred: the portrait behind it is centred, so left-aligned type sat
 * off-axis against the face.
 *
 * THE MOBILE SIZES ARE MEASURED, NOT CHOSEN, because the plate is the tightest
 * place on the card. Two cards across a 360px phone leaves each portrait 146px,
 * and the plate inside that is 138px — 130px of text once its padding is off,
 * and 118px for the name once the verified badge has its share. Every name on
 * the roster was typeset in the real Mulish face at 360, 375, 390, 412 and
 * 430px; the tightest, "Sayyed Zaman Haider" at 360, sets the numbers below
 * and clears them by 10.8px. That margin is the point — an earlier pass
 * cleared by 1px, which is not clearance at all: a device that hints the face
 * a shade wider would have cut a member's name in half.
 *
 * clamp() rather than a fixed size, because the card is itself a fraction of
 * the viewport: a size that fits 360px wastes the room a 430px phone has.
 *
 * line-clamp-1 below `sm`, line-clamp-2 above. One line each is what keeps the
 * plate from swallowing the face on a small card; from `sm` the card is 297px
 * and a long name can afford to wrap.
 */
function Identity({ name, role, verified }) {
  return (
    <div className="absolute inset-x-1 bottom-1 rounded-xl px-1 py-1.5 text-center backdrop-blur-md
      sm:inset-x-3 sm:bottom-3 sm:rounded-2xl sm:px-4 sm:py-3.5"
      style={{ background: 'rgba(255,255,255,.07)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.16)' }}>
      {/* min-w-0 on the text, shrink-0 on the badge (the badge carries its own).
          A flex child defaults to min-width:auto, so its min-content width —
          the longest unbreakable run of the name — wins over the clamp and
          pushes the plate wider than the photograph. min-w-0 lets it actually
          shrink and the line-clamp do its job. */}
      <h3 className="flex items-center justify-center gap-0.5 text-[clamp(10px,2.8vw,13px)]
        font-bold leading-tight text-white sm:items-start sm:gap-1.5 sm:text-[20px]">
        <span className="min-w-0 line-clamp-1 sm:line-clamp-2">{name}</span>
        {/* One badge, resized by CSS. A class beats the SVG's width/height
            attribute, so this is 10px on a phone and 14px from `sm` without a
            second element that a screen reader could announce twice.

            Only on a filled seat: a vacant post is not a verified person, and
            badging "To Be Announced" would be claiming somebody exists. */}
        {verified && <VerifiedBadge className="h-2.5 w-2.5 sm:mt-[3px] sm:h-3.5 sm:w-3.5" />}
      </h3>
      {role && (
        <p className="mt-0.5 line-clamp-1 text-[clamp(9px,2.4vw,11.5px)] font-medium leading-snug
          sm:mt-1 sm:line-clamp-2 sm:text-[14px]"
          style={{ color: '#BFE3D1' }}>
          {role}
        </p>
      )}
    </div>
  );
}

/**
 * @param index        position in the roster, for the corner number
 * @param slug         unique within the page — the hover gradient keys off it
 * @param bodyLabel    the chip: which roster this card belongs to
 * @param name         already trimmed by the caller
 * @param role         the office, or the profession when there is no office
 * @param photoUrl     null falls back to a monogram on a green field
 * @param photoPosition  CSS object-position, when the default crop is wrong
 * @param monogram     overrides the initials taken from the name
 * @param meta         strings for the line under the portrait, joined with ·
 * @param metaFlagCode ISO 3166-1 alpha-2, when the meta line is a country
 * @param href         where the button goes
 * @param cta          the button's wording
 * @param verified     false for an unfilled seat
 */
export default function LeadershipCard({
  index = 0, slug, bodyLabel, name, role,
  photoUrl, photoPosition, monogram,
  meta = [], metaFlagCode = '',
  href, cta = 'View profile', verified = true,
}) {
  const metaLine = meta.filter(Boolean).join(' · ');

  return (
    <motion.article className={shell}
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ duration: MOTION.reveal, delay: Math.min(index * 0.04, 0.3), ease: MOTION.ease }}>

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
          <linearGradient id={`tnr-outline-${slug}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.green700} />
            <stop offset="55%" stopColor={COLORS.gold500} />
            <stop offset="100%" stopColor={COLORS.gold400} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" rx="27" ry="27" fill="none"
          stroke={`url(#tnr-outline-${slug})`} strokeWidth="2" pathLength="100"
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
        {photoUrl ? (
          <Image src={photoUrl} alt={name} fill
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
            style={{ objectPosition: photoPosition || FOCUS_DEFAULT }} />
        ) : (
          <div role="img" aria-label={name}
            className="grid h-full w-full place-items-center text-4xl font-extrabold text-white"
            style={{ background: `linear-gradient(140deg,${COLORS.green700},${COLORS.green950})` }}>
            <span aria-hidden="true">{monogram || initials(name || '')}</span>
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

        {/* inset matched to the name plate's, so the two float on the same
            margin rather than on two slightly different ones. */}
        <div className="absolute inset-x-1 top-1 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          {/* The BODY, on every card — the way the reference stamps its team
              name on all four.

              Small on a phone — 8.5px against the plate's 10px name, so it
              reads as the quiet stamp it is rather than competing with the
              person. Callers pass a SHORT label: the plate has about 112px at
              360px, so "Central Executive Committee" would be clipped where
              "Executive Committee" is not. */}
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full px-1.5 py-0.5
            text-[8.5px] font-semibold backdrop-blur-md sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11px]"
            style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)' }}>
            <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5"
              style={{ background: COLORS.gold400 }} />
            <span className="min-w-0 truncate">{bodyLabel}</span>
          </span>

          {/* A white pill with TNR green type, as the reference does it —
              not white-on-translucent, which disappears over a pale photo.
              Decorative: it is a position in a roster, not part of the
              person's name, so it stays out of the accessibility tree.

              AND IT IS THE FIRST THING TO GO BELOW `sm`. The 29px it takes,
              plus its gap, was what pushed "Advisory Council" into reading
              "Advisory Coun…" on a phone. Between a sequence number that
              carries no information and the name of the body the person
              serves on, the 138px goes to the body. */}
          <span aria-hidden="true"
            className="hidden shrink-0 rounded-full px-2 py-1 text-[11px] font-bold tabular-nums sm:inline-block sm:px-2.5"
            style={{ background: 'rgba(255,255,255,.9)', color: COLORS.green700 }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <Identity name={name} role={role} verified={verified} />
      </div>

      {/* ── Below the portrait ──
          Where the reference puts "PROFILE COMING SOON", TNR has something
          true to say instead: where this person actually works, or which
          country or campus they cover. A status line that never changes is
          decoration; this is the thing a visitor is scanning the roster for. */}
      <div className="flex flex-1 flex-col px-1 pt-2 sm:pt-3">
        {!!metaLine && (
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.1em] sm:text-[10px]"
            style={{ color: COLORS.muted }}>
            {/* A flag where the line is a country, the green dot otherwise.
                Not an emoji flag: Windows ships no flag glyphs at all, so 🇵🇱
                renders there as the bare letters "PL". */}
            {metaFlagCode
              ? <CountryFlag code={metaFlagCode} size={9} />
              : <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: COLORS.green700 }} />}
            {/* min-w-0, same reason as the name plate. A long employer —
                "Planning and Development Department, Gilgit-Baltistan" — was
                setting this card's minimum width and making its column wider
                than its neighbours', which is what broke the row. */}
            <span className="min-w-0 line-clamp-1">{metaLine}</span>
          </p>
        )}

        {/* mt-auto pushes the button to the foot so every one in the row lines
            up; pt-2.5 keeps a gap above it on the card with no meta line. */}
        <div className="mt-auto pt-2.5 sm:pt-3">
          <a href={href}
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

            <span className="truncate">{cta}</span>
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
