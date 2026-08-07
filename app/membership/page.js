'use client';
import { useEffect, useState } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', soft: '#F3E4B3', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

const BENEFITS = [
  ['Career & Jobs', 'Access job openings, internships and mentorship from the TNR network.'],
  ['Scholarships', 'Find scholarships and admission guidance for students of Roundu.'],
  ['Digital Identity', 'Receive a verified digital membership card and certificate.'],
  ['CV & Cover Letters', 'Build professional CVs and cover letters with TNR tools.'],
  ['Community', 'Connect with members and professionals across the world.'],
  ['Welfare & Volunteering', 'Take part in welfare projects and volunteer programmes.'],
];
const STEPS = [
  ['Apply Online', 'Complete the membership application form.'],
  ['Committee Review', 'The membership committee reviews your application.'],
  ['Approval', 'Approved applicants receive a unique Membership ID.'],
  ['Portal Access', 'Set your password and access the Member Portal.'],
];

export default function MembershipPage() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    fetch('/api/public/membership/stats?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json()).then(r => r.ok && setCount(r.active_members)).catch(() => {});
  }, []);

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: C.ink, ...mont }}>
      <SiteNav />

      <section className="relative overflow-hidden" style={{ background: `linear-gradient(165deg,${C.deep},#04241A)` }}>
        <div className="max-w-[1400px] mx-auto px-4 py-16 text-center text-white">
          <h1 style={mont} className="text-3xl sm:text-5xl font-black uppercase">TNR Membership</h1>
          <p className="mt-4 text-white/70 max-w-2xl mx-auto leading-relaxed">
            Become part of a growing global community working for the education, welfare
            and future of Roundu. Membership is open to everyone who shares our values.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <a href="/membership/apply" className="px-6 py-3.5 rounded-xl font-bold text-[#063D2B] shadow-lg"
              style={{ background: `linear-gradient(180deg,${C.soft},${C.gold})` }}>Apply Now →</a>
            <a href="/member/login" className="px-6 py-3.5 rounded-xl font-bold text-white border border-white/25 hover:bg-white/10">Member Login</a>
            <a href="/membership/verify" className="px-6 py-3.5 rounded-xl font-bold text-white border border-white/25 hover:bg-white/10">Verify Membership</a>
          </div>
          {count !== null && (
            <div className="mt-10 inline-block rounded-2xl px-8 py-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,167,44,0.3)' }}>
              <div style={{ ...mont, color: C.soft }} className="text-3xl font-black">{count.toLocaleString()}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/50 mt-1">Approved Members</div>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-4 py-14 w-full">
        <h2 style={{ ...mont, color: C.deep }} className="text-xl font-black uppercase text-center">Membership Benefits</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
              <h3 style={{ ...mont, color: C.deep }} className="font-extrabold text-sm">{t}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-4 pb-16 w-full">
        <h2 style={{ ...mont, color: C.deep }} className="text-xl font-black uppercase text-center">How It Works</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="rounded-2xl p-5 text-white shadow-lg" style={{ background: `linear-gradient(165deg,${C.deep},#04241A)` }}>
              <div className="w-9 h-9 rounded-full grid place-items-center font-black text-[#063D2B]"
                style={{ background: `linear-gradient(180deg,${C.soft},${C.gold})`, ...mont }}>{i + 1}</div>
              <h3 style={{ ...mont, color: C.soft }} className="mt-3 font-bold text-sm">{t}</h3>
              <p className="mt-1 text-sm text-white/60 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <a href="/membership/apply" className="inline-block px-8 py-4 rounded-xl font-bold text-white shadow-lg"
            style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Start Your Application →</a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
