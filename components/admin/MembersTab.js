'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { parseFile, exportExcel } from './exporters';
import { Card, Badge, Field } from './ui';

// A member can only receive an OTP if this passes.
function validEmail(v) {
  const e = String(v || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

const empty = { member_code: '', full_name: '', email: '', mobile: '', village: '', gender: '', status: 'Pending' };

export default function MembersTab({ toast }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [emailIssue, setEmailIssue] = useState(false);   // show only members who cannot receive an OTP
  const [form, setForm] = useState(null);
  const load = () => { const q = new URLSearchParams({ search, status }); aGet('/api/admin/members?' + q).then(r => r.ok && setMembers(r.members)); };
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); /* eslint-disable-next-line */ }, [search, status]);

  async function save() {
    // Single Mobile/WhatsApp field feeds both columns.
    const body = { ...form, whatsapp: form.mobile || null };
    const r = form.id ? await aPatch('/api/admin/members/' + form.id, body) : await aPost('/api/admin/members', body);
    if (!r.ok) return toast(r.message, 'err');
    toast(form.id ? 'Member updated' : 'Member added'); setForm(null); load();
  }
  async function setStatusOf(m, s) { const r = await aPatch('/api/admin/members/' + m.id, { status: s }); if (!r.ok) return toast(r.message, 'err'); toast('Updated'); load(); }
  async function del(m) { if (!confirm('Delete ' + m.full_name + '?')) return; const r = await aDel('/api/admin/members/' + m.id); if (!r.ok) return toast(r.message, 'err'); toast('Deleted'); load(); }
  async function onImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const rows = await parseFile(file);
    const approve = confirm('Import ' + rows.length + ' rows.\n\nOK = mark them all APPROVED (ready to vote)\nCancel = import as Pending');
    const r = await aPost('/api/admin/members/import', { rows, default_status: approve ? 'Approved' : 'Pending' });
    e.target.value = '';
    if (!r.ok) return toast(r.message, 'err');
    toast('Imported ' + r.inserted + ', skipped ' + r.skipped); load();
  }
  async function approveAll() {
    if (!confirm('Approve ALL pending members?')) return;
    const r = await aPost('/api/admin/members/approve-all', {});
    if (!r.ok) return toast(r.message || 'Failed', 'err');
    toast('Approved ' + r.approved + ' members'); load();
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 items-center">
      <input className="input max-w-xs" placeholder="Search name / mobile / email" value={search} onChange={e => setSearch(e.target.value)} />
      <select className="input max-w-[160px]" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All status</option><option>Pending</option><option>Approved</option><option>Blocked</option></select>
      <button onClick={() => setEmailIssue(v => !v)}
        className={`px-3 py-2 rounded-xl text-sm border transition ${emailIssue
          ? 'bg-red-500/20 border-red-500/40 text-red-200 font-semibold'
          : 'border-tnr-line text-tnr-cream/70 hover:bg-white/5'}`}>
        ⚠ No / invalid email ({members.filter(m => !validEmail(m.email)).length})
      </button>
      <div className="flex-1" />
      <button className="btn-green" onClick={() => setForm({ ...empty })}>+ Add Member</button>
      <button className="btn-ghost" onClick={approveAll}>Approve All Pending</button>
      <label className="btn-ghost cursor-pointer">Import CSV/Excel<input type="file" accept=".csv,.xlsx,.xls" hidden onChange={onImport} /></label>
      <button className="btn-ghost" onClick={() => exportExcel(members.map(m => ({ 'TNR-MN': m.member_code, Name: m.full_name, Email: m.email, Mobile: m.mobile, Village: m.village, Gender: m.gender, Status: m.status, Voting: m.voting_status })), 'Members', 'tnr-members.xlsx')}>Export</button>
    </div>

    <Card className="!p-0 overflow-hidden">
      <div className="overflow-auto max-h-[65vh]">
        <table className="w-full text-sm">
          <thead className="bg-black/30 sticky top-0"><tr className="text-tnr-cream/60 text-left">
            {['TNR-MN','Name','Email','Mobile','Status','Voting',''].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {members.filter(m => !emailIssue || !validEmail(m.email)).map(m => <tr key={m.id} className="border-t border-tnr-line/40 hover:bg-white/5">
              <td className="px-3 py-2 text-tnr-gold/90 font-mono text-xs whitespace-nowrap">{m.member_code || '—'}</td>
              <td className="px-3 py-2"><div className="font-medium text-tnr-cream">{m.full_name}</div></td>
              <td className="px-3 py-2">
                {validEmail(m.email)
                  ? <span className="text-tnr-cream/70">{m.email}</span>
                  : <span className="inline-flex items-center gap-1.5 text-red-300">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 font-bold">
                        {String(m.email || '').trim() ? 'INVALID' : 'NO EMAIL'}
                      </span>
                      {String(m.email || '').trim() || ''}
                    </span>}
              </td>
              <td className="px-3 py-2 text-tnr-cream/80">{m.mobile}</td>
              <td className="px-3 py-2"><Badge>{m.status}</Badge></td>
              <td className="px-3 py-2"><Badge>{m.voting_status}</Badge></td>
              <td className="px-3 py-2 whitespace-nowrap">
                {m.status !== 'Approved' && <button className="text-green-400 hover:underline mr-2" onClick={() => setStatusOf(m, 'Approved')}>Approve</button>}
                {m.status !== 'Blocked' && <button className="text-red-400 hover:underline mr-2" onClick={() => setStatusOf(m, 'Blocked')}>Block</button>}
                <button className="text-tnr-goldLight hover:underline mr-2" onClick={() => setForm({ id: m.id, member_code: m.member_code || '', full_name: m.full_name || '', email: m.email || '', mobile: m.mobile || '', village: m.village || '', gender: m.gender || '', status: m.status })}>Edit</button>
                <button className="text-tnr-cream/50 hover:underline" onClick={() => del(m)}>Del</button>
              </td>
            </tr>)}
            {!members.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-tnr-cream/40">No members found.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>

    {form && <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
      <div className="card p-6 w-full max-w-lg animate-pop max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-tnr-goldLight text-lg mb-4">{form.id ? 'Edit' : 'Add'} Member</h3>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="TNR-MN Code"><input className="input" placeholder="TNR-MN-0001" value={form.member_code || ''} onChange={e => setForm({ ...form, member_code: e.target.value })} /></Field>
          <Field label="Full Name *"><input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Mobile / WhatsApp *"><input className="input" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></Field>
          <Field label="Village / Area"><input className="input" value={form.village || ''} onChange={e => setForm({ ...form, village: e.target.value })} /></Field>
          <Field label="Gender"><select className="input" value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
            <option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option>Pending</option><option>Approved</option><option>Blocked</option></select></Field>
        </div>
        <div className="flex gap-3 mt-3"><button className="btn-ghost flex-1" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn-gold flex-1" onClick={save}>Save</button></div>
      </div>
    </div>}
  </div>;
}
