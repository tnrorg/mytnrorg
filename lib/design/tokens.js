// ── TNR design tokens — the single source of truth ─────────────────────────
// The audit found 29 files each declaring their own `const C = { deep, green,
// gold }` and 31 redeclaring the Mulish font stack, with 91 hardcoded
// #063D2B literals. Import from here instead so a brand change is one edit.
//
// These mirror the CSS custom properties in globals.css and the Tailwind
// `tnr` palette, so the same value is available in JS, CSS and utilities.

export const COLORS = {
  green950: '#062D21',
  green900: '#0A3D2C',
  green800: '#0F5138',
  green700: '#176B49',
  gold500:  '#C89A2B',
  gold400:  '#D7AE4A',
  /* Gold dark enough to be READ on a light background.
   *
   * gold500 and gold400 are surface colours — rules, icons, and text on the
   * deep green panels, where they have plenty of contrast. Used as small text
   * on white they reach only 2.2:1, well under the 4.5:1 WCAG AA needs, and
   * that is most of what was costing the accessibility score.
   *
   * This one measures 6.18:1 on white and 5.38:1 on the pale gold wash the
   * leadership badge sits on, so it passes on both surfaces the brand uses.
   * Reach for it whenever gold is the colour of words rather than of a shape. */
  goldInk:  '#7A5D10',
  white:    '#FFFFFF',
  snow:     '#F8FAF8',
  neutral:  '#F1F4F2',
  charcoal: '#17211C',
  muted:    '#647169',
};

/** Legacy aliases — lets existing pages swap `const C = {...}` for one import
 *  without renaming every usage in the same commit. */
export const C = {
  deep:  COLORS.green900,
  green: COLORS.green700,
  gold:  COLORS.gold500,
  ink:   COLORS.charcoal,
  snow:  COLORS.snow,
  muted: COLORS.muted,
};

/** The Mulish stack, previously copy-pasted into 31 files. */
export const FONT = {
  fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif',
};

/**
 * A distinct colour per area, shared by the admin dashboard and the public
 * members analytics so a village is the same colour in both.
 *
 * Generated from the golden-angle hue sequence rather than a fixed palette:
 * with 20+ villages a hand-picked list repeats and neighbouring slices blur
 * together. Successive hues land far apart on the wheel (0°, 138°, 275° …).
 */
export const areaColor = (i) => {
  const hue = (i * 137.508) % 360;
  const light = 42 + (i % 3) * 8;   // vary lightness so hues repeat later still
  return `hsl(${hue.toFixed(1)} 52% ${light}%)`;
};

/** Chart palette: a forest-green ramp with gold reserved for "Other". */
export const CHART_GREENS = [
  '#062D21', '#0A3D2C', '#0F5138', '#176B49', '#1E8759',
  '#2A9C6C', '#4FB088', '#77C4A5', '#A2D7C2', '#C9E7DA',
];
export const CHART_OTHER = COLORS.gold500;

/** Motion durations from the spec — micro 120–180, standard 200–300,
 *  reveal 350–550ms. Kept here so components cannot drift. */
export const MOTION = {
  micro: 0.15,
  standard: 0.25,
  reveal: 0.7,
  ease: [0.22, 0.61, 0.36, 1],
  // Expo-out: most of the distance is covered immediately, then it eases to a
  // long stop. This is what reads as "expensive" — a linear-ish curve over the
  // same duration just looks slow.
  easeOut: [0.16, 1, 0.3, 1],
};

/** Section-reveal variants for Framer Motion, honouring reduced motion via
 *  the CSS media query in globals.css (transforms are cheap to disable).
 *
 *  The first version travelled 14px over 450ms, which was too small to
 *  register as motion at all — sections simply appeared. 32px with a slight
 *  scale gives the eye something to follow without the page feeling like it is
 *  assembling itself in front of the reader. */
/* 44px, not 32. The old distance was conservative enough that on a large
 * screen the reveal was over before the eye reached the section — which is
 * why the page read as "no animation" even though every section had one.
 * 44 is far enough to be felt and short enough not to look like the content
 * is being thrown at the reader. The scale start drops a shade with it, so
 * the two land together. */
export const revealUp = {
  hidden: { opacity: 0, y: 44, scale: 0.975 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: MOTION.reveal, ease: MOTION.easeOut },
  },
};
/* The same reveal, tuned for a phone.
 *
 * 18px rather than 32px, and 0.45s rather than 0.7s. On a narrow screen an
 * element covers far less distance before it is fully in view, so the desktop
 * travel reads as sluggish rather than elegant — and a phone is the likeliest
 * device to be doing this work on a slow CPU. The scale step is dropped
 * entirely: scaling a full-width block on a small screen is the effect most
 * likely to show as a shimmer on a cheap Android panel.
 *
 * Which of the two is used is decided by Reveal, from a single shared
 * matchMedia — see components/ui/Reveal.js. */
export const revealUpMobile = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: MOTION.easeOut },
  },
};

/** Stagger step for phones — see the note in RevealGroup. */
export const MOBILE_STAGGER = 0.045;

/* Image reveal: a photograph settling rather than sliding.
 *
 * 1.03 is deliberately small. A larger figure reads as a zoom effect, which
 * dates quickly and fights the hover zoom already on the leadership cards;
 * at 3% the eye registers the picture arriving without being able to name
 * what moved. Slower than a text reveal, because an image carries more and
 * a quick scale on a photograph looks like a rendering glitch.
 *
 * THE WRAPPER MUST CLIP. Scaling past 1 on a container holding a `fill`
 * image pushes the picture over its own rounded corner unless the parent
 * has overflow hidden.
 *
 * No scale at all on a phone: sub-pixel scaling of a photograph is the
 * effect most likely to shimmer on a cheap Android panel, and the gain on a
 * small screen is not worth that risk. Opacity alone still reads well. */
export const imageReveal = {
  hidden: { opacity: 0, scale: 1.03 },
  show: {
    opacity: 1, scale: 1,
    transition: { duration: 0.8, ease: MOTION.easeOut },
  },
};
export const imageRevealMobile = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.55, ease: MOTION.easeOut } },
};

/* Default gap raised from 0.06 to 0.10. Below about 0.08 a row of cards
 * reads as arriving together and the sequence is wasted; 0.10 is the point
 * where the eye tracks one card to the next without waiting on the last. */
export const staggerChildren = (gap = 0.10) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: 0.04 } },
});
