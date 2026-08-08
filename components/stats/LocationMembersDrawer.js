'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, MapPin, Briefcase, ArrowRight } from 'lucide-react';
import CountryFlag from '@/components/stats/CountryFlag';
import Avatar from '@/components/ui/Avatar';
import { COLORS, FONT } from '@/lib/design/tokens';

/* Members in one place, opened from any statistics section.
 *
 * ONE component for villages, union councils, provinces, cities and countries,
 * so the three sections behave identically — a visitor learns the interaction
 * once. Adding a fourth section later means passing a different `scope`, not
 * writing another drawer.
 *
 * Nothing is fetched until it is opened, and then only one page at a time.
 */
const PAGE = 24;

export default function LocationMembersDrawer({
  open, scope, value, parent, title, subtitle, flagCode, onClose }) {
  const [state, setState] = useState({ members: [], total: 0, hidden: 0, hasMore: false });
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (offset) => {
    const q = new URLSearchParams({ scope, value, limit: String(PAGE), offset: String(offset) });
    if (parent) q.set('parent', parent);
    const r = await fetch(`/api/public/members-by-location?${q}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!j?.ok) throw new Error(j?.message || 'Members are unavailable right now.');
    return j;
  }, [scope, value, parent]);

  useEffect(() => {
    if (!open) return;
    let off = false;
    setLoading(true); setErr('');
    setState({ members: [], total: 0, hidden: 0, hasMore: false });
    load(0)
      .then(j => { if (!off) setState({ members: j.members, total: j.total, hidden: j.hidden, hasMore: j.hasMore }); })
      .catch(e => { if (!off) setErr(e.message); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [open, load]);

  // Escape closes; the page behind is locked so it cannot scroll away.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  async function loadMore() {
    setMore(true);
    try {
      const j = await load(state.members.length);
      setState(s => ({ ...s, members: [...s.members, ...j.members], hasMore: j.hasMore }));
    } catch (e) { setErr(e.message); }
    setMore(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" style={{ ...FONT }}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: 'rgba(6,45,33,.55)' }} onClick={onClose} />

      {/* Side drawer on desktop, full sheet on mobile. */}
      <div className="relative w-full sm:max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b px-5 py-4 flex items-start gap-3"
          style={{ borderColor: COLORS.neutral }}>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold truncate flex items-center gap-2"
              style={{ color: COLORS.green900 }}>
              <CountryFlag code={flagCode} size={18} />
              <span className="truncate">{title}</span>
            </h2>
            <p className="text-[12.5px]" style={{ color: COLORS.muted }}>
              {loading ? 'Loading…' : `${state.total} approved member${state.total === 1 ? '' : 's'}`}
              {subtitle ? ` · ${subtitle}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="shrink-0 grid place-items-center h-9 w-9 rounded-full border"
            style={{ borderColor: COLORS.neutral }}>
            <X size={17} strokeWidth={2.5} color={COLORS.charcoal} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {err && (
            <div className="rounded-tnr px-4 py-3 text-[13px]"
              style={{ background: 'rgba(170,60,60,.08)', color: '#8A2F2F' }}>{err}</div>
          )}

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-tnr animate-pulse" style={{ background: COLORS.neutral }} />
              ))}
            </div>
          )}

          {!loading && !err && state.members.length === 0 && (
            <p className="text-[13.5px] leading-relaxed" style={{ color: COLORS.muted }}>
              {state.total === 0
                ? 'No approved members are recorded here yet.'
                : `${state.total} approved member${state.total === 1 ? ' is' : 's are'} recorded here, but ${state.total === 1 ? 'their profile is' : 'their profiles are'} not public.`}
            </p>
          )}

          {!loading && state.members.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-3">
              {state.members.map(m => <MemberCard key={m.membership_id} m={m} />)}
            </ul>
          )}

          {state.hasMore && (
            <button onClick={loadMore} disabled={more}
              className="mt-4 w-full py-3 rounded-tnr font-bold text-sm border transition-colors
                hover:bg-tnr-neutral disabled:opacity-50"
              style={{ borderColor: 'rgba(10,61,44,.16)', color: COLORS.green900 }}>
              {more ? 'Loading…' : 'Load more'}
            </button>
          )}

          {/* Stated plainly. Members with a private profile are counted in the
              total above but have no card — without this note the two numbers
              look like a bug. */}
          {!loading && state.hidden > 0 && state.members.length > 0 && (
            <p className="mt-4 text-[11.5px] leading-relaxed" style={{ color: COLORS.muted }}>
              {state.hidden} further approved member{state.hidden === 1 ? '' : 's'} here
              {state.hidden === 1 ? ' has' : ' have'} chosen to keep their profile private.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* Public-safe fields only. There is no contact detail on this card because the
   endpoint never sends one. */
function MemberCard({ m }) {
  const place = [m.current_city, m.current_state_province].filter(Boolean).join(', ');
  const home = [m.village, m.union_council].filter(Boolean).join(', ');
  return (
    <li className="rounded-tnr border p-4 flex gap-3.5" style={{ borderColor: COLORS.neutral }}>
      <div className="w-14 h-16 rounded-tnr overflow-hidden bg-tnr-neutral shrink-0 grid place-items-center">
        {m.photo_url
          ? <img src={m.photo_url} alt="" className="w-full h-full object-cover object-top" />
          : <Avatar gender={m.gender} name={m.full_name}
              className="w-full h-full" rounded="rounded-none" />}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-[14px] leading-snug truncate" style={{ color: COLORS.green900 }}>
          {m.full_name}
        </h3>
        {m.profession && (
          <div className="text-[12.5px] font-semibold truncate" style={{ color: COLORS.green700 }}>
            {m.profession}
          </div>
        )}

        <div className="mt-1.5 space-y-0.5 text-[11.5px]" style={{ color: COLORS.muted }}>
          {m.current_position && (
            <div className="flex items-start gap-1.5">
              <Briefcase size={11} strokeWidth={2.2} aria-hidden="true" className="mt-[3px] shrink-0" />
              <span className="truncate">
                {m.current_position}{m.organization_name ? ` · ${m.organization_name}` : ''}
              </span>
            </div>
          )}
          {place && (
            <div className="flex items-start gap-1.5">
              <MapPin size={11} strokeWidth={2.2} aria-hidden="true" className="mt-[3px] shrink-0" />
              <span className="truncate">{place}</span>
            </div>
          )}
          {home && <div className="truncate">From {home}</div>}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-mono tabular-nums" style={{ color: COLORS.muted }}>
            {m.membership_id}
          </span>
          <a href={`/members/${m.membership_id}`}
            className="group inline-flex items-center gap-1 text-[11.5px] font-bold"
            style={{ color: COLORS.green700 }}>
            View Profile
            <ArrowRight size={11} strokeWidth={2.5} aria-hidden="true"
              className="transition-transform duration-micro group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </li>
  );
}
