'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch } from './adminApi';

const STATUSES = [
  ['', 'All'], ['pending_review', 'Pending'], ['under_review', 'Under Review'],
  ['correction_requested', 'Correction'], ['approved', 'Approved'], ['rejected', 'Rejected'],
];
const TONE = {
  pending_review: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  under_review: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  correction_requested: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-green-500/15 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export default function MembershipTab({ toast }) {
  const [apps, setApps] = useState([]);
  const [stats, setStats] = useState(null);
  // Defaults to All rather than Pending: if an application ever carries an
  // unexpected status it would silently vanish from a filtered view, which
  // looks exactly like "the application never arrived".
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);      // application being reviewed
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    const q = new URLSearchParams({ status, search });
    aGet('/api/admin/membership/applications?' + q).then(r => {
      setLoading(false);
      if (r?.ok) { setApps(r.applications || []); setErr(''); }
      else setErr(r?.detail || r?.message || 'Could not load applications.');
    }).catch(e => { setLoading(false); setErr(e.message || 'Request failed.'); });
    aGet('/api/admin/membership/stats').then(r => { if (r?.ok) setStats(r); });
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [status, search]);

  async function act(app, action, extra = {}) {
    if (action === 'approve' && !confirm(
      `APPROVE this application?\n\n${app.full_name} · ${app.email}\n\n` +
      `A Membership ID will be generated and the person becomes an active member.\n` +
      `This cannot be undone from here.`)) return;
    if (action === 'reject') {
      const reason = prompt('Reason for rejection (shown to the applicant):');
      if (!reason || !reason.trim()) return;
      extra.reason = reason.trim();
    }
    setBusy(true);
    const r = await aPatch('/api/admin/membership/applications/' + app.id, { action, ...extra });
    setBusy(false);
    if (!r.ok) return toast?.(r.message || 'Failed', 'err');
    toast?.(r.membership_id ? `Approved — ${r.membership_id}` : 'Updated', 'ok');
    setOpen(null); load();
  }

  const S = ({ label, value, gold }) => (
    <div className="stat items-center text-center">
      <div className={`text-2xl font-black ${gold ? 'text-tnr-gold' : 'text-tnr-cream'}`}>{value ?? '—'}</div>
      <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">{label}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">Membership Applications</h2>
        <p className="text-sm text-tnr-cream/50 mt-1">
          Review and approve applications. Approval generates a Membership ID and activates the member.
        </p>
      </div>

      {err && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm space-y-1">
          <div className="font-semibold">Membership module not ready</div>
          <div className="text-red-200/80 text-xs">{err}</div>
          <div className="text-red-200/70 text-xs pt-1">
            If this mentions a missing table or relation, run the six migration files in Supabase
            (supabase/migration_membership_phase1.sql → phase6.sql), in order.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <S label="Total" value={stats?.total_applications} />
        <S label="Pending" value={stats?.pending_review} gold />
        <S label="Approved" value={stats?.approved_apps} />
        <S label="Rejected" value={stats?.rejected} />
        <S label="Active Members" value={stats?.active_members} gold />
        <S label="Public Profiles" value={stats?.public_profiles} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className="input max-w-xs" placeholder="Search name / email / mobile / reference"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(([k, l]) => (
            <button key={k || 'all'} onClick={() => setStatus(k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${status === k
                ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
                : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-tnr-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-tnr-cream/50 border-b border-tnr-line">
              <th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Union Council</th>
              <th className="px-3 py-2.5">Submitted</th><th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {apps.map(a => (
              <tr key={a.id} className="border-t border-tnr-line/40 hover:bg-white/5">
                <td className="px-3 py-2 font-mono text-xs text-tnr-gold/90 whitespace-nowrap">{a.reference_no}</td>
                <td className="px-3 py-2 font-medium text-tnr-cream">{a.full_name}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{a.email}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{a.union_council || '—'}</td>
                <td className="px-3 py-2 text-tnr-cream/50 text-xs whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TONE[a.status] || ''}`}>
                    {a.status.replace(/_/g, ' ')}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => setOpen(a)} className="text-tnr-goldLight hover:underline">Review</button>
                </td>
              </tr>
            ))}
            {!apps.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-tnr-cream/40">
              {loading ? 'Loading…' : err ? 'Could not load applications.' :
                `No applications${status ? ' with this status' : ''} yet.`}</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <ReviewModal app={open} busy={busy} onClose={() => setOpen(null)} onAct={act} />}
    </div>
  );
}

function ReviewModal({ app, busy, onClose, onAct }) {
  const [notes, setNotes] = useState(app.admin_notes || '');
  const R = ({ k, v }) => v ? (
    <div className="flex gap-3 py-2 border-b border-tnr-line/40 text-sm">
      <span className="text-tnr-cream/40 w-40 shrink-0">{k}</span>
      <span className="text-tnr-cream flex-1">{Array.isArray(v) ? v.join(', ') : v}</span>
    </div>) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <img src={app.photo_url || '/tnr-logo.png'} alt="" className="w-16 h-16 rounded-2xl object-cover border border-tnr-line" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-tnr-cream">{app.full_name}</h3>
            <div className="text-xs font-mono text-tnr-gold/90">{app.reference_no}</div>
          </div>
        </div>

        <div className="mt-4">
          <R k="Email" v={app.email} /><R k="Mobile" v={app.mobile} />
          <R k="Gender" v={app.gender} /><R k="Age" v={app.age} />
          <R k="Union Council" v={app.union_council} /><R k="Village" v={app.village} />
          {/* Older applications predate these questions, so R renders a dash
              rather than the row disappearing — a blank is information too. */}
          <R k="Current Address" v={[app.current_city, app.current_state_province, app.current_country]
            .filter(Boolean).join(', ')} />
          <R k="Education" v={app.education_level} />
          <R k="Profession / Field" v={app.profession === 'Other'
            ? (app.profession_other || 'Other') : app.profession} />
          <R k="Current Position" v={app.current_position} />
          <R k="Organisation" v={app.organization_name} />
          <R k="Contribution Areas" v={app.contribution_areas} />
          <R k="Leadership View" v={app.leadership_view} /><R k="Leadership Note" v={app.leadership_note} />
          <R k="WhatsApp Opt-in" v={app.whatsapp_opt_in ? 'Yes' : 'No'} />
          <R k="Declaration" v={app.declaration_accepted ? `Accepted ${app.declaration_version || ''}` : 'Not accepted'} />
        </div>

        <div className="mt-4 space-y-3">
          <Long title="Why do you want to join TNR?" text={app.why_join} />
          <Long title="Biggest issues facing Roundu youth" text={app.youth_issues} />
        </div>

        <div className="mt-4">
          <label className="block text-xs text-tnr-cream/50 mb-1">Internal admin notes (not shown to applicant)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full bg-black/30 border border-tnr-line rounded-xl px-3 py-2 text-sm text-tnr-cream" />
          <button onClick={() => onAct(app, 'notes', { admin_notes: notes })}
            className="mt-2 text-xs text-tnr-goldLight hover:underline">Save notes</button>
        </div>

        {app.status !== 'approved' && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => onAct(app, 'approve')}
              className="btn-gold flex-1 !py-2.5 text-sm">✓ Approve & Issue Membership ID</button>
            <button disabled={busy} onClick={() => onAct(app, 'reject')}
              className="btn-ghost !py-2.5 text-sm text-red-300 border-red-500/30">Reject</button>
            <button disabled={busy} onClick={() => onAct(app, 'correction')}
              className="btn-ghost !py-2.5 text-sm">Request Correction</button>
          </div>
        )}
        <button onClick={onClose} className="btn-ghost w-full mt-3 !py-2 text-sm">Close</button>
      </div>
    </div>
  );
}
const Long = ({ title, text }) => text ? (
  <div className="rounded-xl bg-black/25 border border-tnr-line/60 p-3">
    <div className="text-[11px] uppercase tracking-wider text-tnr-cream/40 mb-1">{title}</div>
    <p className="text-sm text-tnr-cream/80 whitespace-pre-wrap leading-relaxed">{text}</p>
  </div>) : null;
