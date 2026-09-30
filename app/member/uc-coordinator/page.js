'use client';
import { useCallback, useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
import {
  SNAPSHOT_FIELDS, MOTIVATION_QUESTION, MOTIVATION_HINT, MOTIVATION_MIN_WORDS,
  MOTIVATION_MAX, APP_STATUS_LABEL, APP_STATUS_TONE, wordCount, validateApplication,
} from '@/lib/ucCoordinator';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227' };

/* Applying to serve as a Union Council Coordinator.
 *
 * WHY THIS FORM ASKS FOR ALMOST NOTHING
 *
 * The paper form has thirteen fields. Nine of them — name, membership number,
 * Union Council, both addresses, WhatsApp, email, education, profession — are
 * already on the member's record, so this page SHOWS them and the server
 * copies them. The member writes one answer and ticks one box.
 *
 * The nine are deliberately NOT editable here. If a member could correct their
 * address on this form, the correction would live on the application and their
 * actual membership record would stay wrong — so the organisation would end up
 * with two addresses for one person and no way to tell which was current. The
 * page points them at the right place to fix it instead, which fixes it
 * everywhere at once.
 */
export default function UcCoordinatorApply() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [motivation, setMotivation] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    mGet('/api/member/uc-coordinator')
      .then(r => setD(r || null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const round = d?.round || null;
  const mine = d?.application || null;
  const snap = d?.snapshot || {};
  const gaps = d?.missing || [];

  /* The closing date is read here only to hide the form early. The server
   * checks it again against its own clock, and that is the check that decides
   * — see the route. */
  const closed = round?.closes_on
    && Date.now() > new Date(`${round.closes_on}T23:59:59+05:00`).getTime();

  const words = wordCount(motivation);

  function review() {
    const e = validateApplication({ motivation, commitment_accepted: accepted });
    setErrors(e);
    if (Object.keys(e).length) return;
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    const r = await mPost('/api/member/uc-coordinator', {
      motivation, commitment_accepted: accepted,
    });
    setBusy(false);
    setConfirming(false);

    if (!r?.ok) {
      if (r?.errors) setErrors(r.errors);
      setNote({ tone: 'err', text: r?.message || 'Your application could not be submitted.' });
      return;
    }
    /* `duplicate` comes back when the unique index caught a second submission —
     * almost always a double-tap on a slow connection. It is not an error, and
     * showing one would make a member think their application had failed. */
    setNote({
      tone: 'ok',
      text: r.duplicate ? 'You had already applied — showing your application.' : r.message,
    });
    setD(prev => ({ ...prev, application: r.application }));
  }

  return (
    <MemberShell title="UC Coordinator">
      <div className="mx-auto max-w-3xl px-4 py-6">

        <header className="mb-5">
          <h1 className="text-[22px] font-black" style={{ color: C.deep }}>
            {round?.title || 'TNR Union Council Coordinator'}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600">
            {round?.summary
              || 'Applications to coordinate TNR activity in your Union Council. '
               + 'Open to existing TNR members only.'}
          </p>
          {round?.closes_on && (
            <p className="mt-2 text-[13px] font-semibold" style={{ color: closed ? '#8A2F2F' : C.green }}>
              {closed ? 'Applications closed on ' : 'Closing date: '}{round.closes_on}
            </p>
          )}
        </header>

        {note && (
          <div className="mb-4 rounded-xl px-4 py-3 text-[13.5px]"
            style={note.tone === 'ok'
              ? { background: 'rgba(16,140,90,.10)', color: '#0A5B3A' }
              : { background: 'rgba(170,60,60,.10)', color: '#8A2F2F' }}>
            {note.text}
          </div>
        )}

        {loading && <p className="text-[14px] text-gray-500">Loading…</p>}

        {/* ── Nothing open ── */}
        {!loading && !round && !mine && (
          <Card>
            <p className="text-[14px] text-gray-600">
              There is no Union Council Coordinator recruitment open at the moment.
              When the committee opens one it will be announced on the TNR website
              and will appear here.
            </p>
            {d?.detail && (
              <p className="mt-2 text-[12px] text-gray-400">{d.detail}</p>
            )}
          </Card>
        )}

        {/* ── Already applied ── */}
        {!loading && mine && <Submitted app={mine} />}

        {/* ── The form ── */}
        {!loading && round && !mine && !closed && (
          <>
            {/* The details the system already holds */}
            <Card>
              <h2 className="mb-1 text-[15px] font-bold" style={{ color: C.deep }}>
                Your details
              </h2>
              <p className="mb-3 text-[12.5px] leading-relaxed text-gray-500">
                Taken from your TNR membership record — you do not need to type
                them again. If anything below is wrong or out of date, please fix
                it on your{' '}
                <a href="/member/profile" className="font-semibold underline" style={{ color: C.green }}>
                  profile
                </a>{' '}
                first, so it is corrected everywhere rather than only on this form.
              </p>

              <dl className="divide-y" style={{ borderColor: '#EEF1EF' }}>
                {SNAPSHOT_FIELDS.map(([k, label]) => (
                  <div key={k} className="flex flex-wrap gap-x-3 py-2">
                    <dt className="w-full text-[11.5px] uppercase tracking-wide text-gray-400 sm:w-56">
                      {label}
                    </dt>
                    <dd className="flex-1 text-[14px] font-medium" style={{ color: snap[k] ? '#15231D' : '#B4271F' }}>
                      {snap[k] || 'Not recorded'}
                    </dd>
                  </div>
                ))}
              </dl>

              {!!gaps.length && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px]"
                  style={{ background: 'rgba(170,60,60,.09)', color: '#8A2F2F' }}>
                  The committee cannot review an application without these. Please
                  ask the membership committee to complete your record first.
                </p>
              )}
            </Card>

            {/* The question */}
            <Card>
              <h2 className="mb-1 text-[15px] font-bold" style={{ color: C.deep }}>
                Role &amp; Motivation
              </h2>
              <label className="block">
                <span className="mb-1 block text-[14px] font-semibold" style={{ color: '#15231D' }}>
                  1. {MOTIVATION_QUESTION} *
                </span>
                <span className="mb-2 block text-[12.5px] leading-relaxed text-gray-500">
                  {MOTIVATION_HINT}
                </span>
                <textarea rows={8} value={motivation} maxLength={MOTIVATION_MAX}
                  onChange={e => { setMotivation(e.target.value); setErrors(x => ({ ...x, motivation: null })); }}
                  className="w-full rounded-xl border px-3 py-2 text-[14px] leading-relaxed outline-none focus:ring-2"
                  style={{ borderColor: errors.motivation ? '#D06A62' : '#DDE3DF' }} />
                <span className="mt-1 block text-[11.5px] text-gray-400">
                  {words} {words === 1 ? 'word' : 'words'}
                  {words < MOTIVATION_MIN_WORDS && ` — at least ${MOTIVATION_MIN_WORDS} needed`}
                </span>
                {errors.motivation && (
                  <span className="mt-1 block text-[12.5px] font-medium" style={{ color: '#B4271F' }}>
                    {errors.motivation}
                  </span>
                )}
              </label>
            </Card>

            {/* The commitment */}
            <Card>
              <h2 className="mb-2 text-[15px] font-bold" style={{ color: C.deep }}>Commitment</h2>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={accepted} className="mt-0.5 h-4 w-4 shrink-0"
                  onChange={e => { setAccepted(e.target.checked); setErrors(x => ({ ...x, commitment_accepted: null })); }} />
                <span className="text-[13.5px] leading-relaxed" style={{ color: '#15231D' }}>
                  {d?.commitment_text}
                </span>
              </label>
              {errors.commitment_accepted && (
                <p className="mt-1.5 text-[12.5px] font-medium" style={{ color: '#B4271F' }}>
                  {errors.commitment_accepted}
                </p>
              )}
              {/* The date is stamped by the server when the application is
                  saved, so it cannot be back-dated from a browser. */}
              <p className="mt-2 text-[11.5px] text-gray-400">
                Submitting records your name, membership number and today’s date
                against this confirmation.
              </p>
            </Card>

            <button type="button" onClick={review} disabled={busy || !!gaps.length}
              className="w-full rounded-xl px-4 py-3 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: C.green }}>
              Review and submit
            </button>
          </>
        )}

        {/* ── Closed, and they did not apply ── */}
        {!loading && round && !mine && closed && (
          <Card>
            <p className="text-[14px] text-gray-600">
              Applications for this round closed on {round.closes_on}.
            </p>
          </Card>
        )}

        {/* ── The confirmation step ── */}
        {confirming && (
          <Confirm busy={busy} onCancel={() => setConfirming(false)} onConfirm={submit}
            snap={snap} motivation={motivation} />
        )}
      </div>
    </MemberShell>
  );
}

