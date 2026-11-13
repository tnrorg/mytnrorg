'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Image from 'next/image';
import HeroCtaMenu from './HeroCtaMenu';
import { FONT, MOTION } from '@/lib/design/tokens';
import { FALLBACK_SLIDES } from '@/lib/heroSlides';
import { parseHeroTitle, plainHeroTitle } from '@/lib/heroTitle';
import './hero.css';

/** How long a slide stays before the next one dissolves in. */
const DURATION = 7000;

/* Admin-managed hero carousel.
 *
 * Everything a visitor reads here — picture, wording, buttons, tint and the
 * phone/desktop font sizes — comes from the hero_slides table. Nothing about
 * the content is hardcoded; this file and hero.css decide only how it is laid
 * out and how it moves. The layout itself is explained at the top of hero.css.
 *
 * If there are no slides (migration not run, or every slide switched off) the
 * built-in slide from lib/heroSlides.js is shown through this same component.
 */

// ── The entrance, described once ────────────────────────────────────────────
//
// A parent that only schedules, and children that each know how to arrive.
// Order on screen: label → headline, word by word → sentence → buttons. On a
// slide change the outgoing copy leaves quickly (0.24s) and the incoming one
// waits for it, so two headlines are never on screen together.
const EASE = MOTION.easeOut;

const stage = (reduce, first) => ({
  hidden: { transition: { staggerChildren: 0 } },
  show: {
    transition: reduce
      ? { staggerChildren: 0, delayChildren: 0 }
      // The first load waits a beat longer: the picture is still settling.
      : { staggerChildren: 0.12, delayChildren: first ? 0.3 : 0.42 },
  },
});
const rise = {
  hidden: { opacity: 0, y: 18, transition: { duration: 0.24, ease: 'easeIn' } },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.75, ease: EASE } },
};
const titleStage = (reduce) => ({
  hidden: {},
  show: { transition: { staggerChildren: reduce ? 0 : 0.055 } },
});
const word = {
  hidden: { opacity: 0, y: '108%', transition: { duration: 0.22, ease: 'easeIn' } },
  show:   { opacity: 1, y: '0%',   transition: { duration: 0.85, ease: EASE } },
};
const buttons = {
  hidden: { opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.2, ease: 'easeIn' } },
  show:   { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.7, ease: EASE } },
};

const hasCopy = (s) =>
  !!(s.title || s.subtitle || s.eyebrow || s.cta1_label || s.cta2_label);

/** Which of the three layouts a slide uses — see hero.css. */
const layoutOf = (s) => (!hasCopy(s) ? 'full' : s.align === 'center' ? 'center' : 'split');

/* The picture box is about three-quarters of the window on a desktop split
   slide and the full width everywhere else. Telling the browser so lets it
   fetch a smaller file for the split slides. */
const sizesOf = (layout) => (layout === 'split' ? '(min-width: 1024px) 76vw, 100vw' : '100vw');

// The admin's `overlay` value as a tint over the picture. Same formula as
// before, so every existing slide keeps the strength its editor chose.
const washOf = (s) => {
  const o = Number(s.overlay) || 0;
  return s.align === 'center'
    ? `linear-gradient(180deg,rgba(6,45,33,${o / 140}),rgba(6,45,33,${o / 100}))`
    : `linear-gradient(95deg,rgba(6,45,33,${Math.min(0.96, o / 80)}) 0%,rgba(6,45,33,${o / 100}) 45%,rgba(6,45,33,${o / 260}) 100%)`;
};

