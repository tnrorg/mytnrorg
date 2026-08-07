'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch, aPost, aDel } from './adminApi';
import { exportExcel } from './exporters';

const TONE = {
  active: 'bg-green-500/15 text-green-300 border-green-500/30',
  approved: 'bg-green-500/15 text-green-300 border-green-500/30',
  suspended: 'bg-red-500/15 text-red-300 border-red-500/30',
  inactive: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  expired: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
};

export default function MembersDirectoryTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    const q = new URLSearchParams({ status, search });
    // The error was previously discarded, so a failed request rendered as
    // "No members yet" — identical to a genuinely empty list.
    setLoading(true);
    aGet('/api/admin/membership/members?' + q)
      .then(r => {
        setLoading(false);
        if (r?.ok) { setRows(r.members || []); setErr(''); }
        else { setErr(r?.detail || r?.message || 'Could not load members.'); setRows([]); }
      })
      .catch(e => { setLoading(false); setErr(e.message || 'Request failed.'); setRows([]); });
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t);
    /* eslint-disable-next-line */ }, [status, search]);

  async function change(m, patch, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    if (patch.status && ['suspended', 'inactive', 'expired'].includes(patch.status)) {
      const reason = prompt(`Reason for setting this member to ${patch.status} (shown to the member):`);
      if (!reason || !reason.trim()) return;
      patch.reason = reason.trim();
    }
    const r = await aPatch('/api/admin/membership/members/' + m.id, patch);
    if (!r.ok) return toast?.(r.message || 'Failed', 'err');
    toast?.('Member updated', 'ok'); load();
  }

  /** Permanent deletion. The Membership ID must be typed to confirm, because
   *  this cannot be undone and cascades to every record the member owns. */
  async function remove(m) {
    const typed = prompt(
      `PERMANENTLY DELETE ${m.full_name}?\n\n` +
      `This removes their membership, profile, CVs, certificates and all other records.\n` +
      `Their previous applications are deleted too, so ${m.email} can register again.\n\n` +
      `This cannot be undone.\n\n` +
      `Type the Membership ID to confirm: ${m.membership_id}`);
    if (!typed) return;
    if (typed.trim().toUpperCase() !== m.membership_id.toUpperCase())
      return toast?.('Membership ID did not match — nothing was deleted.', 'err');

    const reason = prompt('Reason for deletion (recorded in the audit log):') || '';
    const r = await aDel(`/api/admin/membership/members/${m.id}` +
      `?confirm=${encodeURIComponent(m.membership_id)}&reason=${encodeURIComponent(reason)}`);
    if (!r?.ok) return toast?.(r?.message || 'Could not delete the member.', 'err');
    toast?.(r.message || 'Member deleted', 'ok');
    load();
  }

  async function resend(m) {
    const r = await aPost(`/api/admin/membership/members/${m.id}/resend-invite`, {});
    toast?.(r.ok ? 'Invitation sent' : (r.message || 'Failed'), r.ok ? 'ok' : 'err');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-xl font-bold text-tnr-cream">Members</h2>
          <p className="text-sm text-tnr-cream/50 mt-1">
            Approved members. Suspending a member blocks portal access and removes them from the public directory.
          </p>
        </div>
        <button className="btn-ghost !py-2 text-sm"
          onClick={() => exportExcel(rows.map(m => ({
            'Membership ID': m.membership_id, Name: m.full_name, Email: m.email, Mobile: m.mobile,
            Gender: m.gender, Village: m.village, 'Union Council': m.union_council,
            City: m.current_city, 'State / Province': m.current_state_province,
            Country: m.current_country, Organisation: m.organization_name,
            Profession: m.profession === 'Other' ? (m.profession_other || 'Other') : m.profession,
            Education: m.education_level, Position: m.current_position,
            Status: m.status, Public: m.public_visible === false ? 'No' : 'Yes',
            Approved: m.approved_at ? new Date(m.approved_at).toLocaleDateString('en-GB') : '',
          })), 'Members', 'tnr-membership.xlsx')}>⬇ Export Excel</button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input className="input max-w-xs" placeholder="Search name / email / ID / village"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {[['', 'All'], ['active', 'Active'], ['suspended', 'Suspended'], ['inactive', 'Inactive'], ['expired', 'Expired']].map(([k, l]) => (
            <button key={k || 'all'} onClick={() => setStatus(k)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition ${status === k
                ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
                : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>{l}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-tnr-cream/40">{rows.length} member(s)</span>
      </div>

      <div className="rounded-2xl border border-tnr-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-tnr-cream/50 border-b border-tnr-line">
              <th className="px-3 py-2.5">Membership ID</th><th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Village</th>
              <th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Public</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id} className="border-t border-tnr-line/40 hover:bg-white/5">
                <td className="px-3 py-2 font-mono text-xs text-tnr-gold/90 whitespace-nowrap">{m.membership_id}</td>
                <td className="px-3 py-2 font-medium text-tnr-cream">{m.full_name}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{m.email}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{m.village || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TONE[m.status] || ''}`}>
                    {m.status}</span></td>
                <td className="px-3 py-2">
                  {/* Members are public by default. This is the override for
                      the rare case where someone must be taken off the public
                      site — a safety concern, a family request. */}
                  <button onClick={() => change(m, { public_visible: m.public_visible === false })}
                    title={m.public_visible === false
                      ? 'Hidden from the public site — click to show'
                      : 'Listed publicly — click to hide'}
                    className={`text-xs ${m.public_visible === false ? 'text-tnr-cream/40' : 'text-green-400'}`}>
                    {m.public_visible === false ? 'Hidden' : 'Visible'}</button></td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {['active', 'approved'].includes(m.status)
                    ? <button onClick={() => change(m, { status: 'suspended' })} className="text-red-400 hover:underline mr-2">Suspend</button>
                    : <button onClick={() => change(m, { status: 'active' }, `Reactivate ${m.full_name}?`)} className="text-green-400 hover:underline mr-2">Reactivate</button>}
                  <button onClick={() => resend(m)} className="text-tnr-goldLight hover:underline mr-2">Resend Invite</button>
                  <button onClick={() => remove(m)} className="text-red-500 font-semibold hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {!rows.length && !err && <tr><td colSpan={7} className="px-3 py-10 text-center text-tnr-cream/40">
              {loading ? 'Loading members…'
                : status || search
                  ? 'No members match this filter.'
                  : 'No members yet. Approve an application to create the first member.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
