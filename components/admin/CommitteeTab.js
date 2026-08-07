'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Badge, Field } from './ui';

const empty = { full_name: '', role: '', phone: '', email: '', bio: '', sort_order: 0, active: true, photo_data: null, photo_url: '' };

export default function CommitteeTab({ toast }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(null);
  const load = () => aGet('/api/admin/committee').then(r => r.ok && setMembers(r.members));
  useEffect(() => { load(); }, []);

  function pickPhoto(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => setForm(s => ({ ...s, photo_data: rd.result, photo_url: rd.result })); rd.readAsDataURL(f);
  }
  async function save() {
    if (!form.full_name.trim()) return toast('Name is required', 'err');
    const r = form.id ? await aPatch('/api/admin/committee/' + form.id, form) : await aPost('/api/admin/committee', form);
    if (!r.ok) return toast(r.message, 'err');
    toast(form.id ? 'Committee member updated' : 'Committee member added'); setForm(null); load();
  }
  async function del(m) {
    if (!confirm('Remove ' + m.full_name + ' from the committee?')) return;
    const r = await aDel('/api/admin/committee/' + m.id);
    if (!r.ok) return toast(r.message, 'err'); toast('Removed'); load();
  }
  async function toggle(m) {
    const r = await aPatch('/api/admin/committee/' + m.id, { active: !m.active });
    if (!r.ok) return toast(r.message, 'err'); load();
  }

  return <div className="space-y-4">
    <div className="flex items-center gap-2">
      <p className="text-sm text-tnr-cream/60">Shown on the homepage under “TNR Election Committee”. Lower order number appears first.</p>
      <div className="flex-1" />
      <button className="btn-green" onClick={() => setForm({ ...empty, sort_order: members.length })}>+ Add Committee Member</button>
    </div>

    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {members.map(m => <Card key={m.id} className="!p-4">
        <div className="flex gap-3">
          <img src={m.photo_url || '/tnr-logo.png'} className="w-16 h-16 rounded-xl object-cover border border-tnr-line shrink-0" alt="" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-tnr-cream truncate">{m.full_name}</div>
            <div className="text-xs text-tnr-goldLight truncate">{m.role || '—'}</div>
            <div className="text-[11px] text-tnr-cream/40 mt-0.5">Order: {m.sort_order}</div>
            <div className="mt-1"><Badge>{m.active ? 'Active' : 'Hidden'}</Badge></div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn-ghost !py-1.5 flex-1 text-sm" onClick={() => setForm({ ...m, photo_data: null })}>Edit</button>
          <button className="btn-ghost !py-1.5 text-sm" onClick={() => toggle(m)}>{m.active ? 'Hide' : 'Show'}</button>
          <button className="btn-ghost !py-1.5 text-sm text-red-300" onClick={() => del(m)}>Del</button>
        </div>
      </Card>)}
      {!members.length && <p className="text-tnr-cream/40 col-span-full text-center py-8">No committee members yet.</p>}
    </div>

    {form && <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
      <div className="card p-6 w-full max-w-lg animate-pop max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-tnr-goldLight text-lg mb-4">{form.id ? 'Edit' : 'Add'} Committee Member</h3>
        <div className="flex items-center gap-4 mb-3">
          <img src={form.photo_url || '/tnr-logo.png'} className="w-20 h-20 rounded-xl object-cover border border-tnr-line" alt="" />
          <label className="btn-ghost cursor-pointer text-sm">Upload Photo<input type="file" accept="image/*" hidden onChange={pickPhoto} /></label>
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Full Name *"><input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Role / Designation"><input className="input" placeholder="Chief Election Commissioner" value={form.role || ''} onChange={e => setForm({ ...form, role: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><input className="input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Display Order"><input className="input" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Field label="Status"><select className="input" value={form.active ? '1' : '0'} onChange={e => setForm({ ...form, active: e.target.value === '1' })}>
            <option value="1">Active (visible)</option><option value="0">Hidden</option></select></Field>
        </div>
        <Field label="Short Bio"><textarea className="input" rows={3} value={form.bio || ''} onChange={e => setForm({ ...form, bio: e.target.value })} /></Field>
        <div className="flex gap-3 mt-2"><button className="btn-ghost flex-1" onClick={() => setForm(null)}>Cancel</button>
          <button className="btn-gold flex-1" onClick={save}>Save</button></div>
      </div>
    </div>}
  </div>;
}
