'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_LABEL, STATUS_TONE, money, exactMoney, allPhotos } from '@/lib/projects';
import { COLORS, FONT } from '@/lib/design/tokens';

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : null;

/* Full project details in a dialog, with its photo gallery.
 *
 * A dialog rather than a separate route: visitors scan the list, open one,
 * close it and carry on. Sending them to another page would lose their filters
 * and their place in a long list.
 */
export default function ProjectDetail({ project: p, cur, onClose }) {
  const photos = allPhotos(p);
  const [shot, setShot] = useState(0);

  const step = useCallback((n) => {
    if (photos.length) setShot(i => (i + n + photos.length) % photos.length);
  }, [photos.length]);

  // Escape closes, arrows move through the gallery. Scroll is locked so the
  // page behind does not drift while the dialog is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, step]);

  const tone = STATUS_TONE[p.status] || {};
  const rows = [
    ['Scheme number', p.scheme_no],
    ['Department', p.department],
    ['Sector', p.category],
    ['Union Council', p.union_council],
    ['Village / Area', p.village],
    ['Contractor', p.contractor],
    ['Approved cost', p.approved_cost > 0 && exactMoney(p.approved_cost, cur)],
    ['Funds released', p.released_funds > 0 && exactMoney(p.released_funds, cur)],
    ['Funds utilised', p.utilised_funds > 0 && exactMoney(p.utilised_funds, cur)],
    ['Approved on', fmtDate(p.approved_date)],
    ['Work started', fmtDate(p.start_date)],
    ['Target completion', fmtDate(p.target_date)],
    ['Completed on', fmtDate(p.completion_date)],
    ['People served', p.beneficiaries > 0 && p.beneficiaries.toLocaleString()],
  ].filter(([, v]) => v);

  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-0 sm:p-6"
      style={{ background: 'rgba(6,45,33,.72)', ...FONT }}
      role="dialog" aria-modal="true" aria-label={p.title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="relative w-full max-w-3xl max-h-full sm:max-h-[92vh] overflow-y-auto bg-white
        rounded-none sm:rounded-tnr-xl shadow-2xl">

        <button onClick={onClose} aria-label="Close"
          className="sticky top-3 float-right mr-3 z-10 grid place-items-center h-9 w-9 rounded-full
            bg-white/90 backdrop-blur border shadow"
          style={{ borderColor: COLORS.neutral }}>
          <X size={17} strokeWidth={2.5} color={COLORS.charcoal} aria-hidden="true" />
        </button>

        {/* ── Gallery ── */}
        {photos.length > 0 && (
          <div className="relative bg-black">
            <img src={photos[shot]} alt={`${p.title} — photo ${shot + 1} of ${photos.length}`}
              className="w-full max-h-[52vh] object-contain" />
            {photos.length > 1 && <>
              <GalleryArrow side="left" onClick={() => step(-1)} />
              <GalleryArrow side="right" onClick={() => step(1)} />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <button key={i} onClick={() => setShot(i)} aria-label={`Photo ${i + 1}`}
                    className="h-2 rounded-full transition-all"
                    style={{ width: i === shot ? 22 : 8, background: i === shot ? COLORS.gold400 : 'rgba(255,255,255,.55)' }} />
                ))}
              </div>
            </>}
          </div>
        )}

        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pt-4">
            {photos.map((src, i) => (
              <button key={src} onClick={() => setShot(i)} aria-label={`Show photo ${i + 1}`}
                className="shrink-0 rounded-lg overflow-hidden"
                style={{ outline: i === shot ? `2px solid ${COLORS.gold500}` : 'none', outlineOffset: 1 }}>
                <img src={src} alt="" className="h-14 w-20 object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: tone.bg, color: tone.fg }}>
              {STATUS_LABEL[p.status] || p.status}
            </span>
            {p.year && <span className="text-[12px]" style={{ color: COLORS.muted }}>{p.year}</span>}
          </div>

          <h2 className="mt-2.5 text-xl sm:text-2xl font-extrabold" style={{ color: COLORS.green900 }}>
            {p.title}
          </h2>

          {p.summary && (
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: COLORS.charcoal }}>{p.summary}</p>
          )}

          {p.progress_percent > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-[12px] mb-1.5" style={{ color: COLORS.muted }}>
                <span>Physical progress</span>
                <span className="tabular-nums font-bold" style={{ color: COLORS.green900 }}>{p.progress_percent}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.neutral }}>
                <div className="h-full rounded-full" style={{ width: `${p.progress_percent}%`, background: COLORS.green700 }} />
              </div>
            </div>
          )}

          {/* Approved vs released, when both are known — the gap is usually the
              question a resident actually has. */}
          {p.approved_cost > 0 && p.released_funds > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[['Approved', p.approved_cost], ['Released', p.released_funds]].map(([l, v]) => (
                <div key={l} className="rounded-tnr border p-3 text-center" style={{ borderColor: COLORS.neutral }}>
                  <div className="text-lg font-extrabold" style={{ color: COLORS.green900 }}
                    title={exactMoney(v, cur)}>{money(v, cur)}</div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          <dl className="mt-6 grid sm:grid-cols-2 gap-x-6">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2 border-b" style={{ borderColor: COLORS.neutral }}>
                <dt className="text-[12px]" style={{ color: COLORS.muted }}>{k}</dt>
                <dd className="text-[13px] text-right font-medium" style={{ color: COLORS.charcoal }}>{v}</dd>
              </div>
            ))}
          </dl>

          {(p.source || p.last_verified) && (
            <div className="mt-5 rounded-tnr px-4 py-3 text-[12px] leading-relaxed"
              style={{ background: 'rgba(200,154,43,.10)', color: '#7A5C10' }}>
              {p.source && <><b>Source:</b> {p.source}</>}
              {p.source && p.last_verified && <br />}
              {p.last_verified && <>Last checked {fmtDate(p.last_verified)}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GalleryArrow({ side, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 rounded-full
        backdrop-blur transition hover:bg-white/30 ${side === 'left' ? 'left-3' : 'right-3'}`}
      style={{ background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.4)' }}>
      <Icon size={19} strokeWidth={2.5} color="#fff" aria-hidden="true" />
    </button>
  );
}
