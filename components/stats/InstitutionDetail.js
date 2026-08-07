'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  KIND_LABEL, LEVEL_LABEL, SERVES_LABEL, SECTOR_LABEL,
  teachersPresent, pupilTeacherRatio,
} from '@/lib/institutions';
import { allPhotos } from '@/lib/gallery';
import { COLORS, FONT } from '@/lib/design/tokens';

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : null;

/* Full profile for one school, college or training centre, with its gallery.
 *
 * A dialog rather than a page: visitors filter the list, open one, close it
 * and carry on — a route change would lose their filters and their place.
 */
export default function InstitutionDetail({ item: i, onClose }) {
  const photos = allPhotos(i);
  const [shot, setShot] = useState(0);

  const step = useCallback((n) => {
    if (photos.length) setShot(x => (x + n + photos.length) % photos.length);
  }, [photos.length]);

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

  const present = teachersPresent(i);
  const ratio = pupilTeacherRatio(i);

  const staffing = [
    ['Sanctioned posts', i.sanctioned_posts, 'Approved by the department'],
    ['Posted here', i.posted_here, 'First-appointment station is this school'],
    ['Serving here', i.serving_here, 'Of those posted, actually teaching here'],
    ['Serving elsewhere', i.serving_elsewhere, 'Posted here, on duty at another station', 'warn'],
    ['Attached in', i.attached_in, 'Posted elsewhere, teaching here'],
    ['Community teachers', i.community_teachers, 'Hired and paid locally', 'gold'],
  ].filter(([, v]) => Number(v) > 0);

  const facts = [
    ['Type', KIND_LABEL[i.kind]],
    ['Level', LEVEL_LABEL[i.level]],
    ['Serves', SERVES_LABEL[i.serves]],
    ['Run by', SECTOR_LABEL[i.sector]],
    ['Union Council', i.union_council],
    ['Village / Area', i.village],
    ['Head teacher', i.head_teacher],
    ['Students', i.students_total > 0 && i.students_total.toLocaleString()],
    ['Boys', i.students_boys > 0 && i.students_boys.toLocaleString()],
    ['Girls', i.students_girls > 0 && i.students_girls.toLocaleString()],
    ['Students per teacher', ratio],
  ].filter(([, v]) => v);

  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-0 sm:p-6"
      style={{ background: 'rgba(6,45,33,.72)', ...FONT }}
      role="dialog" aria-modal="true" aria-label={i.name}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="relative w-full max-w-3xl max-h-full sm:max-h-[92vh] overflow-y-auto bg-white
        rounded-none sm:rounded-tnr-xl shadow-2xl">

        <button onClick={onClose} aria-label="Close"
          className="sticky top-3 float-right mr-3 z-10 grid place-items-center h-9 w-9 rounded-full
            bg-white/90 backdrop-blur border shadow" style={{ borderColor: COLORS.neutral }}>
          <X size={17} strokeWidth={2.5} color={COLORS.charcoal} aria-hidden="true" />
        </button>

        {photos.length > 0 && (
          <div className="relative bg-black">
            <img src={photos[shot]} alt={`${i.name} — photo ${shot + 1} of ${photos.length}`}
              className="w-full max-h-[52vh] object-contain" />
            {photos.length > 1 && <>
              <Arrow side="left" onClick={() => step(-1)} />
              <Arrow side="right" onClick={() => step(1)} />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, k) => (
                  <button key={k} onClick={() => setShot(k)} aria-label={`Photo ${k + 1}`}
                    className="h-2 rounded-full transition-all"
                    style={{ width: k === shot ? 22 : 8, background: k === shot ? COLORS.gold400 : 'rgba(255,255,255,.55)' }} />
                ))}
              </div>
            </>}
          </div>
        )}

        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pt-4">
            {photos.map((src, k) => (
              <button key={src} onClick={() => setShot(k)} aria-label={`Show photo ${k + 1}`}
                className="shrink-0 rounded-lg overflow-hidden"
                style={{ outline: k === shot ? `2px solid ${COLORS.gold500}` : 'none', outlineOffset: 1 }}>
                <img src={src} alt="" className="h-14 w-20 object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-extrabold" style={{ color: COLORS.green900 }}>{i.name}</h2>
          <p className="mt-1 text-[13px]" style={{ color: COLORS.muted }}>
            {[LEVEL_LABEL[i.level], SERVES_LABEL[i.serves], SECTOR_LABEL[i.sector],
              [i.village, i.union_council].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
          </p>

          {/* Headline: what's actually in the classroom. */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Big value={present} label="Teachers present" />
            {i.students_total > 0 && <Big value={i.students_total.toLocaleString()} label="Students" />}
            {Number(i.teachers_needed) > 0 && <Big value={i.teachers_needed} label="More teachers needed" warn />}
          </div>

          {!!staffing.length && (
            <>
              <h3 className="mt-7 mb-3 font-extrabold" style={{ color: COLORS.green900 }}>Staffing</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {staffing.map(([label, value, note, tone]) => (
                  <div key={label} className="rounded-tnr border p-3.5" style={{ borderColor: COLORS.neutral }}>
                    <div className="text-xl font-extrabold tabular-nums"
                      style={{ color: tone === 'warn' ? '#8A2F2F' : tone === 'gold' ? '#7A5C10' : COLORS.green900 }}>
                      {value}
                    </div>
                    <div className="text-[12px] font-bold" style={{ color: COLORS.charcoal }}>{label}</div>
                    <div className="text-[11px] leading-snug" style={{ color: COLORS.muted }}>{note}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Where the absent teachers actually are. */}
          {i.elsewhere_note && (
            <div className="mt-4 rounded-tnr px-4 py-3 text-[13px] leading-relaxed"
              style={{ background: 'rgba(170,60,60,.08)', color: '#8A2F2F' }}>
              <b>Teachers posted here, serving elsewhere:</b><br />{i.elsewhere_note}
            </div>
          )}

          {Number(i.community_fee_monthly) > 0 && (
            <div className="mt-4 rounded-tnr px-4 py-3 text-[13px] leading-relaxed"
              style={{ background: 'rgba(200,154,43,.12)', color: '#7A5C10' }}>
              Families pay <b>Rs {Number(i.community_fee_monthly).toLocaleString()}</b> per student per
              month towards community teachers.{i.fee_note && <> {i.fee_note}</>}
            </div>
          )}

          {i.notes && (
            <p className="mt-4 text-[14px] leading-relaxed" style={{ color: COLORS.charcoal }}>{i.notes}</p>
          )}

          <dl className="mt-6 grid sm:grid-cols-2 gap-x-6">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2 border-b" style={{ borderColor: COLORS.neutral }}>
                <dt className="text-[12px]" style={{ color: COLORS.muted }}>{k}</dt>
                <dd className="text-[13px] text-right font-medium" style={{ color: COLORS.charcoal }}>{v}</dd>
              </div>
            ))}
          </dl>

          {(i.source || i.last_verified) && (
            <div className="mt-5 rounded-tnr px-4 py-3 text-[12px] leading-relaxed"
              style={{ background: 'rgba(200,154,43,.10)', color: '#7A5C10' }}>
              {i.source && <><b>Source:</b> {i.source}</>}
              {i.source && i.last_verified && <br />}
              {i.last_verified && <>Last checked {fmtDate(i.last_verified)}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Big({ value, label, warn }) {
  return (
    <div className="rounded-tnr border p-4 text-center" style={{ borderColor: COLORS.neutral }}>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color: warn ? '#8A2F2F' : COLORS.green900 }}>{value}</div>
      <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</div>
    </div>
  );
}

function Arrow({ side, onClick }) {
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
