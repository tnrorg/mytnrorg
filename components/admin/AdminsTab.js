'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';

const BLANK = { username: '', full_name: '', password: '', role: 'admin' };

export default function AdminsTab({ toast, me }) {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(null);   // null = closed
  const [busy, setBusy] = useState(false);

  const load = () => aGet('/api/admin/admins').then(r => { if (r.ok) setAdmins(r.admins || []); });
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true);
    const r = form.id
      ? await aPatch('/api/admin/admins/' + form.id,
          { full_name: form.full_name, role: form.role, ...(form.password ? { password: form.password } : {}) })
      : await aPost('/api/admin/admins', form);
    setBusy(false);
    if (!r.ok) return toast?.(r.message || 'Failed.', 'error');
    toast?.(form.id ? 'Admin updated.' : 'Admin created.', 'success');
    setForm(null); load();
  }

  async function remove(a) {
    if (!confirm(`Delete admin "${a.username}"? This cannot be undone.`)) return;
    const r = await aDel('/api/admin/admins/' + a.id);
    if (!r.ok) return toast?.(r.message || 'Failed.', 'error');
    toast?.('Admin deleted.', 'success'); load();
  }

  const Badge = ({ role }) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
      role === 'super_admin' ? 'bg-tnr-gold text-tnr-black' : 'bg-white/10 text-tnr-cream/70'}`}>
      {role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-xl font-bold text-tnr-cream">Admin Accounts</h2>
          <p className="text-sm text-tnr-cream/50 mt-1">
            Super Admins can do everything, including Committee Vote Entry. Normal Admins cannot see or use it.
          </p>
        </div>
        <button onClick={() => setForm({ ...BLANK })} className="px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm">
          + Add Admin
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 divide-y divide-white/10">
        {admins.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-tnr-cream">{a.username}</span>
                <Badge role={a.role} />
                {me?.username === a.username && <span className="text-[10px] text-tnr-cream/40">(you)</span>}
              </div>
              {a.full_name && <div className="text-xs text-tnr-cream/50">{a.full_name}</div>}
            </div>
            <button onClick={() => setForm({ id: a.id, username: a.username, full_name: a.full_name || '', role: a.role, password: '' })}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-tnr-cream/70 hover:bg-white/5">Edit</button>
            <button onClick={() => remove(a)}
              className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-300 hover:bg-red-500/10">Delete</button>
          </div>
        ))}
        {!admins.length && <div className="px-4 py-6 text-sm text-tnr-cream/50">No admin accounts found.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-tnr-black p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-tnr-cream">{form.id ? 'Edit Admin' : 'Add Admin'}</h3>

            <div>
              <label className="block text-xs text-tnr-cream/50 mb-1">Username</label>
              <input value={form.username} disabled={!!form.id}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream disabled:opacity-50" />
            </div>

            <div>
              <label className="block text-xs text-tnr-cream/50 mb-1">Full name</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream" />
            </div>

            <div>
              <label className="block text-xs text-tnr-cream/50 mb-1">
                {form.id ? 'New password (leave blank to keep current)' : 'Password (minimum 8 characters)'}
              </label>
              <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream" />
            </div>

            <div>
              <label className="block text-xs text-tnr-cream/50 mb-2">Role</label>
              <div className="flex gap-2">
                {[['admin', 'Admin'], ['super_admin', 'Super Admin']].map(([k, l]) => (
                  <button key={k} onClick={() => setForm({ ...form, role: k })}
                    className={`px-3 py-2 rounded-xl text-sm border transition ${form.role === k
                      ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
                      : 'border-white/10 text-tnr-cream/70 hover:bg-white/5'}`}>{l}</button>
                ))}
              </div>
              <p className="text-[11px] text-tnr-cream/40 mt-2">
                {form.role === 'super_admin'
                  ? 'Full access, including Committee Vote Entry and admin management.'
                  : 'Members, candidates, elections, committee, reminders and results. No Committee Vote Entry.'}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setForm(null)} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-tnr-cream">Cancel</button>
              <button onClick={save} disabled={busy || !form.username || (!form.id && form.password.length < 8)}
                className="flex-1 px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm disabled:opacity-40">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
