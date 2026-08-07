'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost } from './adminApi';

const PRESETS = [
  {
    key: 'reminder',
    label: 'Voting reminder',
    subject: 'Reminder: Cast your vote in the TNR Election',
    heading: 'Your vote is still pending',
    message:
`Assalam-o-Alaikum Dear {{name}},

Voting in the Tehreek-e-Nojawanan Roundu election is currently open and our records show that you have not cast your vote yet.

Please take a moment to vote. You will need the email address registered with TNR — a 6-digit verification code will be sent to it.

Your vote is confidential and can only be cast once.

Thank you,
TNR Election Committee`,
  },
  {
    key: 'opening',
    label: 'Voting has opened',
    subject: 'Voting is now OPEN — TNR Election',
    heading: 'Voting is now open',
    message:
`Assalam-o-Alaikum Dear {{name}},

Voting in the Tehreek-e-Nojawanan Roundu election is now open.

Click the button below, enter your registered email address, and you will receive a 6-digit verification code. After verifying, confirm your details and select your candidates.

Each member may vote only once.

TNR Election Committee`,
  },
  {
    key: 'closing',
    label: 'Closing soon',
    subject: 'Last chance — TNR Election closes soon',
    heading: 'Voting closes soon',
    message:
`Assalam-o-Alaikum Dear {{name}},

This is a final reminder that voting in the TNR election closes shortly. Your vote has not been recorded yet.

Please vote before the deadline so your voice is counted.

TNR Election Committee`,
  },
  { key: 'custom', label: 'Custom message', subject: '', heading: '', message: '' },
];

