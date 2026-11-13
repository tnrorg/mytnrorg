'use client';
import HeroCarousel from './HeroCarousel';
import { FALLBACK_SLIDES } from '@/lib/heroSlides';

/* The built-in hero.
 *
 * It used to be a second, separate design — a light panel with a "What We
 * Stand For" card — that appeared only when no slide was published, so the
 * front page could change its whole look because a database table was empty.
 *
 * It is now the same carousel showing one built-in slide (lib/heroSlides.js).
 * HeroCarousel falls back to that slide on its own; this component remains for
 * anything that wants the default hero explicitly.
 */
export default function Hero() {
  return <HeroCarousel initialSlides={FALLBACK_SLIDES} />;
}
