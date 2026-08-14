'use client';
import { useEffect, useState } from 'react';
import { mGet, mPost, clearToken, getToken } from './memberApi';
import { canReviewCecApplications } from '@/lib/membership/roles';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', soft: '#F3E4B3', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

// Fallback avatar: member initials, never the organisation logo.
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Base navigation — everyone signs into the same portal, because that is where
// authentication, the membership card and the CV tools live. A role does not
// create a separate portal; it ADDS the items below.
export const NAV = [
  ['Dashboard', '/member/dashboard', '🏠'],
  ['My Profile', '/member/profile', '👤'],
  ['CV Builder', '/member/cv-builder', '📄'],
  ['Cover Letters', '/member/cover-letters', '✉️'],
  ['Membership Card', '/member/membership-card', '🪪'],
  ['Documents & Certificates', '/member/certificates', '🎓'],
  ['Jobs & Scholarships', '/member/opportunities', '💼'],
  ['Events & Programs', '/member/events', '📅'],
  ['Volunteer Activities', '/member/volunteer', '🤝'],
  // Open to every member — the point of the section is that anyone can write.
  ['Opinions', '/member/opinions', '✍️'],
  ['Applications History', '/member/applications', '📋'],
  ['Notifications', '/member/notifications', '🔔'],
  ['Help & Support', '/member/support', '💬'],
  ['Account Settings', '/member/settings', '⚙️'],
];

// Extra items by role. Advisory Council and Executive Committee members get a
// public professional profile to maintain and an inbox of guidance requests;
// a general member has neither, so showing those links to everyone would be
// misleading.
export const ROLE_NAV = {
  advisory: [
    ['My Council Profile', '/member/council-profile', '🎓'],
    ['Guidance Requests', '/member/guidance', '💡'],
  ],
  cec: [
    ['My Leadership Profile', '/member/council-profile', '🎓'],
    // Read-only. The decision sits with the Super Admin; committee members
    // read the answers so they can advise, not act.
    ['Executive Applications', '/member/cec-applications', '📋'],
  ],
  uc_team: [
    ['My UC Team', '/member/uc-team', '📍'],
  ],
};

/* Takes the whole member, not just the role.
 *
 * Access to Executive Applications is no longer decided by role alone — the
 * founder reviews them without holding the `cec` role — and the check needs
 * the membership ID to say so. Passing the role by itself meant the API would
 * let him in while the portal showed him no way to get there.
 *
 * This only draws the link. The endpoint enforces the same rule server-side,
 * so hiding or showing a nav item grants nothing either way. */
export const navFor = (member) => {
  const role = typeof member === 'string' ? member : member?.role;
  const extra = [...(ROLE_NAV[role] || [])];

  const CEC_APPS = ['Executive Applications', '/member/cec-applications', '📋'];
  if (typeof member === 'object' && canReviewCecApplications(member)
      && !extra.some(([, href]) => href === CEC_APPS[1])) {
    extra.push(CEC_APPS);
  }

  if (!extra.length) return NAV;
  // Slot the role items straight after My Profile, where they belong.
  const i = NAV.findIndex(([, href]) => href === '/member/profile') + 1;
  return [...NAV.slice(0, i), ...extra, ...NAV.slice(i)];
};

// Protected shell for every /member/* page.
export default function MemberShell({ active, children }) {
  const [member, setMember] = useState(null);
  const [state, setState] = useState('loading');
  const [open, setOpen] = useState(false);

  const refresh = () => mGet('/api/member/me?t=' + Date.now()).then(r => {
    if (r?.ok) { setMember(r.member); setState('ok'); }
    else setState('denied');
  });

  useEffect(() => {
    if (!getToken()) { window.location.href = '/member/login'; return; }
    refresh();
    // Any page can fire this after changing profile data (e.g. a new photo)
    // so the sidebar updates immediately without a page reload.
    const onUpdate = () => refresh();
    window.addEventListener('tnr-member-updated', onUpdate);
    return () => window.removeEventListener('tnr-member-updated', onUpdate);
    // eslint-disable-next-line
  }, []);

  if (state === 'loading') return <div className="light-page min-h-screen grid place-items-center text-gray-400" style={mont}>Loading…</div>;
  if (state === 'denied') return null;   // memberApi already redirected

  const signOut = () => { clearToken(); window.location.href = '/member/login'; };

  return (
    // `member-portal` is what globals.css hooks the light form styling onto.
    // Without it every page had to remember to set bg-white and a text colour
    // on each field, and several did not — see the rule in globals.css.
    <div className="member-portal min-h-screen flex flex-col lg:flex-row bg-[#F7F9F8]"
      style={{ color: C.ink, ...mont }}>
      {/* Sidebar */}
      <aside className="lg:w-64 lg:min-h-screen bg-white border-b lg:border-b-0 lg:border-r border-gray-100">
        <div className="p-4 flex items-center gap-3 border-b border-gray-100">
          <a href="/member/profile" title="My Profile"
            className="w-11 h-11 rounded-full grid place-items-center overflow-hidden shrink-0 ring-2 ring-[#D4A72C] bg-[#0B6B4F]">
            {member?.photo_url
              ? <img src={member.photo_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-white font-black text-sm">{initials(member?.full_name)}</span>}
          </a>
          <div className="min-w-0">
            <div style={{ ...mont, color: C.deep }} className="font-extrabold text-sm truncate">{member?.full_name}</div>
            <div className="text-[10px] font-mono" style={{ color: C.green }}>{member?.membership_id}</div>
          </div>
          <button className="lg:hidden ml-auto p-2 text-gray-500" onClick={() => setOpen(!open)} aria-label="menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <nav className={`${open ? 'block' : 'hidden'} lg:block p-2 space-y-0.5`}>
          {navFor(member).map(([label, href, icon]) => (
            <a key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${active === href
                ? 'text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
              style={active === href ? { background: `linear-gradient(180deg,${C.green},${C.deep})` } : {}}>
              <span className="text-base">{icon}</span>{label}
            </a>
          ))}
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 mt-2">
            <span>↩</span>Sign Out
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-4 sm:p-8 max-w-6xl">{typeof children === 'function' ? children(member) : children}</main>
    </div>
  );
}
