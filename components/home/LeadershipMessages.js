'use client';
import { useEffect, useState } from 'react';
import { Reveal } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';

/* Founder's and President's messages, between the live figures and the
 * leadership sections.
 *
 * Content is admin-managed (Admin → Leadership Messages). Nothing is
 * hardcoded: if no message has been published the section renders NOTHING
 * rather than a card with a placeholder name — an empty space on the home page
 * is far better than invented words attributed to a real person.
 *
 * The two cards mirror each other (photo left, then photo right) so the pair
 * reads as a conversation rather than a stacked list.
 */
/* Fallback only — the real heading is the admin-entered one on each row. */
const DEFAULT_HEADING = {
  founder: 'From Our Founder',
  president: 'From Our President',
};

export default function LeadershipMessages() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let off = false;
    fetch('/api/public/messages', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off && j?.ok) setRows(j.messages || []); })
      .catch(() => { if (!off) setRows([]); });
    return () => { off = true; };
  }, []);

  if (!rows?.length) return null;

  return (
    <section className="w-full py-16 sm:py-20" style={{ ...FONT, background: COLORS.snow }}
      aria-label="Messages from TNR leadership">
      {/* Same wide container as the rest of the home page — the narrower one
          this used to sit in left a large empty margin either side on desktop. */}
      {/* Each message carries its own heading rather than sharing one — a
          single "Messages from Our Leadership" banner made the Founder's and
          the President's words read as one undifferentiated block. */}
      <div className="max-w-tnr-wide mx-auto px-4 sm:px-8 space-y-14 sm:space-y-16">
        {rows.map((m, i) => (
          <div key={m.key}>
            <Reveal className="text-center" delay={i * 0.04}>
              <div className="text-[11px] font-bold uppercase tracking-[.18em]" style={{ color: COLORS.green700 }}>
                In Their Words
              </div>
              <h2 className="mt-1.5 text-2xl sm:text-[2rem] font-extrabold tracking-tight"
                style={{ color: COLORS.green900 }}>
                {m.heading || DEFAULT_HEADING[m.key] || 'Message'}
              </h2>
              <div className="mt-3 h-[2px] w-12 mx-auto" style={{ background: COLORS.gold500 }} />
            </Reveal>

            <div className="mt-8 sm:mt-10">
              <MessageCard m={m} flip={i % 2 === 1} delay={i * 0.08} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MessageCard({ m, flip, delay }) {
  const initials = (m.name || '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  // One class, not two competing ones — emitting both grid-cols utilities would
  // leave the winner up to stylesheet order.
  // Portrait panel grows on wide screens so the card fills the space instead of
  // leaving a long, thin column of text.
  const cols = flip
    ? 'md:grid-cols-[1fr_300px] xl:grid-cols-[1fr_380px]'
    : 'md:grid-cols-[300px_1fr] xl:grid-cols-[380px_1fr]';

  return (
    <Reveal delay={delay}>
      <article
        className="relative overflow-hidden rounded-tnr-xl bg-white shadow-tnr-raise"
        style={{ border: `1px solid ${COLORS.gold500}38` }}>

        {/* Gold hairline along the top — the same accent used on the cards. */}
        <div className="h-[3px] w-full"
          style={{ background: `linear-gradient(90deg,${COLORS.gold500},${COLORS.gold400}55,transparent)` }} />

        <div className={`grid gap-0 ${cols}`}>

          {/* ── Portrait ── */}
          <div className={`relative flex flex-col items-center justify-center gap-4 px-6 py-8
              ${flip ? 'md:order-2' : ''}`}
            style={{ background: `linear-gradient(160deg,${COLORS.green900},${COLORS.green950})` }}>

            <div className="relative shrink-0">
              {/* Gold ring, drawn as a ring rather than a border so the photo
                  keeps its full size at every breakpoint. */}
              <div className="absolute -inset-[6px] rounded-full"
                style={{ border: `2px solid ${COLORS.gold500}`, opacity: 0.85 }} aria-hidden="true" />
              {m.photo_url ? (
                <img src={m.photo_url} alt={m.name || 'Leadership portrait'}
                  className="h-[132px] w-[132px] xl:h-[164px] xl:w-[164px] rounded-full object-cover object-top"
                  style={{ border: `3px solid ${COLORS.green950}` }} />
              ) : (
                <div className="h-[132px] w-[132px] xl:h-[164px] xl:w-[164px] rounded-full grid place-items-center text-3xl font-black"
                  style={{ background: 'rgba(255,255,255,.08)', color: COLORS.gold400 }} aria-hidden="true">
                  {initials || '—'}
                </div>
              )}
            </div>

            <div className="text-center">
              {m.name && (
                <div className="text-base font-extrabold leading-tight text-white">{m.name}</div>
              )}
              {m.designation && (
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[.14em]"
                  style={{ color: COLORS.gold400 }}>{m.designation}</div>
              )}
            </div>
          </div>

          {/* ── Message ── */}
          <div className={`relative px-6 py-8 sm:px-9 sm:py-10 xl:px-14 xl:py-12 ${flip ? 'md:order-1' : ''}`}>
            {/* Oversized quote glyph, decorative only. */}
            <span aria-hidden="true"
              className="pointer-events-none absolute select-none leading-none"
              style={{
                top: 4, [flip ? 'right' : 'left']: 18, fontSize: 120, lineHeight: 1,
                fontFamily: 'Georgia, serif', color: COLORS.gold500, opacity: 0.11,
              }}>“</span>

            <div className="relative">
              {/* No heading repeated here — it now sits above the card. */}
              {/* Paragraph breaks are preserved from the admin textarea. */}
              <div className="space-y-3.5 text-[15px] leading-[1.75]" style={{ color: COLORS.charcoal }}>
                {String(m.message).split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p.split('\n').map((line, j, all) => (
                    <span key={j}>{line}{j < all.length - 1 && <br />}</span>
                  ))}</p>
                ))}
              </div>

              {/* Signature block */}
              <div className="mt-7 flex items-end gap-4">
                <div className="h-px flex-1" style={{ background: `${COLORS.gold500}40` }} />
                <div className="text-right">
                  {m.signature_url && (
                    <img src={m.signature_url} alt=""
                      className="ml-auto mb-1.5 h-11 object-contain" style={{ maxWidth: 190 }} />
                  )}
                  {m.name && (
                    <div className="text-sm font-extrabold" style={{ color: COLORS.green900 }}>{m.name}</div>
                  )}
                  {m.designation && (
                    <div className="text-[11px]" style={{ color: COLORS.muted }}>{m.designation}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
