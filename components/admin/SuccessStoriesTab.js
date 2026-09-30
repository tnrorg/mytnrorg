'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet, aPost } from './adminApi';
import {
  STATUSES, STATUS_LABEL, STATUS_TONE, kindIcon, kindLabel,
  achievedLabel, initialsOf,
} from '@/lib/successStories';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227' };

/* TNR Success Stories — the review queue.
 *
 * Opens on what is WAITING, not on everything. A review queue whose default
 * view is "all 300 stories" is a queue nobody works through, because the six
 * that need a decision are invisible among the ones already decided.
 */
export default function SuccessStoriesTab({ toast }) {
  const [status, setStatus] = useState('pending');
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [sendBack, setSendBack] = useState(null);   // the story being sent back

  const load = useCallback((s) => {
    setLoading(true);
    aGet(`/api/admin/success-stories?status=${s}`)
      .then(r => setD(r || null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(status); }, [load, status]);

  const stories = d?.stories || [];
  const authors = d?.authors || {};
  const counts = d?.counts || {};

  async function act(story, action, extra = {}) {
    setBusy(story.id);
    const r = await aPost('/api/admin/success-stories', { id: story.id, action, ...extra });
    setBusy('');
    if (!r?.ok) return toast?.(r?.message || 'Could not save.', 'err');
    toast?.(r.message, 'ok');
    setSendBack(null);
    load(status);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h2 className="text-[20px] font-black" style={{ color: C.deep }}>
          TNR Success Stories
        </h2>
        <p className="text-[13px] text-gray-500">
          Achievements members have shared. Approving one puts it on the public
          website with the member’s name and photograph.
        </p>
      </header>

      {/* Status tabs, each carrying its count so the queue cannot grow unseen */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map(([k, label]) => {
          const on = status === k;
          const n = counts[k] || 0;
          return (
            <button key={k} type="button" onClick={() => setStatus(k)}
              className="rounded-xl px-3 py-1.5 text-[13px] font-bold"
              style={on
                ? { background: C.green, color: '#fff' }
                : { background: '#F1F4F2', color: '#4A554E' }}>
              {label}{n ? ` (${n})` : ''}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-[14px] text-gray-500">Loading…</p>}

      {!loading && !!d && !d.ok && (
        <p className="rounded-xl px-4 py-3 text-[13.5px]"
          style={{ background: 'rgba(170,60,60,.09)', color: '#8A2F2F' }}>
          {d.message}{d.detail ? ` ${d.detail}` : ''}
        </p>
      )}

      {!loading && d?.ok && !stories.length && (
        <p className="rounded-xl px-4 py-3 text-[13.5px]" style={{ background: '#F6F8F7', color: '#5A6660' }}>
          Nothing here.
        </p>
      )}

      {stories.map(s => {
        const a = authors[s.member_id] || {};
        const tone = STATUS_TONE[s.status] || STATUS_TONE.pending;
        return (
          <article key={s.id} className="mb-3 rounded-2xl border bg-white p-4" style={{ borderColor: '#E7EAE8' }}>
            <div className="flex flex-wrap items-start gap-3">
              <Avatar url={a.photo_url} name={a.full_name} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-[15px]" style={{ color: '#15231D' }}>{a.full_name || 'Member'}</b>
                  <span className="text-[12px] text-gray-500">
                    {a.membership_id}{a.union_council ? ` · ${a.union_council}` : ''}
                  </span>
                  <span className="ml-auto rounded-lg px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider"
                    style={{ background: tone.bg, color: tone.fg }}>
                    {STATUS_LABEL[s.status]}
                  </span>
                  {s.featured && (
                    <span className="rounded-lg px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider"
                      style={{ background: 'rgba(201,162,39,.18)', color: '#7A5C10' }}>
                      Featured
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-[15px] font-bold" style={{ color: C.deep }}>
                  {kindIcon(s.kind)} {s.title}
                </p>
                <p className="text-[12.5px] text-gray-500">
                  {kindLabel(s.kind)}
                  {s.organisation ? ` · ${s.organisation}` : ''}
                  {s.achieved_on ? ` · ${achievedLabel(s.achieved_on)}` : ''}
                </p>

                <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: '#3A4842' }}>
                  {s.description}
                </p>

                {s.image_url && (
                  <a href={s.image_url} target="_blank" rel="noreferrer"
                    className="mt-2 inline-block text-[12.5px] font-bold underline" style={{ color: C.green }}>
                    View the photo the member attached →
                  </a>
                )}

                {s.review_note && (
                  <p className="mt-2 rounded-xl px-3 py-2 text-[12.5px]"
                    style={{ background: 'rgba(200,154,43,.12)', color: '#7A5C10' }}>
                    Note sent to the member: {s.review_note}
                  </p>
                )}

                {/* ── Decisions ── */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.status !== 'published' && (
                    <Btn primary disabled={busy === s.id} onClick={() => act(s, 'publish')}>
                      {s.status === 'unpublished' ? 'Publish again' : 'Approve & publish'}
                    </Btn>
                  )}
                  {s.status === 'pending' && (
                    <Btn disabled={busy === s.id} onClick={() => setSendBack(s)}>
                      Send back for changes
                    </Btn>
                  )}
                  {s.status === 'published' && (
                    <>
                      <Btn disabled={busy === s.id}
                        onClick={() => act(s, 'feature', { featured: !s.featured })}>
                        {s.featured ? 'Remove from featured' : 'Feature on the page'}
                      </Btn>
                      <Btn danger disabled={busy === s.id} onClick={() => act(s, 'unpublish')}>
                        Take down
                      </Btn>
                    </>
                  )}
                  {['pending', 'changes_requested'].includes(s.status) && (
                    <Btn danger disabled={busy === s.id} onClick={() => act(s, 'reject')}>
                      Not accepted
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}

      {sendBack && (
        <SendBack story={sendBack} onCancel={() => setSendBack(null)}
          onSend={(note) => act(sendBack, 'send_back', { review_note: note })} />
      )}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary, danger }) {
  const style = primary
    ? { background: C.green, color: '#fff', border: '1px solid transparent' }
    : danger
      ? { background: '#fff', color: '#8A2F2F', border: '1px solid #E4C9C7' }
      : { background: '#fff', color: '#3A4842', border: '1px solid #DDE3DF' };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-50" style={style}>
      {children}
    </button>
  );
}

/* The member's photograph, exactly as the public card will show it — so a
 * reviewer approving a card can see the card they are approving. */
function Avatar({ url, name }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover"
      style={{ boxShadow: '0 0 0 2px rgba(11,107,79,.2)' }} />;
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-black text-white"
      style={{ background: 'linear-gradient(150deg,#0F6B4E,#083527)' }}>
      {initialsOf(name)}
    </span>
  );
}

/* Sending back REQUIRES a note — the server refuses without one, and the
 * button here stays disabled until there is something to send, so the rule is
 * visible before the click rather than as an error after it. */
function SendBack({ story, onCancel, onSend }) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <h3 className="text-[17px] font-black" style={{ color: C.deep }}>Send back for changes</h3>
        <p className="mt-1 text-[13px] text-gray-600">
          “{story.title}”. The member sees this note and can edit and resubmit.
        </p>
        <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} autoFocus
          className="mt-3 w-full rounded-xl border px-3 py-2 text-[14px] outline-none border-gray-200"
          placeholder="e.g. Could you add which university awarded the degree, and the month?" />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border px-4 py-2.5 text-[14px] font-bold"
            style={{ borderColor: '#DDE3DF', color: '#3A4842' }}>
            Cancel
          </button>
          <button type="button" onClick={() => onSend(note)} disabled={note.trim().length < 5}
            className="flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ background: C.green }}>
            Send back
          </button>
        </div>
      </div>
    </div>
  );
}
