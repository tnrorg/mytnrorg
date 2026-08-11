'use client';
import { useEffect, useMemo, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet } from '@/components/member/memberApi';
import { APP_STATUS_LABEL, APP_STATUS_TONE, WRITTEN_QUESTIONS } from '@/lib/cec';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C89A2B', muted: '#647169' };

/* Applications for Executive Committee positions, as a sitting CEC member sees
 * them.
 *
 * Read-only by design. Committee members review the written answers; the
 * decision itself rests with the Super Admin, so there are no action buttons
 * here and the page says so rather than leaving someone hunting for them.
 * Applicants' contact details are not sent to this view at all.
 */
export default function MemberCecApplicationsPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  const [position, setPosition] = useState('');

  useEffect(() => {
    mGet('/api/member/cec-applications')
      .then(j => (j?.ok ? setRows(j.applications || []) : setErr(j?.message || 'Could not load applications.')))
      .catch(() => setErr('Could not load applications.'));
  }, []);

  const positions = useMemo(
    () => [...new Set((rows || []).map(a => a.position).filter(Boolean))].sort(), [rows]);
  const shown = useMemo(
    () => (rows || []).filter(a => !position || a.position === position), [rows, position]);

  return (
    <MemberShell active="/member/cec-applications">
      <div className="max-w-3xl space-y-4">
        <div>
          <h1 className="text-xl font-black" style={{ color: C.deep }}>Executive Position Applications</h1>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            Applications received for open Central Executive Committee positions.
            You can read every answer here. The final decision is recorded by the
            Super Admin, so there is nothing to action on this page.
          </p>
        </div>

        {err && (
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(170,60,60,.08)', color: '#8A2F2F' }}>{err}</div>
        )}

        {rows === null && !err && <div className="text-sm text-gray-400">Loading…</div>}

        {rows && !rows.length && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-400">
            No applications have been received yet.
          </div>
        )}

        {!!positions.length && (
          <div className="flex flex-wrap gap-2">
            <Chip on={!position} onClick={() => setPosition('')}>All ({rows.length})</Chip>
            {positions.map(p => (
              <Chip key={p} on={position === p} onClick={() => setPosition(p)}>
                {p} ({rows.filter(a => a.position === p).length})
              </Chip>
            ))}
          </div>
        )}

        {shown.map(a => {
          const tone = APP_STATUS_TONE[a.status] || {};
          const open = openId === a.id;
          const answers = [
            [WRITTEN_QUESTIONS[0][1], a.relevant_experience],
            [a.scenario_question || 'Scenario question', a.scenario_answer],
            [WRITTEN_QUESTIONS[1][1], a.challenge_answer],
            [WRITTEN_QUESTIONS[2][1], a.leadership_answer],
            [WRITTEN_QUESTIONS[3][1], a.vision_answer],
          ].filter(([, v]) => v);

          return (
            <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {/* Photograph, where the applicant supplied one. Applications
                    submitted before this field existed have none, and the space
                    is simply not drawn rather than showing an empty frame. */}
                {a.photo_url && (
                  <img src={a.photo_url} alt=""
                    className="w-9 h-11 rounded-lg object-cover object-top shrink-0 bg-gray-100" />
                )}
                <button className="font-bold text-[15px] text-left" style={{ color: C.deep }}
                  onClick={() => setOpenId(open ? null : a.id)}>
                  {a.full_name}
                </button>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: tone.bg, color: tone.fg }}>
                  {APP_STATUS_LABEL[a.status] || a.status}
                </span>
                <span className="text-[12px]" style={{ color: C.muted }}>{a.position}</span>
                {a.reference_no && (
                  <span className="text-[11px] tabular-nums ml-auto" style={{ color: C.muted }}>
                    {a.reference_no}
                  </span>
                )}
              </div>

              <div className="mt-1 text-[12px]" style={{ color: C.muted }}>
                {[a.education_level, [a.current_position, a.organisation].filter(Boolean).join(' · '),
                  [a.village, a.union_council].filter(Boolean).join(', ')].filter(Boolean).join(' — ')}
              </div>

              <button className="mt-3 text-[12px] font-bold underline" style={{ color: C.green }}
                onClick={() => setOpenId(open ? null : a.id)}>
                {open ? 'Hide answers' : 'Read answers'}
              </button>

              {open && (
                <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                  {answers.map(([q, v]) => (
                    <div key={q}>
                      <div className="text-[12px] font-bold leading-snug" style={{ color: C.green }}>{q}</div>
                      <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line"
                        style={{ color: '#17211C' }}>{v}</p>
                    </div>
                  ))}
                  <p className="text-[11px] pt-2 border-t border-gray-100" style={{ color: C.muted }}>
                    Contact details are held by the selection panel and are not shown here.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </MemberShell>
  );
}

function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[12px] font-bold border transition"
      style={on
        ? { background: C.deep, color: '#fff', borderColor: C.deep }
        : { background: '#fff', color: C.muted, borderColor: 'rgba(10,61,44,.16)' }}>
      {children}
    </button>
  );
}