export default function RemindersTab({ toast }) {
  const [info, setInfo] = useState(null);
  const [preset, setPreset] = useState('reminder');
  const [audience, setAudience] = useState('not_voted');
  const [subject, setSubject] = useState(PRESETS[0].subject);
  const [heading, setHeading] = useState(PRESETS[0].heading);
  const [message, setMessage] = useState(PRESETS[0].message);
  const [button, setButton] = useState(true);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [mode, setMode] = useState('quick');
  const [picked, setPicked] = useState([]);      // hand-selected members [{id, full_name, ...}]
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState('');

  const load = () => aGet('/api/admin/reminders?t=' + Date.now()).then(setInfo).catch(() => {});
  useEffect(() => { load(); }, []);

  const applyPreset = (k) => {
    setPreset(k);
    const p = PRESETS.find(x => x.key === k);
    if (p && k !== 'custom') { setSubject(p.subject); setHeading(p.heading); setMessage(p.message); }
  };

  const counts = info?.counts || {};
  const target = picked.length ? picked.filter(p => p.has_email).length : (counts[audience] ?? 0);

  const sendTest = async () => {
    if (!testTo.trim()) return toast?.('Enter a test email address first.', 'error');
    setBusy(true);
    try {
      const r = await aPost('/api/admin/reminders',
        { subject, heading, message, audience, include_button: button, test_email: testTo.trim() });
      if (r.error) toast?.(r.detail || r.message || 'Test failed.', 'error');
      else toast?.('Test email sent to ' + testTo.trim(), 'success');
    } finally { setBusy(false); }
  };

  const sendAll = async (override) => {
    const payloadSubject = (override?.subject ?? subject).trim();
    const payloadHeading = override?.heading ?? heading;
    const payloadMessage = (override?.message ?? message).trim();
    if (!payloadSubject || !payloadMessage) return toast?.('Subject and message are required.', 'error');
    const label = picked.length ? `your ${picked.length} selected member(s)`
      : audience === 'all' ? 'ALL approved members'
      : audience === 'not_voted' ? 'members who have NOT voted yet'
      : audience === 'candidates' ? 'CANDIDATES of the current election' : 'members who have already voted';
    if (!confirm(`Send this email to ${target} recipient(s) — ${label}?\n\nThis cannot be undone.`)) return;

    setBusy(true); setProgress({ sent: 0, failed: 0, total: target, errors: [] });
    let offset = 0, sent = 0, failed = 0, errors = [];
    try {
      for (let guard = 0; guard < 500; guard++) {
        const r = await aPost('/api/admin/reminders',
          { subject: payloadSubject, heading: payloadHeading, message: payloadMessage, audience, include_button: button, offset,
            member_ids: picked.length ? picked.map(p => p.id) : undefined });
        if (r.error) { toast?.(r.detail || r.message || 'Sending failed.', 'error'); break; }
        sent += r.sent || 0; failed += r.failed || 0;
        if (r.errors?.length) errors = errors.concat(r.errors).slice(0, 8);
        offset = r.next_offset;
        setProgress({ sent, failed, total: r.total ?? target, errors });
        if (r.done) { toast?.(`Done — ${sent} sent, ${failed} failed.`, failed ? 'error' : 'success'); break; }
      }
    } finally { setBusy(false); load(); }
  };

  const QUICK_LINES = audience === 'candidates' ? [
    'Your candidacy has been confirmed. Best of luck in the election.',
    'Candidate briefing: please attend the meeting arranged by the Election Committee.',
    'Reminder for all candidates: campaigning must stop before voting begins.',
  ] : [
    'Voting is now OPEN. Please cast your vote today.',
    'Reminder: your vote has not been recorded yet. Please vote before the deadline.',
    'Voting closes soon — this is your final reminder to vote.',
  ];
  const sendQuick = () => {
    const body = quick.trim();
    if (!body) return toast?.('Type a short message first.', 'error');
    sendAll({
      subject: audience === 'candidates'
        ? 'TNR Election — Notice for Candidates'
        : 'TNR Election — Message from the Election Committee',
      heading: audience === 'candidates'
        ? 'Notice for Candidates'
        : 'Notice from the TNR Election Committee',
      message: `Assalam-o-Alaikum Dear {{name}},\n\n${body}\n\nTNR Election Committee`,
    });
  };

  const Pill = ({ k, label, n }) => (
    <button onClick={() => { setAudience(k); if (k === 'candidates') setButton(false); }}
      className={`px-3 py-2 rounded-xl text-sm border transition ${audience === k
        ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
        : 'border-white/10 text-tnr-cream/70 hover:bg-white/5'}`}>
      {label} <span className="opacity-70">({n ?? 0})</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">Email Reminders</h2>
        <p className="text-sm text-tnr-cream/50 mt-1">
          Send a notice to members at their registered email address. Uses the same SMTP account as the OTP emails.
        </p>
      </div>

      {info && !info.smtp_configured && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in your environment, then redeploy.
        </div>
      )}
      {info?.error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <div className="font-semibold">Could not read members.</div>
          <div className="text-red-200/80 text-xs mt-1">{info.detail || info.message}</div>
        </div>
      )}

      {info && !info.error && !counts.all && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm space-y-1">
          <div className="font-semibold">No recipients found.</div>
          <div className="text-amber-200/80">
            Database has {info.diagnostics?.total_members ?? 0} member(s), of which{' '}
            {info.diagnostics?.approved ?? 0} have status &ldquo;Approved&rdquo;
            {info.diagnostics?.approved ? ` and ${(info.diagnostics.approved - (counts.missing_email || 0))} of those have an email address` : ''}.
          </div>
          {info.diagnostics?.statuses && (
            <div className="text-xs text-amber-200/60">
              Statuses in database: {Object.entries(info.diagnostics.statuses).map(([k, v]) => `${k} (${v})`).join(', ') || 'none'}
            </div>
          )}
          {info.diagnostics && !info.diagnostics.has_email_column && (
            <div className="text-xs text-red-300">
              The members table has no &ldquo;email&rdquo; column. Columns found: {(info.diagnostics.columns || []).join(', ') || 'none'}
            </div>
          )}
          <div className="text-xs text-amber-200/60">
            Fix in Members: set status to Approved and make sure the Email field is filled.
          </div>
        </div>
      )}

      {!!counts.missing_email && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          {counts.missing_email} approved member(s) have no email address and will be skipped.
        </div>
      )}

      <div className="flex gap-2">
        {[['quick', 'Quick message'], ['full', 'Full composer']].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            className={`px-4 py-2 rounded-xl text-sm border transition ${mode === k
              ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
              : 'border-white/10 text-tnr-cream/70 hover:bg-white/5'}`}>{l}</button>
        ))}
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide text-tnr-cream/50 mb-2">Send to</label>
        <div className="flex flex-wrap gap-2">
          <Pill k="not_voted" label="Not voted yet" n={counts.not_voted} />
          <Pill k="all" label="All members" n={counts.all} />
          <Pill k="voted" label="Already voted" n={counts.voted} />
          <Pill k="candidates" label="Candidates" n={counts.candidates} />
        </div>
      </div>


      <div className="rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs uppercase tracking-wide text-tnr-cream/50">
            Or pick exact members (single or multiple)
          </label>
          {!!picked.length && (
            <button onClick={() => setPicked([])} className="text-xs text-red-300 hover:underline">
              Clear selection ({picked.length})
            </button>
          )}
        </div>

        {!!picked.length && (
          <div className="flex flex-wrap gap-2">
            {picked.map(m => (
              <span key={m.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                m.has_email ? 'bg-tnr-gold text-tnr-black' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                {m.full_name}{m.member_code ? ` · ${m.member_code}` : ''}{!m.has_email && ' (no email)'}
                <button onClick={() => setPicked(picked.filter(x => x.id !== m.id))} className="font-bold">×</button>
              </span>
            ))}
          </div>
        )}

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search member by name, code or village…"
          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream" />

        {search.trim().length >= 2 && (
          <div className="rounded-xl border border-white/10 divide-y divide-white/10 max-h-56 overflow-auto">
            {(info?.members_directory || [])
              .filter(m => {
                const q = search.trim().toLowerCase();
                return [m.full_name, m.member_code, m.village].some(v => String(v || '').toLowerCase().includes(q));
              })
              .slice(0, 12)
              .map(m => {
                const on = picked.some(x => x.id === m.id);
                return (
                  <button key={m.id} onClick={() => setPicked(on ? picked.filter(x => x.id !== m.id) : [...picked, m])}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition ${
                      on ? 'bg-tnr-gold/15' : 'hover:bg-white/5'}`}>
                    <span className={`w-5 h-5 rounded grid place-items-center text-[11px] font-bold shrink-0 ${
                      on ? 'bg-tnr-gold text-tnr-black' : 'border border-white/20 text-transparent'}`}>✓</span>
                    <span className="flex-1 min-w-0">
                      <span className="text-tnr-cream font-semibold">{m.full_name}</span>
                      <span className="text-tnr-cream/40 text-xs"> {m.member_code ? `· ${m.member_code}` : ''}{m.village ? ` · ${m.village}` : ''}</span>
                    </span>
                    {!m.has_email && <span className="text-[10px] text-red-300 shrink-0">no email</span>}
                  </button>
                );
              })}
          </div>
        )}
        <p className="text-[11px] text-tnr-cream/40">
          When members are selected here, the message goes ONLY to them — the audience buttons above are ignored.
        </p>
      </div>

      {mode === 'quick' && (
        <div className="rounded-2xl border border-white/10 p-4 space-y-3">
          <label className="block text-sm font-semibold text-tnr-cream">Short message</label>
          <p className="text-xs text-tnr-cream/50 -mt-1">
            Type one or two lines. The greeting, member name and TNR branding are added automatically.
          </p>
          <textarea rows={3} value={quick} onChange={e => setQuick(e.target.value)}
            placeholder="e.g. Voting is now open. Please cast your vote before 8:00 PM today."
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream leading-relaxed" />
          <div className="flex flex-wrap gap-2">
            {QUICK_LINES.map((q, i) => (
              <button key={i} onClick={() => setQuick(q)}
                className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-tnr-cream/60 hover:bg-white/5 text-left">
                {q.length > 46 ? q.slice(0, 46) + '…' : q}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-tnr-cream/70 mr-auto">
              <input type="checkbox" checked={button} onChange={e => setButton(e.target.checked)} />
              Include &ldquo;Cast Your Vote&rdquo; button
            </label>
            <button onClick={sendQuick} disabled={busy || !target || !quick.trim()}
              className="px-5 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm disabled:opacity-40">
              {busy ? 'Sending…' : `Send to ${target} member(s)`}
            </button>
          </div>
        </div>
      )}

      {mode === 'full' && (
      <div className="rounded-2xl border border-white/10 p-4 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wide text-tnr-cream/50 mb-2">Template</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition ${preset === p.key
                  ? 'bg-white/10 border-tnr-gold/50 text-tnr-cream'
                  : 'border-white/10 text-tnr-cream/60 hover:bg-white/5'}`}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-tnr-cream/50 mb-1">Subject</label>
            <input value={subject} onChange={e => { setSubject(e.target.value); setPreset('custom'); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream" />
          </div>
          <div>
            <label className="block text-xs text-tnr-cream/50 mb-1">Heading (inside the email)</label>
            <input value={heading} onChange={e => { setHeading(e.target.value); setPreset('custom'); }}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-tnr-cream/50 mb-1">
            Message — use <code className="text-tnr-gold">{'{{name}}'}</code>, <code className="text-tnr-gold">{'{{member_code}}'}</code> or <code className="text-tnr-gold">{'{{village}}'}</code> to personalise
          </label>
          <textarea rows={12} value={message} onChange={e => { setMessage(e.target.value); setPreset('custom'); }}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream font-mono leading-relaxed" />
        </div>

        <label className="flex items-center gap-2 text-sm text-tnr-cream/70">
          <input type="checkbox" checked={button} onChange={e => setButton(e.target.checked)} />
          Include a &ldquo;Cast Your Vote&rdquo; button linking to the voting page
        </label>
      </div>
      )}

      <div className="rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-tnr-cream/50 mb-1">Send a test to yourself first</label>
            <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="you@gmail.com"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-tnr-cream" />
          </div>
          <button onClick={sendTest} disabled={busy}
            className="px-4 py-2 rounded-xl border border-white/15 text-sm text-tnr-cream hover:bg-white/5 disabled:opacity-40">
            Send test
          </button>
          {mode === 'full' && <button onClick={() => sendAll()} disabled={busy || !target}
            className="px-5 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm disabled:opacity-40">
            {busy ? 'Sending…' : `Send to ${target} member(s)`}
          </button>}
        </div>

        {progress && (
          <div className="text-sm text-tnr-cream/70 space-y-1">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-tnr-gold transition-all"
                style={{ width: `${progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0}%` }} />
            </div>
            <div>{progress.sent} sent · {progress.failed} failed · {progress.total} total</div>
            {progress.errors?.map((e, i) => <div key={i} className="text-red-300 text-xs">{e}</div>)}
          </div>
        )}

        <p className="text-xs text-tnr-cream/40">
          Gmail allows roughly 500 emails per day. For larger lists use a free Brevo or SendGrid SMTP key.
          Sending runs in batches of 25 — keep this page open until it finishes.
        </p>
      </div>
    </div>
  );
}