function Card({ children }) {
  return (
    <section className="mb-4 rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: '#E7EAE8' }}>
      {children}
    </section>
  );
}

/* The last chance to stop.
 *
 * An application cannot be edited once it is in, so the member is shown what
 * the committee will see before anything is written. A form that submits on
 * the first click and then says "you cannot change this" has put the warning
 * after the decision. */
function Confirm({ busy, onCancel, onConfirm, snap, motivation }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <h3 className="text-[17px] font-black" style={{ color: C.deep }}>
          Submit your application?
        </h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600">
          It will be sent to the committee as{' '}
          <b style={{ color: '#15231D' }}>{snap.full_name}</b> ({snap.membership_id}),{' '}
          {snap.union_council}. You will not be able to edit it afterwards.
        </p>
        <div className="mt-3 max-h-40 overflow-y-auto rounded-xl px-3 py-2 text-[13px] leading-relaxed"
          style={{ background: '#F6F8F7', color: '#3A4842' }}>
          {motivation}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="flex-1 rounded-xl border px-4 py-2.5 text-[14px] font-bold disabled:opacity-50"
            style={{ borderColor: '#DDE3DF', color: '#3A4842' }}>
            Go back and edit
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ background: C.green }}>
            {busy ? 'Submitting…' : 'Yes, submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* What a member sees after applying: their own application, and where it has
 * got to. The review status is shown plainly rather than hidden — a member who
 * can see "Shortlisted" does not have to email anyone to ask. */
function Submitted({ app }) {
  const tone = APP_STATUS_TONE[app.status] || APP_STATUS_TONE.new;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg px-2.5 py-1 text-[11.5px] font-black uppercase tracking-wider"
          style={{ background: tone.bg, color: tone.fg }}>
          {APP_STATUS_LABEL[app.status] || 'Received'}
        </span>
        {app.reference_no && (
          <span className="text-[12.5px] text-gray-500">
            Reference <b className="tabular-nums" style={{ color: C.deep }}>{app.reference_no}</b>
          </span>
        )}
      </div>

      <p className="text-[14px] leading-relaxed text-gray-700">
        Your application to serve as UC Coordinator for{' '}
        <b style={{ color: '#15231D' }}>{app.union_council}</b> was received on{' '}
        {new Date(app.submitted_at || app.created_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}. The committee will contact you directly.
      </p>

      <h3 className="mt-4 text-[12px] font-bold uppercase tracking-wide text-gray-400">
        {MOTIVATION_QUESTION}
      </h3>
      <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: '#3A4842' }}>
        {app.motivation}
      </p>

      {/* The wording THEY agreed to, read back from their own application
          rather than from today's constant — so a later revision of the
          commitment does not rewrite what this member confirmed. */}
      {app.commitment_text && (
        <p className="mt-4 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed"
          style={{ background: '#F6F8F7', color: '#5A6660' }}>
          ✓ {app.commitment_text}
        </p>
      )}
    </Card>
  );
}