export default function HeroCarousel({ initialSlides = null }) {
  /* `initialSlides` comes from the server (app/page.js), so the first slide is
   * already in the HTML and the browser can start downloading the image while
   * it is still parsing — instead of after React has hydrated and a fetch has
   * come back. That ordering was most of the LCP.
   *
   * The fetch is kept for any caller that renders this without slides, so the
   * component still works standalone. */
  const [fetched, setFetched] = useState(initialSlides);   // null = still loading
  /* `turn` counts every change of slide. It is part of each picture layer's
   * key, so a slide that comes back is a NEW layer placed on top — not the
   * old one revived underneath whatever replaced it. Without it, stepping
   * back to a slide within a second of leaving it made the picture pop
   * instead of dissolve. */
  const [pos, setPos] = useState({ i: 0, turn: 0 });
  const rootRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (initialSlides) return;                 // already rendered on the server
    let off = false;
    fetch('/api/public/hero')
      .then(r => r.json())
      .then(j => { if (!off) setFetched(j?.ok ? (j.slides || []) : []); })
      .catch(() => { if (!off) setFetched([]); });
    return () => { off = true; };
  }, [initialSlides]);

  // Still loading, or nothing published: the built-in slide.
  const slides = fetched?.length ? fetched : FALLBACK_SLIDES;
  const n = slides.length;
  const idx = Math.min(pos.i, n - 1);          // the list can shrink under us
  const s = slides[idx];
  const layout = layoutOf(s);

  // Wraps in both directions, so "previous" from the first slide lands on the
  // last. Asking for the slide already showing changes nothing at all.
  const go = useCallback((to) => setPos(p => {
    const cur = Math.min(p.i, n - 1);
    const want = typeof to === 'function' ? to(cur) : to;
    const next = ((want % n) + n) % n;
    return next === cur ? p : { i: next, turn: p.turn + 1 };
  }), [n]);

  /* Autoplay waits for the page to finish loading.
   *
   * Advancing pulls in the next slide's photograph, and on a slow connection
   * the first advance was landing while the rest of the page was still
   * arriving — a second large image competing for bandwidth with content the
   * visitor is trying to read. Waiting costs nothing: someone who has been on
   * the page for seven seconds has loaded it.
   *
   * `document.readyState` is checked as well as the event, because the load
   * event may already have fired before this effect runs — in which case
   * listening for it would mean waiting forever. */
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.readyState === 'complete') { setLoaded(true); return; }
    const done = () => setLoaded(true);
    window.addEventListener('load', done);
    return () => window.removeEventListener('load', done);
  }, []);

  /* Three separate reasons to hold the slide, kept separate so that one
   * ending cannot cancel another. */
  const [hover, setHover] = useState(false);     // a mouse is over it
  const [focus, setFocus] = useState(false);     // keyboard focus is inside it
  const [away, setAway] = useState(false);       // the tab is in the background

  useEffect(() => {
    const onVis = () => setAway(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /* Reduced motion switches autoplay OFF, not just the animation: a page that
     changes its own content every few seconds is motion, whatever the
     transition between the two states looks like. */
  const running = n > 1 && loaded && !reduce && !hover && !focus && !away;

  /* The timer resumes where it stopped.
   *
   * It used to restart from zero every time the pointer left the hero, while
   * the progress line showed "full" for as long as it was paused — so the line
   * and the timer told different stories. Now the time already spent on a
   * slide is remembered across a pause, and the CSS line is paused in place
   * alongside it; both pick up from the same point.
   *
   * Declared before the timer so that on a slide change the timer's cleanup
   * (which adds to `spent`) runs first and this reset has the last word. */
  const spent = useRef(0);
  useEffect(() => { spent.current = 0; }, [idx]);
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const t = setTimeout(() => go(c => c + 1), Math.max(0, DURATION - spent.current));
    return () => { clearTimeout(t); spent.current += performance.now() - started; };
  }, [idx, n, running, go]);

  /* Is KEYBOARD focus inside the hero right now?
   *
   * Asked of the document, not tracked from focus and blur events alone,
   * because a focused element that is removed or made inert fires no blur —
   * a keyboard visitor on a slide's button who pressed an arrow key left the
   * carousel believing focus was still inside, and it never moved again.
   * So this is re-asked every time the slide changes.
   *
   * Only keyboard focus counts (:focus-visible). Clicking an arrow with the
   * mouse also focuses it, and that used to freeze the carousel until the
   * visitor clicked somewhere else. */
  const syncFocus = useCallback(() => {
    const el = document.activeElement, root = rootRef.current;
    let inside = !!(root && el && el !== document.body && root.contains(el) && !el.closest('[inert]'));
    if (inside) { try { inside = el.matches(':focus-visible'); } catch { /* old browser: assume yes */ } }
    setFocus(inside);
  }, []);
  useEffect(() => { syncFocus(); }, [idx, syncFocus]);

  /* ── Pointer parallax ──────────────────────────────────────────────────────
   * Motion values, not state: moving the mouse updates three transforms and
   * re-renders nothing. The spring is what makes it feel like weight rather
   * than a picture glued to the cursor.
   *
   * Mouse only. A finger has no hover position, and tilting the artwork under
   * a thumb that is trying to scroll is a bug, not a flourish. */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 70, damping: 20, mass: 0.6 };
  const sx = useSpring(mx, spring);
  const sy = useSpring(my, spring);
  // Three depths: the picture drifts against the pointer, the light with it,
  // the words barely at all.
  const imgX = useTransform(sx, v => v * -10);
  const imgY = useTransform(sy, v => v * -7);
  const glowX = useTransform(sx, v => v * 30);
  const glowY = useTransform(sy, v => v * 18);
  const copyX = useTransform(sx, v => v * 5);
  const copyY = useTransform(sy, v => v * 3);

  const onPointerMove = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);     // −1 … 1
    my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };

  // Swipe. Horizontal intent has to clearly beat vertical, so scrolling the
  // page with a thumb that drifts sideways does not change the slide.
  const touch = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e) => {
    const from = touch.current; touch.current = null;
    const t = e.changedTouches[0];
    if (!from || !t || n < 2) return;
    const dx = t.clientX - from.x, dy = t.clientY - from.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(idx + (dx < 0 ? 1 : -1));
  };

  const next = slides[(idx + 1) % n];
  const nextLayout = layoutOf(next);

  return (
    <section
      ref={rootRef}
      className="tnr-hero"
      style={FONT}
      aria-roledescription="carousel"
      aria-label="TNR highlights"
      /* pointerenter, not mouseenter: a tap on a phone fires mouseenter and
         never the matching leave, which used to leave the carousel paused for
         good after the first touch. */
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={() => { setHover(false); mx.set(0); my.set(0); }}
      onPointerMove={onPointerMove}
      onFocusCapture={syncFocus}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={(e) => {
        if (n < 2) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); go(idx - 1); }
      }}>

      {/* ── Pictures ── */}
      {/* `initial={false}`: the first slide is NOT faded in from nothing. It is
          in the server's HTML at full opacity, which is what makes it the
          Largest Contentful Paint the moment its bytes arrive. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`${s.id}:${pos.turn}`}
          className="tnr-hero-layer"
          data-layout={layout}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          /* A true cross-dissolve. The outgoing slide stays fully opaque
             underneath until the incoming one has finished arriving on top of
             it, and only then leaves. Fading both at once dips through the
             background colour halfway — every change would flash green. */
          exit={{ opacity: 0, transition: { duration: 0.01, delay: reduce ? 0 : 1.15 } }}
          transition={{ duration: reduce ? 0 : 1.15, ease: MOTION.ease }}>

          {s.image_url && (
            <div className="tnr-hero-media">
              <motion.div className="tnr-hero-pan" style={{ x: imgX, y: imgY }}>
                {/* The slow push-in is a CSS animation on this wrapper, because
                    next/image's `fill` needs to own the image's positioning. */}
                <div className="tnr-hero-kb">
                  {/* next/image, not a raw <img>: it converts to AVIF/WebP,
                      resizes to the device and caches for a year, for any host
                      in remotePatterns — without re-uploading a single file. */}
                  <Image
                    src={s.image_url}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes={sizesOf(layout)}
                    /* `priority` on the first slide emits the preload link and
                       fetchpriority="high". Later slides are warmed up below,
                       after the page has loaded, so they never compete with
                       it. */
                    priority={idx === 0}
                    quality={72}
                    draggable={false}
                  />
                </div>
              </motion.div>
              <div className="tnr-hero-wash" aria-hidden="true" style={{ background: washOf(s) }} />
            </div>
          )}
          <div className="tnr-hero-scrim" aria-hidden="true" />
        </motion.div>
      </AnimatePresence>

      {/* The next picture, fetched ahead and kept invisible, so the dissolve
          never opens onto a half-loaded image. Same box and same `sizes` as it
          will have on screen, so the browser picks the same file and the real
          slide is a cache hit. Not until the page has loaded. */}
      {loaded && n > 1 && next.image_url && (
        <div className="tnr-hero-layer" data-layout={nextLayout} aria-hidden="true"
          style={{ opacity: 0, pointerEvents: 'none' }}>
          <div className="tnr-hero-media">
            <Image key={next.id} src={next.image_url} alt="" fill sizes={sizesOf(nextLayout)}
              quality={72} loading="eager" />
          </div>
        </div>
      )}

      {/* First paint only — see .tnr-hero-veil. */}
      <div className="tnr-hero-veil" aria-hidden="true" />

      <motion.div className="tnr-hero-glow" aria-hidden="true" style={{ x: glowX, y: glowY }}>
        <i />
      </motion.div>

      {/* ── Copy and controls ── */}
      <div className="tnr-hero-inner">
        <motion.div className="tnr-hero-copies" style={{ x: copyX, y: copyY }}>
          {slides.map((sl, k) => (
            <SlideCopy key={sl.id} slide={sl} index={k} active={k === idx} reduce={reduce} />
          ))}
        </motion.div>

        {/* NO ON-SCREEN CONTROLS — removed at the owner's request, in three
            steps: first the "02 / 04" counter and the arrow buttons, then the
            progress lines and the pause button. The hero is picture and words
            only.

            The carousel still advances by itself every seven seconds, and a
            visitor can still:
              • swipe left or right on a touch screen;
              • press the Left / Right arrow keys while focus is inside it;
              • hold it on a slide by resting the mouse over it, or by tabbing
                to one of its buttons.
            What a mouse user can no longer do is JUMP to a particular slide.
            If that is ever wanted back, the progress lines were the lightest
            way to offer it. */}
      </div>

      {/* Announced to screen readers instead of the animation. */}
      <span className="tnr-sr-only" aria-live="polite">
        Slide {idx + 1} of {n}{s.title ? `: ${plainHeroTitle(s.title)}` : ''}
      </span>
    </section>
  );
}

