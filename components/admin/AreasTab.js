'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card } from './ui';

export default function AreasTab({ toast }) {
  const [councils, setCouncils] = useState(null);
  const [err, setErr] = useState('');
  const [newUc, setNewUc] = useState('');
  const [newVillage, setNewVillage] = useState({});   // { [councilId]: name }

  async function load() {
    setErr('');
    const r = await aGet('/api/admin/areas');
    if (!r?.ok) { setErr(r?.message || 'Could not load areas.'); setCouncils([]); return; }
    setCouncils(r.councils || []);
  }
  useEffect(() => { load(); }, []);

  async function addCouncil() {
    const name = newUc.trim(); if (!name) return;
    const r = await aPost('/api/admin/areas', { type: 'council', name });
    if (!r?.ok) return toast(r?.message || 'Could not add', 'err');
    setNewUc(''); toast('Union council added'); load();
  }
  async function addVillage(ucId) {
    const name = (newVillage[ucId] || '').trim(); if (!name) return;
    const r = await aPost('/api/admin/areas', { type: 'village', name, union_council_id: ucId });
    if (!r?.ok) return toast(r?.message || 'Could not add', 'err');
    setNewVillage(v => ({ ...v, [ucId]: '' })); toast('Village added'); load();
  }
  async function rename(type, row) {
    const name = prompt('New name', row.name); if (!name || name === row.name) return;
    const r = await aPatch(`/api/admin/areas/${row.id}`, { type, name });
    if (!r?.ok) return toast(r?.message || 'Could not rename', 'err');
    // Report how many member records were corrected — silently rewriting
    // people's data without saying so would be worse than not doing it.
    toast(r.message || 'Renamed'); load();
  }
  async function toggle(type, row) {
    const r = await aPatch(`/api/admin/areas/${row.id}`, { type, active: !row.active });
    if (!r?.ok) return toast(r?.message || 'Could not update', 'err');
    load();
  }
  async function remove(type, row) {
    const extra = type === 'council' ? '\n\nIts villages will be deleted too.' : '';
    if (!confirm(`Delete “${row.name}”?${extra}\n\n` +
      `Members already listed under it keep the name on their record — they are not ` +
      `changed or removed, but the area will no longer appear in the dropdowns.`)) return;
    const r = await aDel(`/api/admin/areas/${row.id}?type=${type}`);
    if (!r?.ok) return toast(r?.message || 'Could not delete', 'err');
    toast(r.message || 'Deleted', r.affected ? 'err' : 'ok'); load();
  }

  const input = 'rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-tnr-cream outline-none focus:border-tnr-gold';
  const pill = 'text-[11px] px-2 py-0.5 rounded-full';

  if (!councils) return <Card><div className="text-sm text-tnr-cream/60">Loading areas…</div></Card>;

  return <div className="space-y-4 max-w-3xl">
    <p className="text-sm text-tnr-cream/60">
      Union Councils and their Villages / Areas. These populate the dropdowns on the
      membership application form, so applicants choose from this list instead of typing
      their own spelling — which is what keeps the members analytics grouped correctly.
    </p>
    {err && <Card><div className="text-sm text-red-300">{err}
      <div className="text-xs text-tnr-cream/40 mt-1">Run supabase/migration_areas.sql</div></div></Card>}

    <Card>
      <h3 className="font-black text-tnr-cream mb-2">Add Union Council</h3>
      <div className="flex gap-2">
        <input className={input + ' flex-1'} value={newUc} placeholder="e.g. Roundu"
          onChange={e => setNewUc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCouncil()} />
        <button className="btn-green" onClick={addCouncil}>Add</button>
      </div>
    </Card>

    {councils.length === 0 && !err && (
      <Card><div className="text-sm text-tnr-cream/50 text-center py-6">
        No union councils yet. Add the first one above.
      </div></Card>
    )}

    {councils.map(uc => (
      <Card key={uc.id}>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-black text-tnr-cream">{uc.name}</h3>
          <span className={pill} style={{ background: '#ffffff12', color: '#D9D2C3' }}>
            {uc.villages.length} village{uc.villages.length === 1 ? '' : 's'}
          </span>
          {!uc.active && <span className={pill} style={{ background: '#DC262622', color: '#FCA5A5' }}>Hidden</span>}
          <div className="ml-auto flex gap-2 text-xs">
            <button className="text-tnr-cream/60 hover:text-tnr-cream" onClick={() => rename('council', uc)}>Rename</button>
            <button className="text-tnr-cream/60 hover:text-tnr-cream" onClick={() => toggle('council', uc)}>
              {uc.active ? 'Hide' : 'Show'}
            </button>
            <button className="text-red-400 hover:text-red-300" onClick={() => remove('council', uc)}>Delete</button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {uc.villages.map(v => (
            <span key={v.id}
              className="inline-flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1 text-xs"
              style={{ background: '#ffffff0d', color: v.active ? '#EDE7D9' : '#8A8578' }}>
              {v.name}{!v.active && ' (hidden)'}
              <button onClick={() => rename('village', v)} className="opacity-50 hover:opacity-100" title="Rename">✎</button>
              <button onClick={() => toggle('village', v)} className="opacity-50 hover:opacity-100" title={v.active ? 'Hide' : 'Show'}>
                {v.active ? '◐' : '○'}
              </button>
              <button onClick={() => remove('village', v)} className="opacity-50 hover:opacity-100 text-red-400" title="Delete">×</button>
            </span>
          ))}
          {uc.villages.length === 0 && <span className="text-xs text-tnr-cream/30">No villages yet</span>}
        </div>

        <div className="mt-3 flex gap-2">
          <input className={input + ' flex-1'} placeholder="Add a village / area"
            value={newVillage[uc.id] || ''}
            onChange={e => setNewVillage(v => ({ ...v, [uc.id]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addVillage(uc.id)} />
          <button className="btn-ghost" onClick={() => addVillage(uc.id)}>Add</button>
        </div>
      </Card>
    ))}
  </div>;
}
