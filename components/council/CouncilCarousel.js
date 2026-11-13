'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui';
import { FONT } from '@/lib/design/tokens';
import { CouncilRosterCard } from './CouncilDirectory';
import './council-carousel.css';

/* ── The Advisory Council, as a slowly moving row ─────────────────────────────
 *
 * The home page's council roster: every approved member, drifting right to
 * left at walking pace, looping without a seam.
 *
 * THERE ARE NO COPIES OF ANY CARD. The usual way to make a row loop is to
 * render the whole list twice and slide both, so the second copy is in place
 * when the first runs out. That doubles the photographs, and it leaves a
 * second, phantom set of members in the page that a screen reader announces
 * and a keyboard tabs through — or, if those are hidden to prevent that, half
 * the cards a visitor can see cannot be clicked.
 *
 * Instead each member is in the page exactly once and is moved individually.
 * A card that has gone fully off the left edge is carried, while out of
 * sight, to the far right and comes round again. Thirteen members is thirteen
 * cards, thirteen links and thirteen photographs, at every moment.
 *
 * That only works while the row is longer than the window with a card to
 * spare — otherwise the card being carried round would be seen in transit.
 * With too few members for that (`loop` false) the row simply stands still,
 * centred: correct, just not moving.
 *
 * NOTHING HERE RE-RENDERS TO MOVE. The position lives in a ref and is written
 * straight to the cards' transforms once per frame. React renders this
 * component when the data arrives, when the window is resized across a
 * breakpoint and when the data changes — not sixty times a second.
 *
 * Same data, same endpoint and same card as the full council page; this file
 * changes only how the cards are laid out.
 */

/* One card width in this many seconds. Slow enough to read a name and a role
   as the card passes; the brief asked for 7–10. */
const SECONDS_PER_CARD = 8.5;
/* How quickly the drift eases to a stop and back up again (ms). A row that
   freezes the instant the pointer touches it looks like it has crashed. */
const EASE_SPEED = 300;
/* Bringing a focused card into view (ms). */
const EASE_GLIDE = 170;
/* After a drag is let go the row keeps a little of its speed, then settles. */
const EASE_THROW = 380;
const MAX_THROW = 1800;         // px/s
/* How long the row stays still after the visitor moves it themselves (ms). */
const HOLD_AFTER_DRAG = 1600;
/* Sideways travel before a press becomes a drag (px). Below it, it is a click. */
const DRAG_THRESHOLD = 6;

const mod = (a, n) => ((a % n) + n) % n;
const share = (dt, ms) => 1 - Math.exp(-dt / ms);

/* The portrait's real width at each breakpoint — see .tnr-cc in the stylesheet
   for the counts these come from (1.25, 2.3, 3 and 4 cards across). */
const CAROUSEL_SIZES = '(max-width: 639px) 78vw, (max-width: 767px) 42vw, (max-width: 1279px) 32vw, 340px';