/* One slide's words.
 *
 * EVERY slide's copy is rendered, all the time, stacked in one grid cell; only
 * the active one is visible (hero.css explains why: it is what holds the hero
 * at a constant height with no guessed number). The others are `inert`, so
 * their links cannot be reached by Tab or by a screen reader.
 *
 * The first slide's headline is the page's <h1>. The rest are <h2>: a page has
 * one main heading, and it should be the one that is in the HTML first.
 *
 * `tnr-reveal` on every animated element is what the <noscript> rule in
 * app/layout.js targets — without JavaScript these would otherwise stay at the
 * opacity:0 they are server-rendered with.
 */
const SlideCopy = memo(function SlideCopy({ slide: s, index, active, reduce }) {
  const title = useMemo(() => parseHeroTitle(s.title), [s.title]);
  if (!hasCopy(s)) return null;

  const Heading = index === 0 ? motion.h1 : motion.h2;
  const align = s.align === 'center' ? 'center' : 'left';

  return (
    /* A plain element carries `inert`, not the motion one: the animation
       library decides for itself which props reach the DOM, and the one
       attribute that keeps hidden links out of the Tab order is not something
       to leave to that. */
    <div
      className="tnr-hero-copy"
      data-active={active ? 'true' : 'false'}
      data-align={align}
      inert={!active}
      aria-hidden={!active}
      // Font sizes arrive as custom properties; hero.css picks the phone or
      // desktop one at the 1024px breakpoint.
      style={{
        '--hero-title-m': `${s.title_size_mobile}px`,
        '--hero-title-d': `${s.title_size_desktop}px`,
        '--hero-text-m': `${s.text_size_mobile}px`,
        '--hero-text-d': `${s.text_size_desktop}px`,
      }}>
    <motion.div
      variants={stage(reduce, index === 0)}
      initial="hidden"
      animate={active ? 'show' : 'hidden'}>

      {s.eyebrow && (
        <motion.div variants={rise} className="tnr-hero-eyebrow tnr-reveal">{s.eyebrow}</motion.div>
      )}

      {title.wordCount > 0 && (
        /* The label is the headline as one plain sentence; the spans below are
           hidden from assistive tech, which would otherwise read a word-by-
           word animation as a list of fragments. */
        <Heading className="tnr-hero-title" variants={titleStage(reduce)} aria-label={title.plain}>
          {title.lines.map((line, li) => (
            <span key={li} className="tnr-hero-line" aria-hidden="true">
              {line.map((w, wi) => (
                <span key={wi}>
                  <span className="tnr-hero-word">
                    <motion.span variants={word}
                      className={w.gold ? 'tnr-reveal tnr-hero-gold' : 'tnr-reveal'}>
                      {w.text}
                    </motion.span>
                  </span>{' '}
                </span>
              ))}
            </span>
          ))}
        </Heading>
      )}

      {s.subtitle && (
        <motion.p variants={rise} className="tnr-hero-text tnr-reveal">{s.subtitle}</motion.p>
      )}

      {(s.cta1_label || s.cta2_label) && (
        <motion.div variants={buttons} className="tnr-hero-actions tnr-reveal">
          <HeroCtaMenu
            buttonLabel={s.cta_button_label}
            cta1={{ label: s.cta1_label, href: s.cta1_href }}
            cta2={{ label: s.cta2_label, href: s.cta2_href }}
            align={align}
            inert={!active}
          />
        </motion.div>
      )}
    </motion.div>
    </div>
  );
});

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
