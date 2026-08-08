'use client';
import { useState } from 'react';
import { aGet } from './adminApi';

/**
 * CNIC images for one application or member.
 *
 * Nothing loads until an admin presses the button. The link is signed and
 * expires in five minutes, and every request writes a CNIC_VIEWED row to the
 * audit log — so a national identity document is never fetched merely because
 * a reviewer happened to open the drawer.
 */
export default function CnicViewer({ applicationId, memberId, toast }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);   // 'front' | 'back'

  async function load() {
    setBusy(true);
    const q = applicationId ? `application_id=${applicationId}` : `member_id=${memberId}`;
    const r = await aGet(`/api/admin/membership/cnic?${q}`);
    setBusy(false);
    if (!r.ok) return toast?.(r.message || r.hint || 'Could not load the CNIC.', 'err');
    if (!r.front && !r.back) return toast?.('No CNIC was uploaded with this application.', 'err');
    setData(r);
  }

  if (!data) {
    return (
      <button type="button" onClick={load} disabled={busy}
        className="w-full rounded-xl border border-tnr-line px-4 py-2.5 text-sm font-semibold
          text-tnr-goldLight hover:bg-white/5 disabled:opacity-40">
        {busy ? 'Loading…' : '🪪 View CNIC (front & back)'}
      </button>
    );
  }

  const Side = ({ side, src }) => (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-tnr-cream/50">{side}</div>
      {src ? (
        <button type="button" onClick={() => setZoom(src)}
          className="block w-full overflow-hidden rounded-xl border border-tnr-line">
          <img src={src} alt={`CNIC ${side}`} className="w-full h-auto block" />
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-tnr-line px-3 py-6 text-center text-xs text-tnr-cream/40">
          Not uploaded
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Side side="Front" src={data.front} />
        <Side side="Back" src={data.back} />
      </div>

      <p className="text-[11px] text-tnr-cream/40">
        These links expire in {Math.round((data.expires_in || 300) / 60)} minutes and this view has
        been recorded in the audit log. Do not download or forward these images.
      </p>

      {/* Full-size overlay. In normal flow rather than fixed, so it cannot
          collapse the drawer's height on mobile. */}
      {zoom && (
        <div onClick={() => setZoom(null)}
          className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-4 cursor-zoom-out">
          <img src={zoom} alt="CNIC" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
