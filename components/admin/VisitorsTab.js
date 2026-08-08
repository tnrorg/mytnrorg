'use client';
import { useEffect, useState } from 'react';
import { aGet } from './adminApi';
import { Card } from './ui';
import Avatar from '@/components/member/Avatar';

const fmtDuration = (s) => {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
};

const fmtWhen = (iso) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const Person = ({ p, size = 36 }) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <Avatar src={p?.photo_url} name={p?.full_name} gender={p?.gender} fontSize={12}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, borderRadius: '9999px' }} />
    <div className="min-w-0">
      <div className="truncate text-sm font-medium text-tnr-cream">{p?.full_name || 'Unknown member'}</div>
      <div className="font-mono text-[11px] text-tnr-goldLight">{p?.membership_id}</div>
    </div>
  </div>
);

export default function VisitorsTab({ toast }) {
  const [d, setD] = useState(null);
  const [days, setDays] = useState(30);
  const [profile, setProfile] = useState('');

  const load = () => {
    const q = new URLSearchParams({ days: String(days) });
    if (profile) q.set('profile', profile);
    aGet('/api/admin/visitors?' + q).then(r => {
      if (r.ok) setD(r);
      else toast?.(r.message || r.hint || 'Could not load visitor data.', 'err');
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days, profile]);

  if (!d) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-black text-tnr-cream">Profile Visitors</h3>
        <p className="mt-1 text-sm text-tnr-cream/60">
          Who opened a member&rsquo;s public profile, and how long they stayed.
        </p>
        <p className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
          style={{ background: 'rgba(200,154,43,.12)', color: '#E4C25B' }}>
          This records one member&rsquo;s browsing behaviour. Members should be told it exists —
          add a line to the privacy notice. Time spent in a background tab is not counted.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[7, 30, 90].map(n => (
            <button key={n} onClick={() => setDays(n)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${days === n
                ? 'border-tnr-gold bg-tnr-gold font-semibold text-tnr-black'
                : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>
              {n} days
            </button>
          ))}
          <input className="input ml-auto max-w-[220px]" placeholder="Filter by TNR-MN-0001"
            value={profile} onChange={e => setProfile(e.target.value.toUpperCase())} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="stat items-center text-center">
            <div className="text-2xl font-black text-tnr-cream">{d.totals.views}</div>
            <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">Total views</div>
          </div>
          <div className="stat items-center text-center">
            <div className="text-2xl font-black text-tnr-gold">{d.totals.identified}</div>
            <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">By members</div>
          </div>
          <div className="stat items-center text-center">
            <div className="text-2xl font-black text-tnr-cream">{fmtDuration(d.totals.seconds)}</div>
            <div className="text-[10px] uppercase tracking-wider text-tnr-cream/50">Total time</div>
          </div>
        </div>
      </Card>

      {/* Most-viewed profiles */}
      <Card>
        <h3 className="mb-3 font-black text-tnr-cream">Most viewed profiles</h3>
        {!d.summary.length && <div className="py-6 text-center text-sm text-tnr-cream/40">No views recorded yet.</div>}
        <ul className="divide-y divide-tnr-line/40">
          {d.summary.map(p => (
            <li key={p.membership_id} className="flex flex-wrap items-center gap-3 py-3">
              <Person p={p} />
              <div className="ml-auto flex items-center gap-5 text-right">
                <div>
                  <div className="text-sm font-bold text-tnr-cream">{p.views}</div>
                  <div className="text-[10px] uppercase tracking-wider text-tnr-cream/40">views</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-tnr-cream">{fmtDuration(p.avg)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-tnr-cream/40">avg stay</div>
                </div>
                <button onClick={() => setProfile(p.membership_id)}
                  className="text-xs text-tnr-goldLight hover:underline">Detail</button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Individual visits */}
      <Card>
        <h3 className="mb-3 font-black text-tnr-cream">
          Recent visits{profile && <span className="ml-2 font-mono text-xs text-tnr-goldLight">{profile}</span>}
        </h3>
        {!d.visits.length && <div className="py-6 text-center text-sm text-tnr-cream/40">Nothing in this period.</div>}
        <ul className="divide-y divide-tnr-line/40">
          {d.visits.map(v => (
            <li key={v.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-tnr-cream/40">Visitor</div>
                {v.viewer
                  ? <Person p={v.viewer} size={32} />
                  : <div className="text-sm text-tnr-cream/45">Not signed in</div>}
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-tnr-cream/40">Viewed</div>
                <Person p={v.profile} size={32} />
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-tnr-cream">{fmtDuration(v.seconds)}</div>
                <div className="text-[11px] text-tnr-cream/40">{fmtWhen(v.at)}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
