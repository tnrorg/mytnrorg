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
export const revealUp = {
  hidden: { opacity: 0, y: 32, scale: 0.985 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: MOTION.reveal, ease: MOTION.easeOut },
  },
};
export const staggerChildren = (gap = 0.09) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: 0.04 } },
});
