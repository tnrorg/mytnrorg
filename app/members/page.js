'use client';
import { useEffect, useState } from 'react';
import Avatar from '@/components/member/Avatar';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import CountryFlag from '@/components/stats/CountryFlag';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import MembersAnalytics from '@/components/members/MembersAnalytics';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const EMPTY = { search: '', union_council: '', village: '', profession: '', education: '', category: '', contribution: '' };

const FILTERS = [
  ['union_council', 'All Union Councils', 'union_councils'],
  ['village',       'All Villages / Areas', 'villages'],
  ['profession',    'All Professions',   'professions'],
  ['education',     'All Education',     'educations'],
  ['category',      'All Categories',    'categories'],
  ['contribution',  'All Contributions', 'contributions'],
];

function MemberCard({ m }) {
  // Where they are now: country only. The city sits on the full profile — a
  // directory card is a summary, and four lines of address crowds out the
  // things a visitor is actually scanning for.
  const home = [m.village, m.union_council].filter(Boolean).join(' · ');

  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-5 text-center transition-colors hover:border-[#0B6B4F]/30">
      <Avatar src={m.photo_url} name={m.full_name} gender={m.gender} fontSize={24}
        className="w-20 h-20 mx-auto rounded-full object-cover ring-2 ring-[#D4A72C]/60 bg-gray-50" />

      {/* The badge sits inline, straight after the surname, the way a verified
          mark reads on a profile — not as a separate chip on its own line.
          One gold badge across the whole platform: council, executive and
          general members are all committee-approved. */}
      <h3 style={{ ...mont, color: C.deep }}
        className="mt-3 font-extrabold text-sm leading-tight
          inline-flex items-center justify-center gap-1.5 flex-wrap">
        <span>{m.full_name}</span>
        <VerifiedBadge size={14} title="Verified member" />
      </h3>

      {m.profession && (
        <div className="mt-1.5 text-xs font-semibold" style={{ color: C.green }}>{m.profession}</div>
      )}
      {m.organization_name && (
        <div className="text-[11.5px] text-gray-500 mt-0.5">{m.organization_name}</div>
      )}
      {m.current_country && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-gray-500">
          <CountryFlag code={m.current_country_code} size={11} />
          {m.current_country}
        </div>
      )}
      {home && <div className="text-[11px] text-gray-400 mt-1">{home}</div>}

      {m.category && (
        <div className="mt-2 text-[10px] font-bold tracking-wide uppercase" style={{ color: C.gold }}>
          {m.category}
        </div>
      )}

      <a href={`/members/${m.membership_id}`}
        className="mt-4 block rounded-xl py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: C.green }}>View Profile</a>
    </div>
  );
}

export default function DirectoryPage() {
  const [d, setD] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/public/members?' + new URLSearchParams(f), { cache: 'no-store' })
        .then(r => r.json()).then(r => r.ok && setD(r)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const activeCount = Object.entries(f).filter(([k, v]) => k !== 'search' && v).length;
  const sel = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0B6B4F] bg-white';

  const selects = FILTERS.map(([key, label, listKey]) => (
    <select key={key} value={f[key]} onChange={set(key)} className={sel}>
      <option value="">{label}</option>
      {(d?.[listKey] || []).map(x => <option key={x} value={x}>{x}</option>)}
    </select>
  ));

  return (
    <main id="main" className="light-page min-h-screen flex flex-col bg-[#FDFDFD]" style={{ color: '#15231D', ...mont }}>
      <SiteNav />

      <section className="text-white py-14" style={{ background: `linear-gradient(165deg,${C.deep},#04241A)` }}>
        <div className="max-w-[1400px] mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black uppercase">Our Members</h1>
          <p className="mt-3 text-white/60 max-w-xl mx-auto text-sm">
            Membership of Tehreek-e-Nojawanan Roundu, village by village.
          </p>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-4 py-10 w-full">
        <MembersAnalytics />
      </section>

      <section className="max-w-[1400px] mx-auto px-4 pb-14 w-full">
        <h2 className="text-xl font-black uppercase tracking-wide" style={{ color: C.deep }}>Members Directory</h2>
        <p className="mt-1 text-sm text-gray-500">
          Members who have chosen to appear publicly.
          {d && <span className="ml-1 font-semibold" style={{ color: C.green }}>{d.total} shown</span>}
        </p>

        <div className="mt-5 flex gap-2">
          <input value={f.search} onChange={set('search')} placeholder="Search by member name"
            className={sel + ' flex-1'} />
          <button onClick={() => setDrawer(true)}
            className="lg:hidden rounded-xl px-4 text-sm font-bold text-white relative shrink-0"
            style={{ background: C.green }}>
            Filters
            {activeCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] grid place-items-center font-black"
              style={{ background: C.gold, color: C.deep }}>{activeCount}</span>}
          </button>
        </div>

        <div className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-2 mt-2">{selects}</div>

        {activeCount > 0 && (
          <button onClick={() => setF(s => ({ ...EMPTY, search: s.search }))}
            className="mt-2 text-xs font-semibold underline" style={{ color: C.green }}>
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </button>
        )}

        {!d && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 rounded-2xl bg-gray-100" />)}
          </div>
        )}

        {d && d.members.length === 0 && (
          <div className="mt-6 rounded-2xl bg-white border border-gray-100 p-10 text-center">
            <div className="text-4xl">👥</div>
            <h3 style={{ color: C.deep }} className="mt-2 font-extrabold">
              {activeCount || f.search ? 'No members match these filters' : 'No public members yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeCount || f.search
                ? 'Try clearing a filter or searching a different name.'
                : 'Members appear here once they enable public visibility in their profile settings.'}
            </p>
          </div>
        )}

        {d && d.members.length > 0 && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {d.members.map(m => <MemberCard key={m.membership_id} m={m} />)}
          </div>
        )}
      </section>

      {/* Mobile filter drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full rounded-t-3xl bg-white p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-10 h-1 rounded-full bg-gray-200" />
            <h3 className="mt-4 font-black" style={{ color: C.deep }}>Filter Members</h3>
            <div className="mt-4 space-y-2">{selects}</div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setF(s => ({ ...EMPTY, search: s.search }))}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-600">Clear all</button>
              <button onClick={() => setDrawer(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: C.green }}>
                Show {d?.total ?? 0} members
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
