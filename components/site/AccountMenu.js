'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, User, PenLine, LogOut } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

const G = '#063D2B';

/* Signed-in member, on the public site.
 *
 * WHY IT STARTS AS NULL AND NOT AS "SIGNED OUT"
 * The token lives in localStorage, which does not exist while the page is
 * server-rendered. Rendering LOGIN/REGISTER first and swapping to the avatar a
 * moment later gives every signed-in member a visible flash of the wrong
 * state on every single page load. So this renders NOTHING until it knows,
 * and the slot holds its width so the header does not jump.
 *
 * The token is checked against the server rather than trusted: an expired or
 * revoked session must show LOGIN, not a name it read out of a stale token.
 */
export default function AccountMenu({ variant = 'desktop', onNavigate }) {
  const [me, setMe] = useState(undefined);   // undefined = unknown, null = signed out
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let off = false;
    let token = null;
    try { token = localStorage.getItem('tnr_member_token'); } catch { /* storage blocked */ }
    if (!token) { setMe(null); return; }

    fetch('/api/member/me', {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        if (j?.ok && j.member) { setMe(j.member); return; }
        // Expired, revoked, or the account was suspended. Clear it, so the
        // next page load does not repeat this request for a dead token.
        try { localStorage.removeItem('tnr_member_token'); } catch { /* ignore */ }
        setMe(null);
      })
      .catch(() => { if (!off) setMe(null); });   // offline: treat as signed out

    return () => { off = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function signOut() {
    try { localStorage.removeItem('tnr_member_token'); } catch { /* ignore */ }
    // Full reload rather than a router push: every component holding member
    // state — the like buttons among them — needs to forget who this was.
    window.location.href = '/';
  }

  const firstName = (me?.first_name || me?.full_name || 'Member').split(' ')[0];

  /* ── Mobile drawer ── */
  if (variant === 'mobile') {
    if (me === undefined) return null;
    if (!me) return (
      <>
        <a href="/membership/apply" onClick={onNavigate}
          className="block text-center px-4 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(180deg,#0B6B4F,#063D2B)' }}>
          Register as a Member
        </a>
        <a href="/member/login" onClick={onNavigate}
          className="block text-center px-4 py-3 rounded-xl text-sm font-bold border"
          style={{ borderColor: 'rgba(6,61,43,.18)', color: G }}>
          Member Login
        </a>
        <a href="/membership/status" onClick={onNavigate}
          className="block text-center px-4 py-2 text-[12px] font-semibold text-gray-500">
          Check application status
        </a>
      </>
    );

    return (
      <>
        <div className="flex items-center gap-3 px-1 pb-1">
          <Avatar src={me.photo_url} gender={me.gender} name={me.full_name || 'Member'}
            className="w-11 h-11 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate" style={{ color: G }}>{me.full_name}</div>
            <div className="text-[11px] text-gray-500 truncate">{me.membership_id}</div>
          </div>
        </div>
        <a href="/member/dashboard" onClick={onNavigate}
          className="block text-center px-4 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(180deg,#0B6B4F,#063D2B)' }}>
          My Portal
        </a>
        <a href="/member/profile" onClick={onNavigate}
          className="block text-center px-4 py-3 rounded-xl text-sm font-bold border"
          style={{ borderColor: 'rgba(6,61,43,.18)', color: G }}>
          My Profile
        </a>
        <button onClick={signOut}
          className="block w-full text-center px-4 py-2 text-[12px] font-semibold text-gray-500">
          Sign out
        </button>
      </>
    );
  }

  /* ── Desktop header ──
     Reserves its width while unknown, so the row does not shift when the
     answer arrives. */
  if (me === undefined) return <span className="hidden xl:block w-[168px]" aria-hidden="true" />;

  if (!me) return (
    <>
      <a href="/member/login"
        className="hidden xl:inline-block px-3 py-2 rounded-xl text-[13px] font-semibold text-[#063D2B] border border-[#063D2B]/15 hover:bg-[#063D2B]/5">
        LOGIN
      </a>
      <a href="/membership/apply"
        className="hidden xl:inline-block px-4 py-2 rounded-xl text-[13px] font-bold text-white"
        style={{ background: 'linear-gradient(180deg,#0B6B4F,#063D2B)', border: '1px solid rgba(200,154,43,.4)' }}>
        REGISTER
      </a>
    </>
  );

  return (
    <div ref={ref} className="hidden xl:block relative">
      <button onClick={() => setOpen(o => !o)}
        aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-[#063D2B]/15
          hover:bg-[#063D2B]/5 transition-colors">
        <Avatar src={me.photo_url} gender={me.gender} name={me.full_name || 'Member'}
          className="w-8 h-8 shrink-0" />
        <span className="text-[13px] font-bold max-w-[110px] truncate" style={{ color: G }}>
          {firstName}
        </span>
        <ChevronDown size={13} strokeWidth={2.5} aria-hidden="true"
          className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-gray-100 bg-white
            shadow-tnr-raise overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-bold truncate" style={{ color: G }}>{me.full_name}</div>
            <div className="text-[11px] text-gray-500 truncate">{me.membership_id}</div>
          </div>

          {[
            ['/member/dashboard', 'My Portal', LayoutDashboard],
            ['/member/profile', 'My Profile', User],
            ['/member/opinions', 'My Opinions', PenLine],
          ].map(([href, label, Icon]) => (
            <a key={href} href={href} role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-gray-700
                hover:bg-gray-50 transition-colors">
              <Icon size={14} strokeWidth={2.2} aria-hidden="true" className="text-gray-400" />
              {label}
            </a>
          ))}

          {/* Only for a member whose profile is actually public — offering
              "View public profile" to someone who has hidden theirs is a link
              to a page that will refuse them. */}
          {me.public_visible !== false && me.membership_id && (
            <a href={`/members/${me.membership_id}`} role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-gray-700
                hover:bg-gray-50 transition-colors border-t border-gray-50">
              <User size={14} strokeWidth={2.2} aria-hidden="true" className="text-gray-400" />
              View public profile
            </a>
          )}

          <button onClick={signOut} role="menuitem"
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-red-600
              hover:bg-red-50 transition-colors border-t border-gray-100">
            <LogOut size={14} strokeWidth={2.2} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
