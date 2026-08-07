'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPatch, mPost, clearToken } from '@/components/member/memberApi';
const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const base = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0B6B4F] bg-white text-[#15231D]';

export default function Settings() {
  const [m, setM] = useState(null);
  const [wa, setWa] = useState(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });

  const load = () => {
    mGet('/api/member/me').then(r => r.ok && setM(r.member));
    mGet('/api/member/settings').then(r => r.ok && setWa(r));
  };
  useEffect(() => { load(); }, []);

  const toggle = async (k, v) => {
    setMsg(''); const r = await mPatch('/api/member/settings', { [k]: v });
    if (r.ok) { setMsg('Settings saved.'); load(); }
  };
  const changePw = async () => {
    setErr(''); setMsg('');
    if (pw.new_password !== pw.confirm) return setErr('New passwords do not match.');
    const r = await mPatch('/api/member/settings', { current_password: pw.current_password, new_password: pw.new_password });
    if (!r.ok) return setErr(r.message || 'Could not change password.');
    setMsg('Password changed. Other devices have been signed out.');
    setPw({ current_password: '', new_password: '', confirm: '' });
  };
  const logoutAll = async () => {
    if (!confirm('Sign out from all devices?')) return;
    await mPost('/api/member/logout-all', {});
    clearToken(); window.location.href = '/member/login';
  };

  if (!m) return <MemberShell active="/member/settings"><p className="text-gray-400">Loading…</p></MemberShell>;

  return (
    <MemberShell active="/member/settings">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Account Settings</h1>
      {msg && <div className="mt-3 rounded-xl px-4 py-2 text-sm" style={{ background: '#0B6B4F14', color: C.deep }}>{msg}</div>}
      {err && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{err}</div>}

      <Card title="Privacy">
        {/* The public-directory toggle was removed: every approved member now
            appears in the directory as a matter of TNR policy. It was opt-in
            and nobody knew it existed, so the directory stayed empty.
            Contact details were never public and still are not. */}
        <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: '#647169' }}>
          Your name, photo, village, Union Council and profession appear in the
          public member directory. Your email, phone number and date of birth are
          never shown publicly.
        </p>
        <Toggle label="I want to join the official TNR WhatsApp group"
          checked={!!m.whatsapp_opt_in} onChange={v => toggle('whatsapp_opt_in', v)} />
        {m.whatsapp_opt_in && (
          <div className="mt-3">
            {wa?.whatsapp_link
              ? <a href={wa.whatsapp_link} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: '#25D366' }}>Join WhatsApp Group</a>
              : <p className="text-xs text-gray-400">{wa?.reason || 'Group link not available yet.'}</p>}
          </div>
        )}
      </Card>

      <Card title="Password">
        {[['current_password', 'Current Password'], ['new_password', 'New Password'], ['confirm', 'Confirm New Password']].map(([k, l]) => (
          <div key={k} className="mb-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">{l}</label>
            <input type="password" value={pw[k]} onChange={e => setPw({ ...pw, [k]: e.target.value })} className={base} />
          </div>
        ))}
        <button onClick={changePw} disabled={!pw.current_password || !pw.new_password}
          className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Change Password</button>
      </Card>

      <Card title="Sessions">
        <button onClick={logoutAll} className="px-5 py-2.5 rounded-xl text-sm font-bold text-red-600 border border-red-200">
          Sign out from all devices
        </button>
      </Card>

      <Card title="Membership">
        <p className="text-sm text-gray-500">
          Membership ID <b className="font-mono" style={{ color: C.deep }}>{m.membership_id}</b> ·
          Status <b className="uppercase">{m.status}</b>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Your Membership ID and status can only be changed by the membership committee.
          To request other changes, visit <a href="/member/profile" className="font-semibold" style={{ color: C.green }}>My Profile</a>.
        </p>
      </Card>
    </MemberShell>
  );
}

const Card = ({ title, children }) => (
  <div className="mt-5 rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
    <h2 style={{ ...mont, color: C.deep }} className="text-sm font-black uppercase tracking-wide mb-3">{title}</h2>
    {children}
  </div>
);
const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-3 py-1.5 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4" />
    <span className="text-sm text-gray-600">{label}</span>
  </label>
);
