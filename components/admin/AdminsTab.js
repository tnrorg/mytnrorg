'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { SCOPES, ALL_SCOPES } from '@/lib/adminScopes';

// A new admin starts with nothing ticked. Pre-ticking every area would make
// "full access" the path of least resistance, which is the opposite of the
// point of having areas at all.
const BLANK = { username: '', full_name: '', password: '', role: 'admin', scopes: [] };

export default function AdminsTab({ toast, me }) {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(null);   // null = closed
  const [busy, setBusy] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);

  const load = () => aGet('/api/admin/admins').then(r => {
    if (!r.ok) return;
    setAdmins(r.admins || []);
    setMigrationPending(!!r.migration_pending);
  });
  useEffect(() => { load(); }, []);

  const isSuper = form?.role === 'super_admin';
  const chosen = isSuper ? ALL_SCOPES : (form?.scopes || []);

  const toggle = (key) => setForm(f => ({
    ...f,
    scopes: f.scopes.includes(key) ? f.scopes.filter(s => s !== key) : [...f.scopes, key],
  }));

  async function save() {
    setBusy(true);
    const body = {
      full_name: form.full_name, role: form.role, scopes: chosen,
      ...(form.password ? { password: form.password } : {}),
    };
    const r = form.id
      ? await aPatch('/api/admin/admins/' + form.id, body)
      : await aPost('/api/admin/admins', { ...body, username: form.username, password: form.password });
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

  // What this account can reach, named. A row that only says "ADMIN" tells you
  // nothing about what that person can actually open.
  const AreaChips = ({ a }) => {
    if (a.role === 'super_admin')
      return <span className="text-[11px] text-tnr-gold/70">All areas</span>;
    if (!a.scopes?.length)
      return <span className="text-[11px] text-red-300">No areas — cannot use the panel</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {a.scopes.map(k => {
          const s = SCOPES.find(x => x.key === k);
          return (
            <span key={k} className="px-1.5 py-0.5 rounded-md bg-white/5 text-[10px] text-tnr-cream/60">
              {s?.icon} {s?.label || k}
            </span>
          );
        })}
      </div>
    );
  };

  const canSave = form && form.username
    && (form.id || form.password.length >= 8)
    && (isSuper || chosen.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-xl font-bold text-tnr-cream">Admin Accounts</h2>
          <p className="text-sm text-tnr-cream/50 mt-1">
            Super Admins can reach everything, including admin management and Committee Vote Entry.
            A normal Admin sees only the areas you tick — an election officer can be given the
            Election Portal and nothing else.
          </p>
        </div>
        <button onClick={() => setForm({ ...BLANK })} className="px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm">
          + Add Admin
        </button>
      </div>

      {/* The column is missing, so every admin still has full access. Said out
          loud, because a permissions screen that silently does nothing is
          worse than one that isn't there. */}
      {migrationPending && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <b>Permissions are not active yet.</b> Run <code>migration_admin_scopes.sql</code> in
          Supabase, then reload this page. Until then every admin keeps full access.
        </div>
      )}

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
              <div className="mt-1.5"><AreaChips a={a} /></div>
            </div>
            <button onClick={() => setForm({
              id: a.id, username: a.username, full_name: a.full_name || '',
              role: a.role, password: '', scopes: a.scopes || [],
            })}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-tnr-cream/70 hover:bg-white/5">Edit</button>
            <button onClick={() => remove(a)}
              className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-300 hover:bg-red-500/10">Delete</button>
          </div>
        ))}
        {!admins.length && <div className="px-4 py-6 text-sm text-tnr-cream/50">No admin accounts found.</div>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm overflow-auto" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-tnr-black p-5 space-y-3 my-8" onClick={e => e.stopPropagation()}>
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
            </div>

            {/* ── Areas ── */}
            <div>
              <label className="block text-xs text-tnr-cream/50 mb-2">
                Areas this admin can work in
              </label>

              {isSuper ? (
                <p className="text-[11px] text-tnr-gold/70 rounded-xl border border-tnr-gold/20 bg-tnr-gold/5 px-3 py-2.5">
                  Super Admins reach every area, plus admin management, Voter Data,
                  Visitors and Committee Vote Entry. Areas cannot be limited for this role.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {SCOPES.map(s => {
                    const on = chosen.includes(s.key);
                    return (
                      <button key={s.key} type="button" onClick={() => toggle(s.key)}
                        className={`w-full text-left flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                          on ? 'border-tnr-gold/50 bg-tnr-gold/10' : 'border-white/10 hover:bg-white/5'}`}>
                        <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border grid place-items-center text-[10px] ${
                          on ? 'bg-tnr-gold border-tnr-gold text-tnr-black' : 'border-white/25 text-transparent'}`}>✓</span>
                        <span className="min-w-0">
                          <span className={`block text-sm font-semibold ${on ? 'text-tnr-cream' : 'text-tnr-cream/70'}`}>
                            {s.icon} {s.label}
                          </span>
                          <span className="block text-[11px] text-tnr-cream/40 leading-snug">{s.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                  {!chosen.length && (
                    <p className="text-[11px] text-red-300 pt-1">
                      Pick at least one. An admin with no areas can sign in but reach nothing.
                    </p>
                  )}
                  <p className="text-[11px] text-tnr-cream/40 pt-1 leading-relaxed">
                    Everyone also gets the Dashboard and My Security.
                    {form.id && ' Changes apply the next time this admin signs in — within 12 hours, or straight away if they sign out.'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setForm(null)} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-tnr-cream">Cancel</button>
              <button onClick={save} disabled={busy || !canSave}
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
