'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch } from './adminApi';

export default function ProfileRequestsTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending');
  const [busy, setBusy] = useState(false);

  const load = () => aGet('/api/admin/membership/update-requests?status=' + status)
    .then(r => r.ok && setRows(r.requests || []));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function act(rq, action) {
    let admin_note = null;
    if (action === 'reject') {
      admin_note = prompt('Reason (shown to the member):');
      if (admin_note === null) return;
    } else if (!confirm(
      `Approve this change?\n\n${rq.member?.full_name || 'Member'}\n` +
      `${rq.field.replace(/_/g, ' ')}\n\n"${rq.current_value || '—'}"  →  "${rq.requested_value}"\n\n` +
      `This updates the member record immediately.`)) return;

    setBusy(true);
    const r = await aPatch('/api/admin/membership/update-requests/' + rq.id, { action, admin_note });
    setBusy(false);
    if (!r.ok) return toast?.(r.message || 'Failed', 'err');
    toast?.(action === 'approve' ? 'Change applied' : 'Request rejected', 'ok');
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">Profile Change Requests</h2>
        <p className="text-sm text-tnr-cream/50 mt-1">
          Members cannot change their name, contact details or location directly — those changes appear here for review.
        </p>
      </div>

      <div className="flex gap-1.5">
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition ${status === k
              ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
              : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>{l}</button>
        ))}
      </div>

      <div className="rounded-2xl border border-tnr-line divide-y divide-tnr-line/40">
        {rows.map(rq => (
          <div key={rq.id} className="p-4 flex flex-wrap gap-3 items-center">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-tnr-cream">
                {rq.member?.full_name || 'Member'}
                <span className="ml-2 text-xs font-mono text-tnr-gold/80">{rq.member?.membership_id}</span>
              </div>
              <div className="text-xs text-tnr-cream/50 mt-1 uppercase tracking-wide">{rq.field.replace(/_/g, ' ')}</div>
              <div className="text-sm mt-1">
                <span className="text-tnr-cream/40 line-through">{rq.current_value || '—'}</span>
                <span className="mx-2 text-tnr-cream/30">→</span>
                <span className="text-tnr-goldLight font-semibold">{rq.requested_value}</span>
              </div>
              {rq.admin_note && <div className="text-xs text-tnr-cream/40 mt-1">Note: {rq.admin_note}</div>}
            </div>
            {rq.status === 'pending' ? (
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => act(rq, 'approve')} className="btn-gold !py-1.5 !px-3 text-xs">Approve</button>
                <button disabled={busy} onClick={() => act(rq, 'reject')}
                  className="btn-ghost !py-1.5 !px-3 text-xs text-red-300 border-red-500/30">Reject</button>
              </div>
            ) : (
              <span className="text-xs text-tnr-cream/40 uppercase">{rq.status}</span>
            )}
          </div>
        ))}
        {!rows.length && <div className="p-10 text-center text-tnr-cream/40 text-sm">No {status} requests.</div>}
      </div>
    </div>
  );
}
