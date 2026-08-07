'use client';
import { resizeImage } from '@/lib/imageResize';

/* Multi-photo picker, shared by projects and institutions.
 *
 * Stored photos live in `gallery` (URLs); newly picked files sit in
 * `gallery_add` (data URLs) until save. Keeping the two apart means a save
 * that fails cannot lose photos that were already uploaded.
 */
export default function GalleryPicker({ f, setF, toast, label = 'Photo gallery' }) {
  const saved = f.gallery || [];
  const pending = f.gallery_add || [];
  const count = saved.length + pending.length;

  async function add(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';                        // allow re-picking the same file
    if (!files.length) return;
    if (count + files.length > 30) return toast('Up to 30 photos.', 'err');

    const out = [];
    for (const file of files) {
      try {
        const { dataUrl } = await resizeImage(file, { maxWidth: 1600, maxHeight: 1200 });
        out.push(dataUrl);
      } catch (ex) { toast(`${file.name}: ${ex.message}`, 'err'); }
    }
    if (out.length) setF(s => ({ ...s, gallery_add: [...(s.gallery_add || []), ...out] }));
  }

  const move = (i, delta) => setF(s => {
    const g = [...(s.gallery || [])];
    const j = i + delta;
    if (j < 0 || j >= g.length) return s;
    [g[i], g[j]] = [g[j], g[i]];
    return { ...s, gallery: g };
  });

  return <div className="rounded-xl border border-tnr-line/60 p-3 mb-4">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs font-bold text-tnr-goldLight">{label}</div>
      <div className="text-[11px] text-tnr-cream/40">{count} photo{count === 1 ? '' : 's'}</div>
    </div>

    {count > 0 && (
      <div className="flex flex-wrap gap-2 mb-3">
        {saved.map((src, i) => (
          <div key={src} className="relative group">
            <img src={src} alt="" className="h-16 w-24 rounded-lg object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              <Mini onClick={() => move(i, -1)} title="Move left">‹</Mini>
              <Mini onClick={() => setF(s => ({ ...s, gallery: s.gallery.filter(u => u !== src) }))} title="Remove">×</Mini>
              <Mini onClick={() => move(i, 1)} title="Move right">›</Mini>
            </div>
          </div>
        ))}
        {pending.map((src, i) => (
          <div key={`new-${i}`} className="relative">
            <img src={src} alt="" className="h-16 w-24 rounded-lg object-cover opacity-70" />
            <span className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-tnr-gold text-tnr-black font-bold">NEW</span>
            <button title="Remove"
              onClick={() => setF(s => ({ ...s, gallery_add: s.gallery_add.filter((_, k) => k !== i) }))}
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white text-xs leading-none">×</button>
          </div>
        ))}
      </div>
    )}

    <input type="file" accept="image/*" multiple onChange={add} className="text-xs text-tnr-cream/70" />
    <p className="text-[11px] text-tnr-cream/40 mt-1">
      Pick several at once. Resized automatically. New photos upload when you save.
    </p>
  </div>;
}

const Mini = ({ children, ...p }) => (
  <button {...p} className="h-5 w-5 rounded bg-black/70 text-white text-xs leading-none">{children}</button>
);
