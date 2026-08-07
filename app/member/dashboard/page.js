'use client';
import { useEffect, useState } from 'react';
import { roleLabel } from '@/lib/membership/roles';
import { profileCompletion } from '@/lib/membership/profile';
import { mGet } from '@/components/member/memberApi';
import MemberShell from '@/components/member/MemberShell';
import Avatar from '@/components/member/Avatar';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', soft: '#F3E4B3' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

const QUICK = [
  ['Complete Profile', '/member/profile', '👤'],
  ['Create CV', '/member/cv-builder', '📄'],
  ['Cover Letter', '/member/cover-letters', '✉️'],
  ['Membership Card', '/member/membership-card', '🪪'],
  ['Opportunities', '/member/opportunities', '💼'],
  ['Upload Document', '/member/certificates', '📎'],
];

export default function MemberDashboard() {
  // Completion needs the CV sections, not just the member row.
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    mGet('/api/member/profile').then(r => r?.ok && setProfile(r));
  }, []);

  return (
    <MemberShell active="/member/dashboard">
      {(m) => (
        <>
          <div className="rounded-3xl p-6 sm:p-8 text-white shadow-xl" style={{ background: `linear-gradient(165deg,${C.deep},#04241A)` }}>
            <div className="flex items-center gap-4 flex-wrap">
              <Avatar src={m?.photo_url} name={m?.full_name} fontSize={22}
                className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#D4A72C]/60 bg-white/10" />
              <div className="min-w-0">
                <h1 style={mont} className="text-2xl font-black">Welcome Back, {m?.first_name}</h1>
                <div className="text-sm text-white/60 mt-0.5">
                  <span className="font-mono" style={{ color: C.soft }}>{m?.membership_id}</span>
                  {m?.union_council && <> · {m.union_council}</>}
                  {m?.village && <> · {m.village}</>}
                </div>
              </div>
              {/* Membership type as well as status, so an Advisory Council or
                  Executive member can see their role at a glance rather than
                  wondering why the portal looks like everyone else's. */}
              <div className="ml-auto flex flex-wrap gap-2 justify-end">
                {m?.role && m.role !== 'general' && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                    {roleLabel(m.role).toUpperCase()}
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(212,167,44,0.18)', color: C.soft }}>
                  {String(m?.status || '').toUpperCase()} MEMBER
                </span>
              </div>
            </div>
          </div>

          {/* Stats — real values only; features arrive in later phases */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Profile Completion', profileCompletion(m, profile || {}).percent + '%'], ['CVs Created', '0'],
              ['Cover Letters', '0'], ['Certificates', '0']].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 text-center">
                <div style={{ ...mont, color: C.deep }} className="text-2xl font-black">{v}</div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 mt-1">{l}</div>
              </div>
            ))}
          </div>

          {/* A bare percentage is not actionable. Name the section worth the
              most and show what completing it is worth. */}
          {(() => {
            const c = profileCompletion(m, profile || {});
            if (!profile || !c.missing.length) return null;
            return (
              <a href="/member/profile"
                className="mt-6 flex items-center gap-4 rounded-2xl bg-white border border-gray-100 p-4
                  hover:border-[#0B6B4F]/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: C.deep }}>
                    Add your {c.missing[0].label.toLowerCase()} to reach {c.percent + c.missing[0].weight}%
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${c.percent}%`,
                               background: `linear-gradient(90deg,${C.green},${C.gold})` }} />
                  </div>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: C.green }}>Complete →</span>
              </a>
            );
          })()}

          <h2 style={{ ...mont, color: C.deep }} className="mt-8 text-sm font-black uppercase tracking-wide">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK.map(([t, href, icon]) => (
              <a key={t} href={href}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition p-4 text-center">
                <div className="text-2xl">{icon}</div>
                <div className="mt-2 text-xs font-bold" style={{ color: C.deep }}>{t}</div>
              </a>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-white border border-gray-100 shadow-sm p-6 text-center">
            <div className="text-3xl">📢</div>
            <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No announcements yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              TNR announcements, jobs, scholarships and events will appear here.
            </p>
          </div>
        </>
      )}
    </MemberShell>
  );
}

// Completion now lives in lib/membership/profile.js, weighted across the whole
// profile — see profileCompletion(). The old version here counted only the
// registration fields, which are all mandatory, so everyone scored 100%.
