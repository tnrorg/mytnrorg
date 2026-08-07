'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Badge, Field } from './ui';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ElectionsTab({ toast, admin, reloadElections }) {
  const [elections, setElections] = useState([]); const [positions, setPositions] = useState([]); const [settings, setSettings] = useState([]);
  const [form, setForm] = useState(null);
  const load = () => aGet('/api/admin/elections').then(r => { if (r.ok) { setElections(r.elections); setPositions(r.positions); setSettings(r.settings); } });
  useEffect(() => { load(); }, []);
  const posOf = eid => positions.filter(p => p.election_id === eid);
  const setOf = eid => settings.find(s => s.election_id === eid) || {};

  async function save() {
    // datetime-local gives a naive LOCAL time; convert to a proper UTC instant so
    // storage and display always agree (prevents the timezone shift / drift-on-re-edit bug).
    const toIso = v => (v ? new Date(v).toISOString() : null);
    const body = { title: form.title, description: form.description, starts_at: toIso(form.starts_at), ends_at: toIso(form.ends_at) };
    const r = form.id
      ? await aPatch('/api/admin/elections/' + form.id, body)
      : await aPost('/api/admin/elections', { ...body, positions: form.positions });
    if (!r.ok) return toast(r.message, 'err');
    toast(form.id ? 'Election updated' : 'Election created'); setForm(null); load(); reloadElections?.();
  }
  async function setStatus(e, status) {
    const r = await aPatch('/api/admin/elections/' + e.id, { status });
    if (!r.ok) return toast(r.message, 'err'); toast('Status: ' + status); load(); reloadElections?.();
  }
  async function publish(e, val) { const r = await aPatch('/api/admin/elections/' + e.id, { result_published: val }); if (!r.ok) return toast(r.message, 'err'); toast(val ? 'Results published' : 'Results hidden'); load(); }
  async function saveSettings(eid, patch) {
    const r = await aPatch('/api/admin/settings', { election_id: eid, ...patch });
    if (!r.ok) return toast(r.message, 'err'); toast('Settings saved'); load();
  }
  async function duplicate(e) {
    const r = await aPost('/api/admin/elections/duplicate', { election_id: e.id });
    if (!r.ok) return toast(r.message, 'err'); toast('Duplicated as draft'); load(); reloadElections?.();
  }

  async function resetElection(e) {
    const probe = await aPost('/api/admin/elections/' + e.id + '/reset', {});
    const votes = probe?.votes ?? 0;
    const msg = 'RESET "' + e.title + '"\n\n'
      + 'This permanently deletes ' + votes + ' vote(s) and all receipts,\n'
      + 'so every member can vote again from the beginning.\n\n'
      + 'Candidates, positions and members are NOT deleted.\n\n'
      + 'Type RESET to confirm:';
    const answer = prompt(msg);
    if (answer !== 'RESET') return;
    const reopen = confirm('Also set this election back to ACTIVE so voting starts immediately?\n\nOK = reopen now   ·   Cancel = leave status unchanged');
    const r = await aPost('/api/admin/elections/' + e.id + '/reset', { confirm: 'RESET', reopen, unlock: true });
    if (!r.ok) return toast(r.message || 'Reset failed', 'err');
    toast('Election reset — ' + (r.cleared_votes || 0) + ' vote(s) cleared');
    load(); reloadElections?.();
  }

  async function del(e) {
    if (!confirm('Delete "' + e.title + '"?\nThis removes its positions and candidates.')) return;
    let r = await aDel('/api/admin/elections/' + e.id);
    if (!r.ok && (r.error === 'HAS_DATA' || r.error === 'HAS_VOTES')) {
      const msg = 'WARNING — this election contains:\n\n'
        + '  • ' + (r.candidates ?? 0) + ' candidate(s)\n'
        + '  • ' + (r.votes ?? 0) + ' vote(s)\n\n'
        + 'Deleting the election permanently removes them too.\n'
        + 'If you only want to remove a candidate, cancel and delete it from the Candidates tab instead.\n\n'
        + 'Delete everything anyway?';
      if (!confirm(msg)) return;
      r = await aDel('/api/admin/elections/' + e.id + '?force=1');
    }
    if (!r.ok) return toast(r.message, 'err'); toast('Election deleted'); load(); reloadElections?.();
  }
  async function addPosition(e, title) {
    if (!title.trim()) return;
    const r = await aPost('/api/admin/positions', { election_id: e.id, title: title.trim() });
    if (!r.ok) return toast(r.message, 'err'); toast('Position added'); load();
  }
  async function delPosition(p) {
    if (!confirm('Remove position "' + p.title + '"?')) return;
    const r = await aDel('/api/admin/positions/' + p.id);
    if (!r.ok) return toast(r.message, 'err'); toast('Position removed'); load();
  }

  return <div className="space-y-4">
    <div className="flex justify-end"><button className="btn-green" onClick={() => setForm({ title: '', description: '', starts_at: '', ends_at: '', positions: ['President', 'Vice President', 'General Secretary', 'Information Secretary'] })}>+ Create Election</button></div>

    {elections.map(e => { const st = setOf(e.id); return (
      <Card key={e.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-tnr-cream text-lg">{e.title}</h3><Badge>{e.status}</Badge>
              {e.result_published && <Badge>📢 Published</Badge>}</div>
            <p className="text-sm text-tnr-cream/60 mt-1">{e.description}</p>
            <p className="text-xs text-tnr-cream/40 mt-1">{e.starts_at ? new Date(e.starts_at).toLocaleString() : '—'} → {e.ends_at ? new Date(e.ends_at).toLocaleString() : '—'}</p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="chip bg-tnr-green2/40 text-tnr-goldLight">{(e.candidate_count?.active ?? 0)} active candidates</span>
              {e.candidate_count?.no_position > 0 && <span className="chip bg-red-500/20 text-red-300">{e.candidate_count.no_position} without a position</span>}
            </div>
            <p className="text-xs text-tnr-cream/40 mt-2">Every approved member can vote.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn-ghost !py-1.5 !px-3 text-sm" onClick={() => setForm({ id: e.id, title: e.title, description: e.description || '', starts_at: toLocalInput(e.starts_at), ends_at: toLocalInput(e.ends_at) })}>✏️ Edit</button>
            <button className="btn-ghost !py-1.5 !px-3 text-sm" onClick={() => duplicate(e)}>⧉ Duplicate</button>
            <button className="btn-ghost !py-1.5 !px-3 text-sm text-amber-300 border-amber-500/30" onClick={() => resetElection(e)}>↺ Reset Votes</button>
            <button className="btn-ghost !py-1.5 !px-3 text-sm text-red-300 border-red-500/30" onClick={() => del(e)}>🗑 Delete</button>
          </div>
        </div>

        {/* Positions manager */}
        <PositionManager positions={posOf(e.id)} locked={false} onAdd={t => addPosition(e, t)} onDel={delPosition} />

        <div className="gold-divider my-3" />
        <div className="flex flex-wrap gap-2">

          {e.status !== 'Active' && <button className="btn-green !py-2 text-sm" onClick={() => setStatus(e, 'Active')}>▶ Start</button>}
          {e.status === 'Active' && <button className="btn-ghost !py-2 text-sm" onClick={() => setStatus(e, 'Paused')}>⏸ Pause</button>}
          {e.status !== 'Ended' && <button className="btn-ghost !py-2 text-sm" onClick={() => setStatus(e, 'Ended')}>⏹ End</button>}
          {!e.result_published ? <button className="btn-ghost !py-2 text-sm" onClick={() => publish(e, true)}>📢 Publish Results</button>
            : <button className="btn-ghost !py-2 text-sm" onClick={() => publish(e, false)}>Hide Results</button>}
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-tnr-goldLight">Fairness / Result settings</summary>
          <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
            <Check label="Hide candidate results during voting" v={st.hide_results_during} on={v => saveSettings(e.id, { hide_results_during: v })} />
            <Check label="Show only participation while voting" v={st.show_participation_only} on={v => saveSettings(e.id, { show_participation_only: v })} />
            <Check label="Show full results after election ends" v={st.show_full_after_end} on={v => saveSettings(e.id, { show_full_after_end: v })} />
            <Check label="Admin live result preview" v={st.admin_live_preview} on={v => saveSettings(e.id, { admin_live_preview: v })} />
          </div>
          <div className="mt-3">
            <span className="label">Public result visibility (fairness)</span>
            <select className="input" value={st.result_mode || 'after_close'} onChange={ev => saveSettings(e.id, { result_mode: ev.target.value })}>
              <option value="after_close">Hide vote data until election closes (recommended)</option>
              <option value="hidden">Hide all results (until published)</option>
              <option value="leading">Show leading status only (no numbers)</option>
              <option value="percent">Show percentages + leading (no exact counts)</option>
              <option value="full">Show exact vote counts live</option>
            </select>
          </div>
        </details>
      </Card>); })}

    {form && <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
      <div className="card p-6 w-full max-w-lg animate-pop max-h-[90vh] overflow-auto" onClick={ev => ev.stopPropagation()}>
        <h3 className="font-bold text-tnr-goldLight text-lg mb-4">{form.id ? 'Edit Election' : 'Create Election'}</h3>
        <Field label="Title *"><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Start"><input type="datetime-local" className="input" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></Field>
          <Field label="End"><input type="datetime-local" className="input" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></Field>
        </div>
        {!form.id && <Field label="Positions (comma separated)"><input className="input" value={form.positions.join(', ')} onChange={e => setForm({ ...form, positions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></Field>}
        <div className="flex gap-3 mt-2"><button className="btn-ghost flex-1" onClick={() => setForm(null)}>Cancel</button><button className="btn-gold flex-1" onClick={save}>{form.id ? 'Save' : 'Create'}</button></div>
      </div>
    </div>}
  </div>;
}

function PositionManager({ positions, onAdd, onDel, locked }) {
  const [val, setVal] = useState('');
  return <div className="mt-3">
    <div className="text-xs uppercase tracking-wider text-tnr-cream/40 mb-1.5">Positions</div>
    <div className="flex flex-wrap gap-1.5 items-center">
      {positions.map(p => <span key={p.id} className="chip bg-white/5 text-tnr-cream/80 pr-1">{p.title}
        <button className="ml-1 w-4 h-4 grid place-items-center rounded-full hover:bg-red-500/30 text-red-300" title="Remove" onClick={() => onDel(p)}>×</button></span>)}
      {!positions.length && <span className="text-tnr-cream/40 text-sm">No positions.</span>}
    </div>
    <div className="flex gap-2 mt-2 max-w-sm">
      <input className="input !py-1.5 text-sm" placeholder="Add position…" value={val}
        onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onAdd(val); setVal(''); } }} />
      <button className="btn-green !py-1.5 !px-3 text-sm" onClick={() => { onAdd(val); setVal(''); }}>Add</button>
    </div>
  </div>;
}
function Check({ label, v, on }) {
  return <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white/5">
    <input type="checkbox" checked={!!v} onChange={e => on(e.target.checked)} className="w-4 h-4 accent-tnr-gold" />
    <span className="text-tnr-cream/80">{label}</span></label>;
}
