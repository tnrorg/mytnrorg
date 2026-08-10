'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Hero from './Hero';
import Image from 'next/image';
import { COLORS, FONT, MOTION } from '@/lib/design/tokens';

const DURATION = 6500;   // ms a slide stays before advancing

/* Admin-managed hero carousel.
 *
 * Everything visible here — image, wording, buttons, overlay strength and the
 * phone/desktop font sizes — comes from the hero_slides table. Nothing is
 * hardcoded.
 *
 * If there are no slides (migration not run, or every slide switched off) the
 * built-in <Hero /> renders instead, so the front page can never end up blank.
 */
export default function HeroCarousel({ initialSlides = null }) {
  /* `initialSlides` comes from the server (app/page.js), so the first slide is
   * already in the HTML and the browser can start downloading the image while
   * it is still parsing — instead of after React has hydrated and a fetch has
   * come back. That ordering was most of the LCP.
   *
   * The fetch is kept for any caller that renders this without slides, so the
   * component still works standalone. */
  const [slides, setSlides] = useState(initialSlides);   // null = still loading
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (initialSlides) return;                 // already rendered on the server
    let off = false;
    fetch('/api/public/hero')
      .then(r => r.json())
      .then(j => { if (!off) setSlides(j?.ok ? (j.slides || []) : []); })
      .catch(() => { if (!off) setSlides([]); });
    return () => { off = true; };
  }, [initialSlides]);

  const n = slides?.length || 0;
  // Wraps in both directions, so "previous" from the first slide lands on the last.
  const go = useCallback((next) => setI(((next % n) + n) % n), [n]);

  /* Autoplay waits for the page to finish loading.
   *
   * Advancing pulls in the next slide's photograph, and on a slow connection
   * the first advance was landing while the rest of the page was still
   * arriving — a second large image competing for bandwidth with content the
   * visitor is trying to read. Waiting costs nothing: someone who has been on
   * the page for six seconds has loaded it.
   *
   * `document.readyState` is checked as well as the event, because the load
   * event may already have fired before this effect runs — in which case
   * listening for it would mean waiting forever.
   */
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.readyState === 'complete') { setLoaded(true); return; }
    const done = () => setLoaded(true);
    window.addEventListener('load', done);
    return () => window.removeEventListener('load', done);
  }, []);

  // Stops on hover, on keyboard focus, and while the tab is in the background
  // — a carousel that silently advances off-screen just wastes battery and
  // loses the reader's place.
  useEffect(() => {
    if (n < 2 || paused || !loaded) return;
    const t = setTimeout(() => setI(p => (p + 1) % n), DURATION);
    return () => clearTimeout(t);
  }, [i, n, paused, loaded]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Still loading, or nothing published: show the built-in hero.
  if (slides === null || n === 0) return <Hero />;

  const s = slides[i];

  return (
    <section
      className="relative w-full overflow-hidden isolate"
      style={FONT}
      aria-roledescription="carousel"
      aria-label="TNR highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); go(i - 1); }
      }}>

      <div className="relative min-h-[520px] sm:min-h-[580px] lg:min-h-[660px]">
        {/* Default (sync) mode: the outgoing and incoming images overlap, which
            is what makes the change read as a crossfade rather than a flash. */}
        <AnimatePresence initial={false}>
          <motion.div
            key={s.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.7, ease: MOTION.ease }}
            // Swipe on touch. Threshold is generous so a vertical page scroll
            // that drifts sideways does not change the slide by accident.
            drag={n > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(e, info) => {
              if (info.offset.x < -80) go(i + 1);
              else if (info.offset.x > 80) go(i - 1);
            }}>

            {/* Background image, drifting slowly (Ken Burns) so a static photo
                still feels alive. Disabled for reduced-motion users. */}
            {/* next/image, not a raw <img>.
              *
              * These photographs are Supabase Storage files that predate the
              * Cloudinary migration, so the Cloudinary srcset helper is a
              * deliberate no-op on them and every "optimisation" it applied
              * was doing nothing: a phone was downloading a 216 KB full-size
              * JPEG with a one-hour cache.
              *
              * Next's optimiser handles ANY host listed in remotePatterns,
              * and *.supabase.co is already there — so this converts to
              * AVIF/WebP, resizes to the device, and caches for a year,
              * without re-uploading a single file.
              *
              * The Ken Burns drift moved to this wrapper because `fill` needs
              * to control the image's own positioning.
              */}
            {s.image_url && (
              <motion.div
                className="absolute inset-0"
                initial={reduce ? false : { scale: 1.06 }}
                animate={reduce ? {} : { scale: 1 }}
                transition={{ duration: DURATION / 1000 + 2, ease: 'linear' }}>
                <Image
                  src={s.image_url}
                  alt=""
                  aria-hidden="true"
                  fill
                  // The hero spans the viewport at every breakpoint, so the
                  // browser picks by viewport width rather than guessing.
                  sizes="100vw"
                  /* `priority` on the first slide is what emits the preload
                   * link and fetchpriority="high" — the one LCP check still
                   * failing in the audit. Later slides are reached by a click,
                   * and claiming urgency for those would have them compete
                   * with whatever the visitor is actually reading. */
                  priority={i === 0}
                  quality={70}
                  className="object-cover select-none"
                  draggable="false"
                />
              </motion.div>
            )}

            {/* Readability wash. Strength is the admin's `overlay` value. */}
            <div className="absolute inset-0" aria-hidden="true" style={{
              background: s.align === 'center'
                ? `linear-gradient(180deg,rgba(6,45,33,${s.overlay / 140}),rgba(6,45,33,${s.overlay / 100}))`
                : `linear-gradient(95deg,rgba(6,45,33,${Math.min(0.96, s.overlay / 80)}) 0%,rgba(6,45,33,${s.overlay / 100}) 45%,rgba(6,45,33,${s.overlay / 260}) 100%)`,
            }} />
            {/* Gold hairline at the foot, tying the hero to the rest of the site. */}
            <div className="absolute inset-x-0 bottom-0 h-[3px]" aria-hidden="true"
              style={{ background: `linear-gradient(90deg,transparent,${COLORS.gold500},transparent)` }} />
          </motion.div>
        </AnimatePresence>

        {/* ── Copy ── */}
        {/* Copy sits in the lower part of the frame rather than dead centre:
            it leaves the top of the photograph clear for faces and sky, which
            is where the eye lands first. The bottom padding clears the dots. */}
        <div className={`relative max-w-tnr-wide mx-auto px-5 sm:px-8 pt-24 pb-24 lg:pt-32 lg:pb-28
            min-h-[520px] sm:min-h-[580px] lg:min-h-[660px] flex flex-col justify-end
            ${s.align === 'center' ? 'items-center text-center' : 'items-start'}`}>
          <AnimatePresence mode="wait">
            {/* Copy sits directly on the photograph — no panel. Readability
                comes from the gradient wash on the image plus the text shadows
                below, which darken only the pixels behind the glyphs rather
                than boxing off a rectangle of the picture. */}
            <motion.div
              key={s.id}
              className={s.align === 'center' ? 'max-w-3xl' : 'max-w-2xl'}
              // Font sizes arrive as custom properties; globals.css picks the
              // phone or desktop one at the 1024px breakpoint.
              style={{
                '--hero-title-m': `${s.title_size_mobile}px`,
                '--hero-title-d': `${s.title_size_desktop}px`,
                '--hero-text-m': `${s.text_size_mobile}px`,
                '--hero-text-d': `${s.text_size_desktop}px`,
              }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
              transition={{ duration: reduce ? 0.15 : 0.55, ease: MOTION.ease }}>

              {s.eyebrow && (
                <div className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.16em]"
                  style={{ background: 'rgba(255,255,255,.12)', color: COLORS.gold400,
                           border: `1px solid ${COLORS.gold500}55` }}>
                  {s.eyebrow}
                </div>
              )}

              {/* Two stacked shadows on the title: a tight dark one to lift the
                  glyph off whatever is immediately behind it, and a wide soft
                  one that darkens the general area. One large blur alone leaves
                  thin strokes disappearing against a bright patch of sky. */}
              {s.title && (
                <h1 className="hero-title mt-4 font-extrabold tracking-tight text-white"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,.55), 0 4px 30px rgba(0,0,0,.45)' }}>
                  {s.title}
                </h1>
              )}

              {s.subtitle && (
                <p className={`hero-text mt-5 leading-relaxed ${s.align === 'center' ? 'mx-auto' : ''}`}
                  style={{ color: 'rgba(255,255,255,.88)', maxWidth: '46rem',
                           textShadow: '0 1px 3px rgba(0,0,0,.5), 0 2px 18px rgba(0,0,0,.35)' }}>
                  {s.subtitle}
                </p>
              )}

              {(s.cta1_label || s.cta2_label) && (
                <div className={`mt-8 flex flex-wrap gap-3 ${s.align === 'center' ? 'justify-center' : ''}`}>
                  {s.cta1_label && (
                    <a href={s.cta1_href || '#'}
                      className="group inline-flex items-center gap-2 rounded-tnr px-6 py-3.5 font-bold text-white
                        shadow-tnr-raise transition-transform duration-micro hover:-translate-y-[2px]"
                      style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})`,
                               border: `1px solid ${COLORS.gold500}66` }}>
                      {s.cta1_label}
                      <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true"
                        className="transition-transform duration-micro group-hover:translate-x-0.5" />
                    </a>
                  )}
                  {s.cta2_label && (
                    <a href={s.cta2_href || '#'}
                      className="inline-flex items-center rounded-tnr px-6 py-3.5 font-bold text-white
                        backdrop-blur transition-colors duration-micro hover:bg-white/20"
                      style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.35)' }}>
                      {s.cta2_label}
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Controls (only worth showing for more than one slide) ── */}
        {n > 1 && (
          <>
            <Arrow side="left"  onClick={() => go(i - 1)} />
            <Arrow side="right" onClick={() => go(i + 1)} />

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5">
              {slides.map((sl, k) => (
                <button key={sl.id} onClick={() => go(k)}
                  aria-label={`Go to slide ${k + 1}${sl.title ? `: ${sl.title}` : ''}`}
                  aria-current={k === i}
                  /* The dot you see is 10px; the button you press is 24px tall
                   * with 4px of padding either side. A 10px target is below
                   * every published minimum and is genuinely hard to hit with
                   * a thumb — the padding is transparent, so the design is
                   * unchanged and only the hit area grows.
                   *
                   * The pill moved into an inner span so the button itself can
                   * be the larger, invisible target. */
                  className="group relative flex h-6 min-w-6 items-center justify-center transition-all duration-300"
                  style={{ width: Math.max(24, k === i ? 40 : 10) }}>
                  <span className="relative block h-2.5 overflow-hidden rounded-full transition-all duration-300"
                    style={{
                      width: k === i ? 40 : 10,
                      background: k === i ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.45)',
                    }}>
                    {/* The active dot fills as the slide's time runs out. While
                        paused it simply sits full, rather than animating with a
                        timer that is no longer running. */}
                    {k === i && (paused || reduce
                      ? <span className="absolute inset-0 rounded-full" style={{ background: COLORS.gold400 }} />
                      : <motion.span key={`bar-${sl.id}-${i}`} className="absolute inset-y-0 left-0 rounded-full"
                          style={{ background: COLORS.gold400 }}
                          initial={{ width: '0%' }} animate={{ width: '100%' }}
                          transition={{ duration: DURATION / 1000, ease: 'linear' }} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Announced to screen readers instead of the animation. */}
      <span className="tnr-sr-only" aria-live="polite">Slide {i + 1} of {n}</span>
    </section>
  );
}

function Arrow({ side, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} aria-label={side === 'left' ? 'Previous slide' : 'Next slide'}
      className={`absolute top-1/2 -translate-y-1/2 z-10 hidden sm:grid place-items-center
        h-11 w-11 rounded-full backdrop-blur transition
        hover:bg-white/25 active:scale-95 ${side === 'left' ? 'left-4' : 'right-4'}`}
      style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.35)' }}>
      <Icon size={20} strokeWidth={2.5} color="#fff" aria-hidden="true" />
    </button>
  );
}

/** True when the visitor has asked their OS to reduce animation. */
function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  const mq = useRef(null);
  useEffect(() => {
    mq.current = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq.current) return;
    const apply = () => setReduce(mq.current.matches);
    apply();
    mq.current.addEventListener?.('change', apply);
    return () => mq.current?.removeEventListener?.('change', apply);
  }, []);
  return reduce;
}
