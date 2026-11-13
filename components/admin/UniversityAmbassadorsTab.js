'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aGet, aPost } from './adminApi';

/* ── University Ambassadors (admin) ──────────────────────────────────────────
 *
 * Who may see which university's members, and the data that decides it.
 *
 *   Assignments   assign / remove ambassadors; contact visibility per assignment
 *   Universities  per-university numbers; add a university, a spelling, a campus
 *   Unmatched     members whose university could not be matched — map by hand
 *   Requests      corrections and support requests raised by ambassadors
 *   Activity      what ambassadors have done, newest first
 *
 * Every admin call returns { ok, message } and never throws, so every call
 * here checks `ok` before claiming success.
 */

const inp = 'rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-sm text-tnr-cream outline-none focus:border-tnr-gold w-full';
const sel = 'rounded-lg border border-tnr-line bg-black/30 px-2.5 py-2 text-sm text-tnr-cream w-full';
const th = 'px-3 py-2.5 text-left text-[11px] uppercase tracking-wider text-tnr-cream/50';
const td = 'px-3 py-2.5 align-top';

const SECTIONS = [
  ['assign', 'Assignments'], ['unis', 'Universities'], ['unmatched', 'Unmatched members'],
  ['requests', 'Requests'], ['activity', 'Activity'],
];