export default function CouncilCarousel({ bodyLabel = 'Advisory Council' }) {
  const [rows, setRows] = useState(null);      // null = still loading
  const [loop, setLoop] = useState(false);
  const [near, setNear] = useState(false);     // close enough to the screen to fetch portraits

  const rootRef = useRef(null);
  const viewRef = useRef(null);
  const trackRef = useRef(null);
  const itemRefs = useRef([]);

  /* Everything the frame loop reads and writes. A ref, not state: changing
     any of it must not render. */
  const e = useRef({
    offset: 0, vel: 0, step: 0, setW: 0, viewW: 0, n: 0, loop: false,
    glide: null, throwV: 0, hold: 0,
    hover: false, focus: false, dragging: false,
    onScreen: false, reduce: false,
    raf: 0, last: 0, shifts: [],
  }).current;

  /* ── Data ──
     The same request the council page makes. Members are de-duplicated by
     slug before anything is drawn: the endpoint has never returned the same
     person twice, but a row that loops is the one place a repeat would look
     deliberate, so it is ruled out here rather than assumed. */
  useEffect(() => {
    let live = true;
    fetch('/api/public/council', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (live) setRows(j?.ok ? (j.members || []) : []); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, []);

  const members = useMemo(() => {
    const seen = new Set();
    return (rows || []).filter(m => {
      if (!m?.slug || seen.has(m.slug)) return false;
      seen.add(m.slug);
      return true;
    });
  }, [rows]);

  /* ── Drawing ── */
  const draw = useCallback(() => {
    if (!e.loop || !e.setW) return;
    const at = mod(e.offset, e.setW);
    for (let i = 0; i < e.n; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      /* Where the card would sit with the row slid by `at`, and — if that
         puts it wholly off the left — the same place one full lap to the
         right. Those are the only two positions a card is ever given. */
      let x = i * e.step - at;
      if (x < -e.step) x += e.setW;
      const shift = Math.round((x - i * e.step) * 100) / 100;
      if (e.shifts[i] !== shift) {
        e.shifts[i] = shift;
        el.style.transform = `translate3d(${shift}px,0,0)`;
      }
    }
  }, [e]);

  const wantsToRun = useCallback(() => e.loop && !e.reduce && !e.hover
    && !e.focus && !e.dragging && e.onScreen && performance.now() >= e.hold, [e]);

  const tick = useCallback((now) => {
    e.raf = 0;
    /* A long gap between frames — the tab was in the background — must not
       become one long lurch when it returns. */
    const dt = Math.min(64, Math.max(0, now - (e.last || now)));
    e.last = now;

    if (!e.dragging) {
      if (e.glide !== null) {
        const d = e.glide - e.offset;
        if (Math.abs(d) < 0.4) { e.offset = e.glide; e.glide = null; }
        else e.offset += d * share(dt, EASE_GLIDE);
      } else if (e.throwV) {
        e.offset += e.throwV * (dt / 1000);
        e.throwV *= Math.exp(-dt / EASE_THROW);
        if (Math.abs(e.throwV) < 6) e.throwV = 0;
      }

      // The drift itself: ease toward full speed, or toward rest.
      const want = wantsToRun() && e.glide === null && !e.throwV
        ? e.step / SECONDS_PER_CARD : 0;
      e.vel += (want - e.vel) * share(dt, EASE_SPEED);
      // Half a pixel a second is already invisible; calling it zero lets the
      // loop stop instead of crawling toward rest for another second.
      if (Math.abs(e.vel) < 0.5 && want === 0) e.vel = 0;
      e.offset += e.vel * (dt / 1000);

      // Keep the number small. Invisible: the picture repeats every lap.
      if (e.glide === null && e.setW && (e.offset >= e.setW || e.offset < 0)) {
        e.offset = mod(e.offset, e.setW);
      }
    }
    draw();

    /* Stop asking for frames when there is nothing left to move. A paused
       carousel should cost exactly nothing — and a hold that is still
       counting down needs the loop alive to notice when it ends. */
    const waiting = e.loop && !e.reduce && !e.hover && !e.focus
      && e.onScreen && performance.now() < e.hold;
    if (e.dragging || e.glide !== null || e.throwV || e.vel || wantsToRun() || waiting) {
      e.raf = requestAnimationFrame(tick);
    }
  }, [e, draw, wantsToRun]);

  /** Wake the loop after anything that might mean there is work to do. */
  const kick = useCallback(() => {
    if (e.raf) return;
    e.last = 0;
    e.raf = requestAnimationFrame(tick);
  }, [e, tick]);

  /* ── Measuring ──
     Card width and gap come from the laid-out cards, not from constants, so
     the stylesheet stays the one place that decides how many are on screen.

     A layout effect, so the first measurement lands before the browser
     paints: the line under the row appears with the cards rather than a
     frame after them, pushing the section below down as it does. */
  useLayoutEffect(() => {
    const view = viewRef.current, track = trackRef.current;
    if (!view || !track || !members.length) return;

    const measure = () => {
      const first = itemRefs.current[0];
      if (!first) return;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = first.offsetWidth + gap;
      const viewW = view.clientWidth;
      if (!step || !viewW) return;

      const n = members.length;
      const setW = n * step;
      /* Loop only when a card can be carried round unseen: the row minus one
         card has to be at least as wide as the window. */
      const canLoop = setW - step >= viewW;

      // Keep the same card leading across a resize.
      if (e.step && e.step !== step) e.offset = (e.offset / e.step) * step;
      Object.assign(e, { step, setW, viewW, n, loop: canLoop });
      e.shifts = [];
      if (!canLoop) {
        e.offset = 0; e.vel = 0; e.glide = null; e.throwV = 0;
        itemRefs.current.forEach(el => { if (el) el.style.transform = ''; });
      }
      setLoop(canLoop);
      draw();
      kick();
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(view);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [members, e, draw, kick]);

  /* ── What stops and restarts it without the visitor doing anything ── */
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const sync = () => { e.reduce = !!mq?.matches; kick(); };
    sync();
    mq?.addEventListener?.('change', sync);
    return () => mq?.removeEventListener?.('change', sync);
  }, [e, kick]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;        // still showing the placeholder
    if (typeof IntersectionObserver === 'undefined') { e.onScreen = true; setNear(true); kick(); return; }
    // Moving cards nobody can see is wasted work, so it runs only on screen.
    const seen = new IntersectionObserver(([en]) => { e.onScreen = en.isIntersecting; kick(); });
    // A wider net for the portraits: start fetching a screen or so early.
    const soon = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setNear(true); soon.disconnect(); } },
      { rootMargin: '900px 0px' });
    seen.observe(view); soon.observe(view);
    return () => { seen.disconnect(); soon.disconnect(); };
  }, [e, kick, members.length]);

  useEffect(() => () => { if (e.raf) cancelAnimationFrame(e.raf); e.raf = 0; }, [e]);

  /* ── Hover and focus ── */
  const onPointerEnter = (ev) => { if (ev.pointerType === 'mouse') { e.hover = true; kick(); } };
  const onPointerLeave = (ev) => { if (ev.pointerType === 'mouse') { e.hover = false; kick(); } };

  /** Slide the row just far enough that card `i` is wholly inside the window. */
  const reveal = useCallback((i) => {
    if (!e.loop) return;
    const pad = Math.min(48, e.viewW * 0.06);
    let x = i * e.step - mod(e.offset, e.setW);
    if (x < -e.step) x += e.setW;
    const cardW = itemRefs.current[i]?.offsetWidth || e.step;
    let move = 0;
    if (x < pad) move = x - pad;
    else if (x + cardW > e.viewW - pad) move = x + cardW - (e.viewW - pad);
    if (!move) return;
    e.throwV = 0;
    if (e.reduce) { e.offset += move; e.glide = null; draw(); }
    else e.glide = e.offset + move;
    kick();
  }, [e, draw, kick]);

  const onFocus = (ev) => {
    /* Keyboard focus only. A mouse click also focuses the link it lands on,
       and treating that as "someone is reading here" would freeze the row
       for anyone who clicked and came back. */
    let keyboard = true;
    try { keyboard = ev.target.matches(':focus-visible'); } catch { /* older browser: assume keyboard */ }
    if (!keyboard) return;
    e.focus = true;
    const i = itemRefs.current.findIndex(el => el && el.contains(ev.target));
    if (i >= 0) reveal(i);
    kick();
  };
  const onBlur = (ev) => {
    if (viewRef.current?.contains(ev.relatedTarget)) return;
    e.focus = false;
    kick();
  };

  /* ── Drag and swipe ──
     One set of pointer handlers for mouse, pen and finger. A press only
     becomes a drag once it has travelled sideways past the threshold, so an
     ordinary click on "View profile" is still an ordinary click. */
  const press = useRef(null);
  const swallowClick = useRef(false);

  const onPointerDown = (ev) => {
    if (!e.loop || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    press.current = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, from: e.offset,
      lastX: ev.clientX, lastT: performance.now(), v: 0 };
  };
  const onPointerMove = (ev) => {
    const p = press.current;
    if (!p || p.id !== ev.pointerId) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (!e.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      e.dragging = true; e.glide = null; e.throwV = 0; e.vel = 0;
      rootRef.current?.setAttribute('data-dragging', 'true');
      try { viewRef.current?.setPointerCapture(ev.pointerId); } catch { /* not capturable: fine */ }
    }
    const now = performance.now();
    const dt = now - p.lastT;
    if (dt > 0) p.v = 0.7 * ((p.lastX - ev.clientX) / dt * 1000) + 0.3 * p.v;
    p.lastX = ev.clientX; p.lastT = now;
    e.offset = p.from - dx;
    kick();
  };
  const endPress = (ev) => {
    const p = press.current;
    if (!p || (ev && p.id !== ev.pointerId)) return;
    press.current = null;
    if (!e.dragging) return;
    e.dragging = false;
    rootRef.current?.setAttribute('data-dragging', 'false');
    try { viewRef.current?.releasePointerCapture(p.id); } catch { /* already released */ }
    // A flick carries on briefly. A slow placement — or a stale reading from
    // a pointer that stopped before letting go — does not.
    const fresh = performance.now() - p.lastT < 90;
    e.throwV = e.reduce || !fresh ? 0 : Math.max(-MAX_THROW, Math.min(MAX_THROW, p.v));
    e.hold = performance.now() + HOLD_AFTER_DRAG;
    /* The browser fires a click on whatever was under the pointer at release.
       After a drag that would open a profile nobody asked for. */
    swallowClick.current = true;
    setTimeout(() => { swallowClick.current = false; }, 0);
    kick();
  };
  const onClickCapture = (ev) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    ev.preventDefault();
    ev.stopPropagation();
  };

  /* The whole card opens the profile, not only its button — a face is what
     people click. The button inside remains the real link (it is what a
     keyboard and a screen reader use, and it handles its own clicks), so this
     only acts on a click that landed somewhere else on the card. A click that
     ended a drag never arrives here: it is stopped above. */
  const openProfile = (ev, slug) => {
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.target.closest?.('a, button')) return;
    const href = `/council/${slug}`;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) window.open(href, '_blank', 'noopener');
    else window.location.assign(href);
  };

  /* ── Render ── */
  if (rows === null) return (
    <div className="tnr-cc" data-loop="false" style={FONT} aria-hidden="true">
      <div className="tnr-cc-view">
        <div className="tnr-cc-track" style={{ justifyContent: 'flex-start' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="tnr-cc-item"><div className="tnr-cc-ghost"><i /><i /></div></div>
          ))}
        </div>
      </div>
      {/* Holds the height of the line under the row, so nothing below moves
          when the real one appears. */}
      <p className="tnr-cc-hint" style={{ visibility: 'hidden' }}>&nbsp;</p>
    </div>
  );

  if (!members.length) return (
    <EmptyState icon="🎓" title="Council profiles coming soon"
      message="Advisory Council profiles will appear here once published." />
  );

  return (
    <div ref={rootRef} className="tnr-cc" style={FONT}
      data-loop={loop ? 'true' : 'false'} data-dragging="false"
      role="group" aria-roledescription="carousel" aria-label={`${bodyLabel} members`}>
      <div ref={viewRef} className="tnr-cc-view"
        onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}
        onFocus={onFocus} onBlur={onBlur}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endPress} onPointerCancel={endPress}
        onClickCapture={onClickCapture}
        /* The browser's own drag — pulling a ghost of a link or a photo — would
           take the gesture away before it could become ours. */
        onDragStart={(ev) => ev.preventDefault()}>
        <ul ref={trackRef} className="tnr-cc-track">
          {members.map((m, i) => (
            <li key={m.slug} className="tnr-cc-item" ref={el => { itemRefs.current[i] = el; }}
              onClick={(ev) => openProfile(ev, m.slug)}>
              <CouncilRosterCard m={m} i={i} bodyLabel={bodyLabel} showProfession
                card={{ reveal: false, imageSizes: CAROUSEL_SIZES, eager: near }} />
            </li>
          ))}
        </ul>
      </div>

      {/* NO BUTTONS — removed at the owner's request, as on the hero. Nothing
          is lost that a visitor needs: the row pauses under the mouse and
          while a card has keyboard focus, it can be dragged or swiped either
          way, and tabbing through the cards brings each one into view. One
          quiet line says the row can be moved, since nothing else now does. */}
      {loop && (
        <p className="tnr-cc-hint">
          {members.length} members<span className="hidden sm:inline"> · drag to explore</span>
          <span className="sm:hidden"> · swipe to explore</span>
        </p>
      )}
    </div>
  );
}
