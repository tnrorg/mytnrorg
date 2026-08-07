'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Badge, Field } from './ui';

const empty = { name: '', position_id: '', symbol: '', symbol_data: null, symbol_url: '', union_id: '', manifesto: '', education: '', status: 'Active', photo_data: null, photo_url: '' };
export default function CandidatesTab({ toast, elections }) {
  const [electionId, setElectionId] = useState('');
  const [cands, setCands] = useState([]); const [positions, setPositions] = useState([]); const [unions, setUnions] = useState([]);
  const [form, setForm] = useState(null);
  useEffect(() => { aGet('/api/admin/unions').then(r => r.ok && setUnions(r.unions)); }, []);
  useEffect(() => { if (elections?.length && !electionId) setElectionId(elections[0].id); }, [elections]);
  const load = () => { if (!electionId) return; aGet('/api/admin/candidates?election_id=' + electionId).then(r => { if (r.ok) { setCands(r.candidates); setPositions(r.positions); } }); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [electionId]);
  const pname = id => positions.find(p => p.id === id)?.title || '—';
  const uname = id => unions.find(u => u.id === id)?.union_name || '—';

  async function pickPhoto(e) { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setForm(s => ({ ...s, photo_data: rd.result, photo_url: rd.result })); rd.readAsDataURL(f); }
  async function pickSymbol(e) { const f = e.target.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setForm(s => ({ ...s, symbol_data: rd.result, symbol_url: rd.result })); rd.readAsDataURL(f); }
  async function save() {
    if (!form.position_id) return toast('Please select a Position for this candidate — candidates without a position do not show on the site.', 'err');
    const body = { ...form, election_id: electionId, position_id: form.position_id ? Number(form.position_id) : null, union_id: form.union_id ? Number(form.union_id) : null };
    const r = form.id ? await aPatch('/api/admin/candidates/' + form.id, body) : await aPost('/api/admin/candidates', body);
    if (!r.ok) return toast(r.message, 'err'); toast('Saved'); setForm(null); load();
  }
  async function del(c) { if (!confirm('Delete ' + c.name + '?')) return; const r = await aDel('/api/admin/candidates/' + c.id); if (!r.ok) return toast(r.message, 'err'); toast('Deleted'); load(); }

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 items-center">
      <select className="input max-w-xs" value={electionId} onChange={e => setElectionId(e.target.value)}>
        {elections?.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
      <div className="flex-1" />
      <button className="btn-green" onClick={() => setForm({ ...empty })} disabled={!electionId}>+ Add Candidate</button>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cands.map(c => <Card key={c.id} className="!p-4">
        <div className="flex gap-3">
          <div className="relative shrink-0">
            <img src={c.photo_url || '/tnr-logo.png'} className="w-16 h-16 rounded-xl object-cover border border-tnr-line" alt="" />
            {c.symbol_url && <img src={c.symbol_url} className="absolute -bottom-1 -right-1 w-7 h-7 rounded-md object-cover border border-tnr-gold bg-white" alt="symbol" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-tnr-cream truncate">{c.name}</div>
            <div className="text-xs text-tnr-cream/60">{pname(c.position_id)}</div>
            <div className="text-xs text-tnr-cream/50">{c.symbol || '—'} · {uname(c.union_id)}</div>
            <div className="mt-1 flex gap-1 flex-wrap"><Badge>{c.status}</Badge>{!c.position_id && <span className="chip bg-red-500/20 text-red-300">⚠ No position — hidden on site</span>}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn-ghost !py-1.5 flex-1 text-sm" onClick={() => setForm({ ...c, position_id: c.position_id || '', union_id: c.union_id || '' })}>Edit</button>
          <button className="btn-ghost !py-1.5 text-sm" onClick={() => del(c)}>Del</button>
        </div>
      </Card>)}
      {!cands.length && <p className="text-tnr-cream/40 col-span-full text-center py-8">No candidates yet.</p>}
    </div>

    {form && <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
      <div className="card p-6 w-full max-w-lg animate-pop max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-tnr-goldLight text-lg mb-4">{form.id ? 'Edit' : 'Add'} Candidate</h3>
        <div className="flex items-center gap-4 mb-3">
          <img src={form.photo_url || '/tnr-logo.png'} className="w-20 h-20 rounded-xl object-cover border border-tnr-line" alt="" />
          <label className="btn-ghost cursor-pointer text-sm">Upload Photo<input type="file" accept="image/*" hidden onChange={pickPhoto} /></label>
          <div className="w-px h-12 bg-tnr-line" />
          <img src={form.symbol_url || '/tnr-logo.png'} className="w-14 h-14 rounded-lg object-cover border border-tnr-gold/50 bg-white/5" alt="symbol" />
          <label className="btn-ghost cursor-pointer text-sm">Symbol / Flag<input type="file" accept="image/*" hidden onChange={pickSymbol} /></label>
        </div>
        <Field label="Name *"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Position *"><select className="input" value={form.position_id || ''} onChange={e => setForm({ ...form, position_id: e.target.value })}>
            <option value="">—</option>{positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
          <Field label="Symbol (name)"><input className="input" value={form.symbol || ''} onChange={e => setForm({ ...form, symbol: e.target.value })} /></Field>
          <Field label="Union / Area"><select className="input" value={form.union_id || ''} onChange={e => setForm({ ...form, union_id: e.target.value })}>
            <option value="">—</option>{unions.map(u => <option key={u.id} value={u.id}>{u.union_name}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option>Active</option><option>Hidden</option></select></Field>
        </div>
        <Field label="Education / Background"><input className="input" value={form.education || ''} onChange={e => setForm({ ...form, education: e.target.value })} /></Field>
        <Field label="Short Manifesto"><textarea className="input" rows={3} value={form.manifesto || ''} onChange={e => setForm({ ...form, manifesto: e.target.value })} /></Field>
        <div className="flex gap-3 mt-2"><button className="btn-ghost flex-1" onClick={() => setForm(null)}>Cancel</button><button className="btn-gold flex-1" onClick={save}>Save</button></div>
      </div>
    </div>}
  </div>;
}
