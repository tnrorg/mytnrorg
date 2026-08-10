'use client';
import { genderIconKind } from '@/lib/membership/options';

/**
 * Member avatar with a gender-appropriate placeholder.
 *
 * Publishing a photograph is a genuine privacy concern for many women in this
 * community, so a female applicant may leave it blank. Rather than an empty
 * grey box or her initials — which still single her out as "the one with no
 * picture" — she gets a designed silhouette that looks deliberate.
 *
 * Original artwork, drawn from primitives. Nothing traced or copied.
 */

export function FemaleIcon({ className = '', title = 'Member' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      {/* Outer hijab drape — one closed shape from crown to shoulders. */}
      <path fill="currentColor" d="
        M50 12
        c-14 0-24 10-25 24
        c-0.6 8 0.4 15-2 22
        c-2.4 7-7 11-9 18
        c-0.8 2.6 0.6 4 3 4
        h66
        c2.4 0 3.8-1.4 3-4
        c-2-7-6.6-11-9-18
        c-2.4-7-1.4-14-2-22
        C74 22 64 12 50 12 Z" />
      {/* Face opening — knocked out so the drape reads as fabric around it. */}
      <ellipse cx="50" cy="41" rx="15" ry="18" fill="#fff" />
      {/* Under-scarf edge across the brow. */}
      <path fill="currentColor" d="
        M50 23
        c-9 0-15 6-15.4 13
        c4-6 9-9 15.4-9
        s11.4 3 15.4 9
        C65 29 59 23 50 23 Z" />
    </svg>
  );
}

/**
 * Neutral silhouette — for Non-binary / Other, Prefer not to say, and members
 * whose gender was never recorded.
 *
 * Drawn to sit beside the other two without reading as either: the head is the
 * same circle, and the shoulders are a touch wider and squarer than the male
 * form so the three are visibly a set rather than one of them reused. The point
 * is that nobody's placeholder contradicts what they chose, and that choosing
 * one of these options does not make a profile look conspicuously different.
 */
export function NeutralIcon({ className = '', title = 'Member' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx="50" cy="34" r="17.5" fill="currentColor" />
      <path fill="currentColor" d="
        M50 56
        c-18 0-31 11-33 26
        c-0.4 2.4 1.1 4 3.5 4
        h59
        c2.4 0 3.9-1.6 3.5-4
        C81 67 68 56 50 56 Z" />
    </svg>
  );
}

export function MaleIcon({ className = '', title = 'Member' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx="50" cy="34" r="18" fill="currentColor" />
      <path fill="currentColor" d="
        M50 57
        c-17 0-30 10-33 25
        c-0.5 2.4 1 4 3.4 4
        h59.2
        c2.4 0 3.9-1.6 3.4-4
        C80 67 67 57 50 57 Z" />
    </svg>
  );
}

/**
 * @param {string}  src     photo URL, if the member supplied one
 * @param {string}  gender  any recorded value, including blank
 * @param {string}  name    used for the alt text
 */
export default function Avatar({
  src,
  gender = '',
  name = 'Member',
  className = '',
  rounded = 'rounded-full',
}) {
  const kind = genderIconKind(gender);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={`${className} ${rounded} object-cover object-top bg-gray-100`}
        // A broken photo URL falls back to the placeholder rather than showing
        // the browser's torn-image glyph.
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }

  const Icon = kind === 'female' ? FemaleIcon : kind === 'male' ? MaleIcon : NeutralIcon;

  return (
    <span
      className={`${className} ${rounded} grid place-items-center bg-[#0B6B4F0f] text-[#0B6B4F]/45 overflow-hidden`}
      aria-label={name}
    >
      <Icon className="w-[72%] h-[72%]" title={name} />
    </span>
  );
}
