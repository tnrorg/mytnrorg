'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from '../adminApi';

const LIGHT = { deep: '#063D2B', green: '#0B6B4F' };
const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0B6B4F]';

/* Choosing who comes.
 *
 * TWO WAYS IN, BOTH VISIBLE AT ONCE:
 *   group targets — "the Advisory Council", "everyone in UC Thowar"
 *   named people  — search by name or membership ID
 *
 * Each group shows how many ACTIVE members are actually behind it, because
 * "Advisory Council" means nothing until you know it is 12 people. And the
 * running total is de-duplicated on the server: "All members" plus "Advisory
 * Council" is 293 people, not 305. An admin about to notify the whole
 * organisation should see the real number before they press save, not
 * discover it from the replies.
 */
export default function AudiencePicker({ audience, setAudience, memberIds, setMemberIds, toast }) {
  const [meta, setMeta] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState([]);      // full member objects, for the chips
  const [reach, setReach] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { aGet('/api/admin/meetings/audience').then(r => r?.ok && setMeta(r)); }, []);

  // Debounced search — a request per keystroke would fire ten times for
  // "Shabbir" and the answers would race each other back.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      aGet(`/api/admin/meetings/audience?q=${encodeURIComponent(term)}`)
        .then(r => setFound(r?.ok ? r.members : []))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // The real, de-duplicated headcount. Recomputed whenever the selection
  // changes, on the server, because only the server knows who overlaps.
  useEffect(() => {
    if (!audience.length && !memberIds.length) { setReach(0); return; }
    let live = true;
    aPost('/api/admin/meetings/audience', { audience, member_ids: memberIds })
      .then(r => { if (live) setReach(r?.ok ? r.count : null); });
    return () => { live = false; };
  }, [audience, memberIds]);

  const hasGroup = (kind, value) =>
    audience.some(a => a.kind === kind && (value === undefined || a.value === value));

  const toggleGroup = (kind, value) => setAudience(
    hasGroup(kind, value)
      ? audience.filter(a => !(a.kind === kind && a.value === value))
      : [...audience, value === undefined ? { kind } : { kind, value }]
  );

  const addMember = (m) => {
    if (memberIds.includes(m.id)) return;
    setMemberIds([...memberIds, m.id]);
    setPicked([...picked, m]);
    setQ(''); setFound([]);
  };
  const removeMember = (id) => {
    setMemberIds(memberIds.filter(x => x !== id));
    setPicked(picked.filter(p => p.id !== id));
  };

  const counts = meta?.counts || {};

  return (
    <div className="space-y-4">
      {/* ── Groups ── */}
      <div>
        <span className="mb-2 block text-xs font-semibold text-gray-500">Invite groups</span>
        <div className="flex flex-wrap gap-2">
          {[
            ['all', 'All active members'],
            ['advisory', 'Advisory Council'],
            ['cec', 'Central Executive Committee'],
            ['uc_team', 'Union Council Teams'],
            ['general', 'General members'],
          ].map(([kind, label]) => {
            const on = hasGroup(kind, undefined);
            const n = counts[kind] ?? 0;
            return (
              <button key={kind} type="button" onClick={() => toggleGroup(kind, undefined)}
                disabled={!n}
                className={`rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition
                  disabled:cursor-not-allowed disabled:opacity-40 ${on
                    ? 'border-transparent text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                style={on ? { background: LIGHT.green } : undefined}>
                {label}
                <span className={`ml-1.5 text-[11px] ${on ? 'text-white/70' : 'text-gray-400'}`}>{n}</span>
              </button>
            );
          })}
        </div>
        {/* A group with nobody in it is shown disabled rather than hidden, so
            it is obvious the option exists and why it cannot be used. */}
      </div>

      {/* ── Union Councils ── */}
      {!!meta?.unionCouncils?.length && (
        <div>
          <span className="mb-2 block text-xs font-semibold text-gray-500">Or a specific Union Council</span>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-gray-100 p-2">
            {meta.unionCouncils.map(uc => {
              const on = hasGroup('uc', uc.name);
              return (
                <button key={uc.name} type="button" onClick={() => toggleGroup('uc', uc.name)}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition ${on
                    ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  style={on ? { background: LIGHT.green } : undefined}>
                  {uc.name} <span className={on ? 'text-white/70' : 'text-gray-400'}>{uc.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Named people ── */}
      <div>
        <span className="mb-2 block text-xs font-semibold text-gray-500">Or invite specific members</span>
        <input value={q} onChange={e => setQ(e.target.value)} className={input}
          placeholder="Search by name or membership ID…" />

        {searching && <p className="mt-1.5 text-[12px] text-gray-400">Searching…</p>}

        {!!found.length && (
          <ul className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {found.map(m => (
              <li key={m.id}>
                <button type="button" onClick={() => addMember(m)}
                  disabled={memberIds.includes(m.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-40">
                  <Photo m={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-gray-800">{m.full_name}</span>
                    <span className="block font-mono text-[11px] text-gray-400">
                      {m.membership_id} · {ROLE_LABEL[m.role] || 'Member'}
                      {m.union_council ? ` · ${m.union_council}` : ''}
                    </span>
                  </span>
                  {memberIds.includes(m.id)
                    ? <span className="text-[11px] text-gray-400">Added</span>
                    : <span className="text-[11px] font-bold" style={{ color: LIGHT.green }}>Add</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!!picked.length && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {picked.map(m => (
              <span key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 py-1 pl-1 pr-2 text-[12px]">
                <Photo m={m} small />
                <span className="font-medium text-gray-700">{m.full_name}</span>
                <button type="button" onClick={() => removeMember(m.id)}
                  aria-label={`Remove ${m.full_name}`}
                  className="text-gray-400 hover:text-red-600">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── The number that matters ── */}
      <div className="rounded-xl px-3 py-2.5 text-[13px]"
        style={{ background: 'rgba(11,107,79,.07)', color: LIGHT.deep }}>
        {reach === null ? 'Counting…' : reach === 0 ? (
          <span className="text-gray-500">Nobody selected yet.</span>
        ) : (
          <>
            <strong>{reach} member{reach === 1 ? '' : 's'}</strong> will be invited and notified.
            {reach > 50 && <span className="ml-1 text-gray-600">
              That is a large announcement — check the selection before saving.
            </span>}
          </>
        )}
      </div>
    </div>
  );
}

const ROLE_LABEL = {
  advisory: 'Advisory Council', cec: 'CEC', uc_team: 'UC Team', general: 'General Member',
};

/* A plain <img>, not next/image.
 *
 * These are search results inside a dialog: a handful of thumbnails that
 * change on every keystroke and are never the LCP. Routing them through the
 * optimiser would add a transform request per member for no benefit.
 */
function Photo({ m, small }) {
  const cls = small ? 'h-5 w-5' : 'h-8 w-8';
  if (m.photo_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.photo_url} alt="" className={`${cls} shrink-0 rounded-full object-cover`} />
  );
  return (
    <span className={`${cls} grid shrink-0 place-items-center rounded-full text-[10px] font-bold text-white`}
      style={{ background: LIGHT.green }}>
      {String(m.full_name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}