const ACTION_LABEL = {
  MEMBER_VIEWED: 'viewed a member', CONTACT_VIEWED: 'viewed contact details',
  FOLLOWUP_SET: 'set follow-up', NOTE_ADDED: 'added a note',
  ANNOUNCEMENT_SENT: 'sent an announcement', REQUEST_RAISED: 'raised a request',
};

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function UniversitySelect({ universities, value, onChange, placeholder = 'Choose a university…' }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? universities.filter(u => u.name.toLowerCase().includes(s) || u.id.includes(s)) : universities;
  }, [q, universities]);
  return (
    <div className="space-y-1.5">
      <input className={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="Filter universities…" />
      <select className={sel} value={value || ''} onChange={e => onChange(e.target.value || null)} size={1}>
        <option value="">{placeholder}</option>
        {list.slice(0, 300).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </div>
  );
}

function CampusSelect({ campuses, universityId, value, onChange }) {
  const mine = campuses.filter(c => c.university_id === universityId);
  if (!universityId) return null;
  return (
    <select className={sel} value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">Whole university</option>
      {mine.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export default function UniversityAmbassadorsTab({ toast }) {
  const [section, setSection] = useState('assign');
  const [ov, setOv] = useState(null);
  const [cat, setCat] = useState({ universities: [], campuses: [] });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const say = (r, okMsg) => {
    if (r?.ok) { if (okMsg) toast?.(okMsg); return true; }
    toast?.(r?.message || 'That did not work.', 'error');
    return false;
  };

  const loadOverview = useCallback(async () => {
    const r = await aGet('/api/admin/university-ambassadors');
    if (r?.ok) { setOv(r); setErr(''); }
    else setErr([r?.message || 'Could not load.', r?.hint].filter(Boolean).join(' '));
  }, []);
  const loadCatalogue = useCallback(async () => {
    const r = await aGet('/api/admin/university-ambassadors?view=universities');
    if (r?.ok) setCat({ universities: r.universities, campuses: r.campuses });
  }, []);
  useEffect(() => { loadOverview(); loadCatalogue(); }, [loadOverview, loadCatalogue]);

  const post = async (body, okMsg) => {
    setBusy(true);
    const r = await aPost('/api/admin/university-ambassadors', body);
    setBusy(false);
    // A message function only runs on success, when the fields it reads exist.
    const good = say(r, r?.ok && typeof okMsg === 'function' ? okMsg(r) : okMsg);
    if (good) { loadOverview(); }
    return good ? r : null;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">University Ambassadors</h2>
        <p className="mt-1 max-w-3xl text-sm text-tnr-cream/50">
          An ambassador sees only the approved members of the university (or campus) they are
          assigned to. Members are matched to a university automatically from what they typed;
          anyone who cannot be matched safely waits in Unmatched for you.
        </p>
      </div>

      {err && <div className="card p-4 text-sm text-amber-200">{err}</div>}

      {ov && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Active assignments', ov.assignments.length],
            ['Universities with members', ov.stats.filter(s => s.members).length],
            ['Unmatched members', ov.unmatched],
            ['Open requests', ov.open_requests],
          ].map(([k, v]) => (
            <div key={k} className="card p-4">
              <p className="text-[11px] uppercase tracking-wider text-tnr-cream/50">{k}</p>
              <p className="mt-1 text-2xl font-bold text-tnr-goldLight">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSection(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              section === k ? 'bg-tnr-gold text-tnr-black' : 'border border-tnr-line text-tnr-cream/70 hover:bg-white/5'}`}>
            {label}
          </button>
        ))}
      </div>

      {section === 'assign' && <Assignments ov={ov} cat={cat} post={post} busy={busy} />}
      {section === 'unis' && <Universities ov={ov} cat={cat} post={post} busy={busy} reload={loadCatalogue} />}
      {section === 'unmatched' && <Unmatched cat={cat} post={post} busy={busy} />}
      {section === 'requests' && <Requests post={post} busy={busy} />}
      {section === 'activity' && <Activity cat={cat} />}
    </div>
  );
}

// ── Assignments ─────────────────────────────────────────────────────────────

function Assignments({ ov, cat, post, busy }) {
  const [amb, setAmb] = useState('');
  const [uni, setUni] = useState(null);
  const [camp, setCamp] = useState(null);
  const [contact, setContact] = useState(false);

  const chosen = ov?.ambassadors.find(a => a.id === amb);
  // Default the university to the one the ambassador themselves belongs to.
  useEffect(() => { if (chosen?.suggested_university) setUni(chosen.suggested_university); }, [chosen]);
  useEffect(() => { setCamp(null); }, [uni]);

  async function assign() {
    if (contact && !window.confirm(
      'This ambassador will be able to see the email address and mobile number of every member in scope. Continue?')) return;
    const r = await post({ op: 'assign', ambassador_id: amb, university_id: uni, campus_id: camp, can_view_contact: contact },
      'Ambassador assigned.');
    if (r) { setAmb(''); setUni(null); setCamp(null); setContact(false); }
  }

  if (!ov) return <div className="card p-6 text-sm text-tnr-cream/50">Loading…</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card space-y-3 p-4">
        <p className="font-semibold text-tnr-cream">Assign an ambassador</p>
        {!ov.ambassadors.length ? (
          <p className="text-sm text-tnr-cream/50">
            No member holds the University Ambassador role yet. Give someone the role in Leadership first.
          </p>
        ) : (
          <>
            <label className="block text-xs text-tnr-cream/60">Ambassador
              <select className={`${sel} mt-1`} value={amb} onChange={e => setAmb(e.target.value)}>
                <option value="">Choose…</option>
                {ov.ambassadors.map(a => (
                  <option key={a.id} value={a.id}>{a.full_name} · {a.membership_id}</option>
                ))}
              </select>
            </label>
            {chosen && (
              <p className="text-xs text-tnr-cream/50">
                Their own university: {chosen.suggested_name || chosen.organization_name || 'not given'}
              </p>
            )}
            <div className="text-xs text-tnr-cream/60">University
              <div className="mt-1"><UniversitySelect universities={cat.universities} value={uni} onChange={setUni} /></div>
            </div>
            {uni && <div className="text-xs text-tnr-cream/60">Campus
              <div className="mt-1"><CampusSelect campuses={cat.campuses} universityId={uni} value={camp} onChange={setCamp} /></div>
            </div>}
            <label className="flex items-start gap-2 text-sm text-tnr-cream/80">
              <input type="checkbox" className="mt-1" checked={contact} onChange={e => setContact(e.target.checked)} />
              <span>Allow this ambassador to see members&apos; email and mobile
                <span className="block text-xs text-tnr-cream/40">Off by default. Each view is logged.</span></span>
            </label>
            <button type="button" className="btn-green w-full text-sm" disabled={busy || !amb || !uni} onClick={assign}>
              Assign
            </button>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-tnr-line lg:col-span-2">
        <table className="w-full text-sm">
          <thead className="border-b border-tnr-line"><tr>
            <th className={th}>Ambassador</th><th className={th}>University</th>
            <th className={th}>Contact</th><th className={th}>Assigned</th><th className={th} />
          </tr></thead>
          <tbody>
            {ov.assignments.map(a => (
              <tr key={a.id} className="border-t border-tnr-line/40 hover:bg-white/5">
                <td className={td}>
                  <p className="font-medium text-tnr-cream">{a.ambassador?.full_name || '—'}</p>
                  <p className="font-mono text-[11px] text-tnr-cream/40">{a.ambassador?.membership_id}</p>
                </td>
                <td className={`${td} text-tnr-cream/80`}>
                  {a.university}
                  {a.campus && <span className="block text-[11px] text-tnr-cream/50">Campus: {a.campus}</span>}
                </td>
                <td className={td}>
                  <button type="button" disabled={busy}
                    onClick={() => {
                      if (!a.can_view_contact && !window.confirm('Allow this ambassador to see members’ email and mobile?')) return;
                      post({ op: 'set_contact', assignment_id: a.id, can_view_contact: !a.can_view_contact },
                        a.can_view_contact ? 'Contact details hidden.' : 'Contact details allowed.');
                    }}
                    className={`chip ${a.can_view_contact ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-tnr-cream/50'}`}>
                    {a.can_view_contact ? 'Allowed' : 'Hidden'}
                  </button>
                </td>
                <td className={`${td} text-xs text-tnr-cream/50`}>{fmt(a.assigned_at)}<br />by {a.assigned_by}</td>
                <td className={`${td} text-right`}>
                  <button type="button" disabled={busy} className="text-red-400 hover:underline"
                    onClick={() => window.confirm(`Remove ${a.ambassador?.full_name} from ${a.university}? They lose access immediately.`)
                      && post({ op: 'remove', assignment_id: a.id }, 'Assignment removed.')}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {!ov.assignments.length && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-tnr-cream/40">No ambassadors assigned yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Universities ────────────────────────────────────────────────────────────

function Universities({ ov, cat, post, busy, reload }) {
  const [newUni, setNewUni] = useState({ name: '', province: '' });
  const [aliasUni, setAliasUni] = useState(null);
  const [alias, setAlias] = useState('');
  const [campUni, setCampUni] = useState(null);
  const [campName, setCampName] = useState('');

  const after = (r) => { if (r) reload(); };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        <div className="card space-y-2 p-4">
          <p className="font-semibold text-tnr-cream">Add a university</p>
          <p className="text-xs text-tnr-cream/50">For an institution not on the list — including one abroad.</p>
          <input className={inp} placeholder="Full name" value={newUni.name} onChange={e => setNewUni(s => ({ ...s, name: e.target.value }))} />
          <input className={inp} placeholder="Province / country (optional)" value={newUni.province} onChange={e => setNewUni(s => ({ ...s, province: e.target.value }))} />
          <button type="button" className="btn-green w-full text-sm" disabled={busy || newUni.name.trim().length < 3}
            onClick={async () => {
              const r = await post({ op: 'add_university', ...newUni }, x => `Added. ${x.remapped} member(s) matched.`);
              if (r) { after(r); setNewUni({ name: '', province: '' }); }   // keep what was typed if it failed
            }}>
            Add university
          </button>
        </div>

        <div className="card space-y-2 p-4">
          <p className="font-semibold text-tnr-cream">Accept another spelling</p>
          <p className="text-xs text-tnr-cream/50">
            e.g. &quot;Comsats Abbottabad&quot; → COMSATS. A spelling can mean only one university.
          </p>
          <UniversitySelect universities={cat.universities} value={aliasUni} onChange={setAliasUni} />
          <input className={inp} placeholder="Spelling members use" value={alias} onChange={e => setAlias(e.target.value)} />
          <button type="button" className="btn-ghost w-full text-sm" disabled={busy || !aliasUni || alias.trim().length < 2}
            onClick={async () => { if (await post({ op: 'add_alias', university_id: aliasUni, alias }, r => `Saved. ${r.remapped} member(s) matched.`)) setAlias(''); }}>
            Add spelling
          </button>
        </div>

        <div className="card space-y-2 p-4">
          <p className="font-semibold text-tnr-cream">Add a campus</p>
          <UniversitySelect universities={cat.universities} value={campUni} onChange={setCampUni} />
          <input className={inp} placeholder="Campus name, e.g. Abbottabad" value={campName} onChange={e => setCampName(e.target.value)} />
          <button type="button" className="btn-ghost w-full text-sm" disabled={busy || !campUni || campName.trim().length < 2}
            onClick={async () => { const r = await post({ op: 'add_campus', university_id: campUni, name: campName }, 'Campus added.'); if (r) { setCampName(''); reload(); } }}>
            Add campus
          </button>
        </div>

        <button type="button" className="btn-ghost w-full text-sm" disabled={busy}
          onClick={() => post({ op: 'remap' }, r => `Matching re-run: ${r.changed} member(s) updated.`)}>
          Re-run automatic matching
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-tnr-line lg:col-span-2">
        <table className="w-full text-sm">
          <thead className="border-b border-tnr-line"><tr>
            <th className={th}>University</th><th className={th}>Members</th>
            <th className={th}>Students</th><th className={th}>Ambassadors</th>
          </tr></thead>
          <tbody>
            {(ov?.stats || []).map(s => (
              <tr key={s.id} className="border-t border-tnr-line/40">
                <td className={`${td} text-tnr-cream`}>{s.name}</td>
                <td className={`${td} text-tnr-cream/80`}>{s.members}</td>
                <td className={`${td} text-tnr-cream/80`}>{s.students}</td>
                <td className={td}>
                  <span className={s.ambassadors ? 'text-green-400' : (s.members ? 'text-amber-300' : 'text-tnr-cream/40')}>
                    {s.ambassadors || (s.members ? 'none yet' : '0')}
                  </span>
                </td>
              </tr>
            ))}
            {ov && !ov.stats.length && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-tnr-cream/40">No members matched to a university yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Unmatched / mapping ─────────────────────────────────────────────────────

function MapRow({ m, cat, post, busy, onDone }) {
  const [uni, setUni] = useState(m.university_id || null);
  const [camp, setCamp] = useState(m.university_campus_id || null);
  const current = cat.universities.find(u => u.id === m.university_id);
  return (
    <tr className="border-t border-tnr-line/40">
      <td className={td}>
        <p className="font-medium text-tnr-cream">{m.full_name}</p>
        <p className="font-mono text-[11px] text-tnr-cream/40">{m.membership_id}</p>
      </td>
      <td className={`${td} text-tnr-cream/80`}>
        &ldquo;{m.organization_name || '—'}&rdquo;
        <span className="block text-[11px] text-tnr-cream/40">{m.current_position || ''}</span>
        {current && <span className="block text-[11px] text-green-400">Now: {current.name}{m.university_source === 'admin' ? ' (set by admin)' : ''}</span>}
      </td>
      <td className={`${td} w-72`}>
        <UniversitySelect universities={cat.universities} value={uni} onChange={(v) => { setUni(v); setCamp(null); }}
          placeholder="Not at a university / clear" />
        {uni && <div className="mt-1.5"><CampusSelect campuses={cat.campuses} universityId={uni} value={camp} onChange={setCamp} /></div>}
      </td>
      <td className={`${td} text-right`}>
        <button type="button" className="btn-green !px-3 !py-1.5 text-xs" disabled={busy}
          onClick={async () => { if (await post({ op: 'map_member', member_id: m.id, university_id: uni, campus_id: camp },
            uni ? 'Mapped.' : 'Mapping cleared.')) onDone(); }}>
          Save
        </button>
      </td>
    </tr>
  );
}

function Unmatched({ cat, post, busy }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await aGet(`/api/admin/university-ambassadors?view=members${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
    if (r?.ok) { setList(r.members); setErr(''); } else setErr(r?.message || 'Could not load members.');
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className={`${inp} sm:max-w-sm`} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search any member to correct their university…" />
        <p className="text-xs text-tnr-cream/50">
          {q.trim() ? 'Showing search results across all members.' : 'Showing members whose university could not be matched.'}
        </p>
      </div>
      {err && <div className="card p-4 text-sm text-amber-200">{err}</div>}
      <div className="overflow-x-auto rounded-2xl border border-tnr-line">
        <table className="w-full text-sm">
          <thead className="border-b border-tnr-line"><tr>
            <th className={th}>Member</th><th className={th}>They wrote</th><th className={th}>University</th><th className={th} />
          </tr></thead>
          <tbody>
            {list?.map(m => <MapRow key={m.id} m={m} cat={cat} post={post} busy={busy} onDone={load} />)}
            {list && !list.length && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-tnr-cream/40">
                {q.trim() ? 'No members match.' : 'Nobody is waiting to be matched.'}
              </td></tr>
            )}
            {!list && !err && <tr><td colSpan={4} className="px-3 py-8 text-center text-tnr-cream/40">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-tnr-cream/40">
        A mapping you set here is kept even when automatic matching is re-run. If the member later changes
        the university on their own profile, their new answer takes over.
      </p>
    </div>
  );
}

// ── Requests ────────────────────────────────────────────────────────────────

function Requests({ post, busy }) {
  const [list, setList] = useState(null);
  const [reply, setReply] = useState({});

  const load = useCallback(async () => {
    const r = await aGet('/api/admin/university-ambassadors?view=requests');
    if (r?.ok) setList(r.requests);
  }, []);
  useEffect(() => { load(); }, [load]);

  const answer = async (r, status) => {
    if (await post({ op: 'answer_request', id: r.id, status, admin_reply: reply[r.id] || '' }, 'Request updated.')) load();
  };

  if (!list) return <div className="card p-6 text-sm text-tnr-cream/50">Loading…</div>;
  if (!list.length) return <div className="card p-6 text-sm text-tnr-cream/50">No requests from ambassadors.</div>;

  return (
    <div className="space-y-3">
      {list.map(r => (
        <div key={r.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-tnr-cream">{r.subject}</p>
              <p className="text-xs text-tnr-cream/50">
                {r.ambassador_name} · {r.university_id} · {fmt(r.created_at)}
                {r.member && <> · about <span className="font-mono">{r.member.membership_id}</span> {r.member.full_name}</>}
              </p>
            </div>
            <span className="chip bg-white/5 text-tnr-cream/70">{r.kind} · {r.status.replace('_', ' ')}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-tnr-cream/80">{r.message}</p>
          {r.admin_reply && <p className="mt-2 text-sm text-tnr-goldLight">Reply: {r.admin_reply}</p>}
          {['open', 'in_progress'].includes(r.status) && (
            <div className="mt-3 space-y-2">
              <textarea className={inp} rows={2} placeholder="Reply to the ambassador (optional)"
                value={reply[r.id] || ''} onChange={e => setReply(s => ({ ...s, [r.id]: e.target.value }))} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-green !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => answer(r, 'resolved')}>Resolved</button>
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => answer(r, 'in_progress')}>In progress</button>
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs !text-red-300" disabled={busy} onClick={() => answer(r, 'declined')}>Decline</button>
              </div>
              <p className="text-[11px] text-tnr-cream/40">
                Make the actual change in Members first — answering a request does not edit the record.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

function Activity({ cat }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    aGet('/api/admin/university-ambassadors?view=activity').then(r => r?.ok && setList(r.activity));
  }, []);
  const uniName = useMemo(() => new Map(cat.universities.map(u => [u.id, u.name])), [cat]);

  if (!list) return <div className="card p-6 text-sm text-tnr-cream/50">Loading…</div>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-tnr-line">
      <table className="w-full text-sm">
        <thead className="border-b border-tnr-line"><tr>
          <th className={th}>When</th><th className={th}>Ambassador</th><th className={th}>Action</th><th className={th}>University</th>
        </tr></thead>
        <tbody>
          {list.map(a => (
            <tr key={a.id} className="border-t border-tnr-line/40">
              <td className={`${td} whitespace-nowrap text-xs text-tnr-cream/50`}>{fmt(a.created_at)}</td>
              <td className={`${td} text-tnr-cream`}>{a.ambassador_name || '—'}</td>
              <td className={`${td} ${a.action === 'CONTACT_VIEWED' ? 'text-amber-300' : 'text-tnr-cream/80'}`}>
                {ACTION_LABEL[a.action] || a.action}
                {a.detail?.title && <span className="text-tnr-cream/50"> — &ldquo;{a.detail.title}&rdquo; to {a.detail.recipients}</span>}
                {a.detail?.to && <span className="text-tnr-cream/50"> → {a.detail.to.replace('_', ' ')}</span>}
              </td>
              <td className={`${td} text-xs text-tnr-cream/60`}>{uniName.get(a.university_id) || a.university_id}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-tnr-cream/40">No activity yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
