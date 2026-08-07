'use client';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '@/components/useLang';
import { BrandHeader, Logo } from '@/components/Brand';

const api = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

export default function VotePage() {
  const { lang, toggle, t } = useLang();
  const rtl = lang === 'ur';
  const [step, setStep] = useState('mobile'); // mobile | otp | member | ballot | review | success | error
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otpId, setOtpId] = useState(null);
  const [devCode, setDevCode] = useState(null);
  const [channel, setChannel] = useState(null);
  const [voteToken, setVoteToken] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [data, setData] = useState({ positions: [], candidates: [] });
  const [selections, setSelections] = useState({}); // { [position_id]: candidate }
  const [ballotErr, setBallotErr] = useState('');
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [detailCand, setDetailCand] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const [errKind, setErrKind] = useState('');
  const [errDetail, setErrDetail] = useState('');

  async function requestOtp(e) {
    e?.preventDefault(); setLoading(true); setErrMsg('');
    const r = await api('/api/vote/request-otp', { email: mobile });
    setLoading(false);
    if (!r.ok) { setErrKind(r.error); setErrMsg(r.message || 'Error'); setErrDetail(r.detail || ''); setStep('error'); return; }
    setOtpId(r.otp_id); setChannel(r.channel); setDevCode(r.dev_code || null); setStep('otp');
  }
  async function verifyOtp(code) {
    setLoading(true); setErrMsg('');
    const r = await api('/api/vote/verify-otp', { otp_id: otpId, code });
    if (!r.ok) { setLoading(false); return { error: r.message }; }
    setVoteToken(r.vote_token);
    setMemberInfo(r.member || null);
    const cr = await api('/api/public/candidates', { vote_token: r.vote_token });
    setLoading(false);
    if (!cr.ok) return { error: cr.message };
    setData({ positions: cr.positions, candidates: cr.candidates }); setStep('member');
    return {};
  }
  const activePositions = data.positions || [];
  const filledCount = activePositions.filter(p => selections[p.id]).length;
  const ballotComplete = activePositions.length > 0 && filledCount === activePositions.length;
  // The voter is locked inside the ballot until it is submitted.
  const ballotLocked = (step === 'ballot' || step === 'review') && !receipt;

  function pick(position_id, cand) {
    setBallotErr('');
    setSelections(prev => ({ ...prev, [position_id]: cand })); // one per position, replaces any earlier choice
  }

  function goReview() {
    if (!ballotComplete) {
      setBallotErr('Please select one candidate for every election position before submitting your ballot.');
      return;
    }
    setBallotErr(''); setStep('review');
  }

  async function submitBallot() {
    if (!ballotComplete) {
      setBallotErr('Please select one candidate for every election position before submitting your ballot.');
      return;
    }
    setLoading(true);
    const payload = activePositions.map(p => ({ position_id: p.id, candidate_id: selections[p.id].id }));
    const r = await api('/api/vote/cast', { vote_token: voteToken, selections: payload });
    setLoading(false);
    if (!r.ok) { setErrKind(r.error); setErrMsg(r.message); setErrDetail(''); setStep('error'); return; }
    try { sessionStorage.removeItem('tnr_ballot'); } catch {}
    setReceipt(r.receipt_code); setStep('success');
  }

  // ── Keep selections through an accidental refresh ────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tnr_ballot');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.voteToken) return;
      setVoteToken(saved.voteToken);
      setMemberInfo(saved.memberInfo || null);
      setData(saved.data || { positions: [], candidates: [] });
      setSelections(saved.selections || {});
      setStep(saved.step === 'review' ? 'review' : 'ballot');
    } catch {}
  }, []);

  useEffect(() => {
    if (!ballotLocked) return;
    try {
      sessionStorage.setItem('tnr_ballot', JSON.stringify({ voteToken, memberInfo, data, selections, step }));
    } catch {}
  }, [ballotLocked, voteToken, memberInfo, data, selections, step]);

  // ── Warn before refreshing or closing an unfinished ballot ───────────────
  useEffect(() => {
    if (!ballotLocked) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [ballotLocked]);

  // ── Block back-button / in-portal navigation away from the ballot ────────
  useEffect(() => {
    if (!ballotLocked) return;
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href); // stay on the ballot
      setShowLeaveWarning(true);
    };
    const onClickCapture = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#') || a.target === '_blank') return;
      e.preventDefault(); e.stopPropagation();
      setShowLeaveWarning(true);
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [ballotLocked]);

  return (
    <main id="main" className="min-h-screen flex flex-col vote-green" dir={rtl ? 'rtl' : 'ltr'} style={{ background: '#FDFDFD', color: '#15231D' }}>
      <BrandHeader lang={lang} onToggle={toggle} t={t} />
      <section className="flex-1 flex items-start sm:items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          <Steps step={step} rtl={rtl} />
          {step === 'mobile' && (
            <div className="card p-6 sm:p-8 animate-fade-up">
              <div className="flex flex-col items-center text-center gap-2 mb-6"><Logo size={64} />
                <h1 className={`text-2xl font-bold text-white ${rtl ? 'urdu' : ''}`}>{t.enterMobile}</h1></div>
              <form onSubmit={requestOtp} className="space-y-4">
                <input className="input text-center text-lg tracking-wider" value={mobile} onChange={e => setMobile(e.target.value)}
                  placeholder={t.mobilePlaceholder} inputMode="email" autoCapitalize="none" autoFocus />
                <button className="btn-gold w-full text-lg" disabled={loading || mobile.length < 5}>
                  {loading ? '…' : t.sendOtp}</button>
              </form>
              <p className={`mt-4 text-xs text-center text-tnr-cream/50 ${rtl ? 'urdu' : ''}`}>
                {rtl ? 'صرف رجسٹرڈ اور منظور شدہ اراکین ووٹ ڈال سکتے ہیں۔ کوڈ آپ کے ای میل پر بھیجا جائے گا۔' : 'Only registered & approved members can vote. Your code is sent to your registered email.'}</p>
            </div>
          )}
          {step === 'otp' && <OtpStep t={t} rtl={rtl} channel={channel} devCode={devCode} loading={loading}
            onVerify={verifyOtp} onResend={requestOtp} />}
          {step === 'member' && <MemberDetails t={t} rtl={rtl} member={memberInfo} onContinue={() => setStep('ballot')} />}
          {step === 'ballot' && <Ballot t={t} rtl={rtl} data={data} selections={selections} onPick={pick} onDetail={setDetailCand}
            filled={filledCount} total={activePositions.length} complete={ballotComplete} err={ballotErr} onReview={goReview} />}
          {step === 'review' && <ReviewBallot t={t} rtl={rtl} positions={activePositions} selections={selections}
            loading={loading} err={ballotErr} onEdit={() => setStep('ballot')} onSubmit={submitBallot} />}
          {step === 'success' && <Success t={t} rtl={rtl} receipt={receipt} />}
          {step === 'error' && <ErrorState t={t} rtl={rtl} kind={errKind} msg={errMsg} detail={errDetail} />}
        </div>
      </section>

      {showLeaveWarning && <LeaveWarning rtl={rtl} onStay={() => setShowLeaveWarning(false)} />}
      {detailCand && <DetailModal t={t} rtl={rtl} cand={detailCand} positions={data.positions} onClose={() => setDetailCand(null)} />}
    </main>
  );
}

function Steps({ step, rtl }) {
  const order = ['mobile', 'otp', 'ballot', 'review', 'success'];
  const labels = rtl ? ['ای میل','او ٹی پی','بیلٹ','جائزہ','رسید'] : ['Email','OTP','Ballot','Review','Receipt'];
  const key = step === 'error' ? 'mobile' : (step === 'member' ? 'otp' : step);
  const idx = Math.max(0, order.indexOf(key));
  return <div className="flex items-center justify-center gap-2 mb-6">
    {labels.map((l, i) => (<div key={i} className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold border ${i <= idx ? 'bg-tnr-gold text-tnr-black border-tnr-gold' : 'border-gray-300 text-gray-400'}`}>{i + 1}</div>
      <span className={`text-xs ${i <= idx ? 'text-tnr-goldLight' : 'text-gray-400'} ${rtl ? 'urdu' : ''} hidden sm:inline`}>{l}</span>
      {i < labels.length - 1 && <div className={`w-6 h-px ${i < idx ? 'bg-tnr-gold' : 'bg-gray-200'}`} />}
    </div>))}
  </div>;
}

function OtpStep({ t, rtl, channel, devCode, loading, onVerify, onResend }) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [left, setLeft] = useState(300);
  const [err, setErr] = useState('');
  const refs = useRef([]);
  useEffect(() => { const id = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000); return () => clearInterval(id); }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  function setD(i, v) { v = v.replace(/\D/g, '').slice(-1); const d = [...digits]; d[i] = v; setDigits(d); if (v && i < 5) refs.current[i + 1]?.focus(); }
  async function submit() { const code = digits.join(''); if (code.length !== 6) return; const r = await onVerify(code); if (r?.error) setErr(r.error); }
  useEffect(() => { if (digits.join('').length === 6) submit(); /* eslint-disable-next-line */ }, [digits]);
  return (
    <div className="card p-6 sm:p-8 animate-fade-up text-center">
      <h1 className={`text-2xl font-bold text-white mb-1 ${rtl ? 'urdu' : ''}`}>{t.enterOtp}</h1>
      <p className="text-xs text-tnr-cream/50 mb-5">{channel === 'dev' ? 'TEST MODE (on-screen code)' : 'Sent to your registered email'}</p>
      {devCode && <div className="mb-4 chip bg-tnr-gold/20 text-tnr-goldLight border border-tnr-line mx-auto">Dev code: <b className="tracking-widest">{devCode}</b></div>}
      <div className="flex justify-center gap-2 mb-4" dir="ltr">
        {digits.map((d, i) => <input key={i} ref={el => refs.current[i] = el} value={d} onChange={e => setD(i, e.target.value)}
          onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }}
          className="input otp-input" inputMode="numeric" maxLength={1} autoFocus={i === 0} />)}
      </div>
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      <button className="btn-gold w-full text-lg mb-3" disabled={loading || digits.join('').length !== 6} onClick={submit}>{loading ? '…' : t.verify}</button>
      <div className="flex items-center justify-between text-sm text-tnr-cream/60">
        <span>{t.expiresIn} <b className="text-tnr-goldLight">{mm}:{ss}</b></span>
        <button className="text-tnr-gold hover:underline disabled:opacity-40" disabled={left > 240} onClick={() => { setDigits(Array(6).fill('')); setLeft(300); setErr(''); onResend(); }}>{t.resend}</button>
      </div>
    </div>
  );
}

function MemberDetails({ t, rtl, member, onContinue }) {
  const verified = rtl ? 'تصدیق شدہ — ووٹ کے اہل' : 'IDENTITY VERIFIED — ELIGIBLE TO VOTE';
  const Row = ({ k, v }) => v ? <div className="flex justify-between gap-3 py-2 border-b border-tnr-line/50 text-sm">
    <span className="text-tnr-cream/50">{k}</span><span className="text-tnr-cream font-semibold text-right">{v}</span></div> : null;
  return (
    <div className="card p-6 sm:p-8 animate-pop text-center">
      <div className="w-16 h-16 rounded-full bg-tnr-green2 grid place-items-center mx-auto mb-3 border-2 border-tnr-gold">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#E4C25B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div className="chip bg-tnr-green2/50 text-tnr-goldLight border border-tnr-line mx-auto mb-4 text-[11px]">{verified}</div>
      <h2 className={`text-2xl font-bold text-tnr-cream ${rtl ? 'urdu' : ''}`}>{member?.full_name || (rtl ? 'رکن' : 'Member')}</h2>
      <p className={`text-sm text-tnr-cream/50 mb-4 ${rtl ? 'urdu' : ''}`}>{rtl ? 'براہ کرم اپنی تفصیلات کی تصدیق کریں' : 'Please confirm your details before voting'}</p>
      <div className="text-left rounded-2xl bg-black/30 border border-tnr-line px-4 py-2 mb-5">
        <Row k={rtl ? 'رکن نمبر' : 'Member ID'} v={member?.member_code} />
        <Row k={rtl ? 'ای میل' : 'Email'} v={member?.email || member?.mobile} />
        <Row k={rtl ? 'گاؤں / علاقہ' : 'Village / Area'} v={member?.village} />
        <Row k={rtl ? 'یونین' : 'Union'} v={member?.union_name} />
      </div>
      <button className="btn-gold w-full text-lg" onClick={onContinue}>
        {rtl ? 'جاری رکھیں اور امیدوار منتخب کریں' : 'Continue to Choose Candidate'} →
      </button>
      <p className="mt-3 text-xs text-tnr-cream/40">{rtl ? 'اگر تفصیلات غلط ہیں تو انتظامیہ سے رابطہ کریں۔' : 'If any detail is wrong, contact the administration.'}</p>
    </div>
  );
}
function ProgressCard({ positions, selections, rtl }) {
  const filled = positions.filter(p => selections[p.id]).length;
  return (
    <div className="card p-4 mb-5">
      <div className="text-[11px] uppercase tracking-widest text-tnr-cream/50 mb-3">{rtl ? 'آپ کا بیلٹ' : 'YOUR BALLOT'}</div>
      <div className="space-y-2">
        {positions.map(p => {
          const done = !!selections[p.id];
          return (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${
                done ? 'bg-tnr-gold text-tnr-black' : 'border border-tnr-line text-tnr-cream/40'}`}>{done ? '✓' : '○'}</span>
              <span className={done ? 'text-tnr-cream font-semibold' : 'text-tnr-cream/50'}>{p.title}</span>
              {done && <span className="ml-auto text-xs text-tnr-goldLight truncate max-w-[45%]">{selections[p.id].name}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-tnr-line/60">
        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div className="h-full bg-tnr-gold transition-all duration-300"
            style={{ width: `${positions.length ? (filled / positions.length) * 100 : 0}%` }} />
        </div>
        <div className="text-xs text-tnr-cream/60 mt-2">
          {filled} of {positions.length} {rtl ? 'عہدے مکمل' : 'positions completed'}
        </div>
      </div>
    </div>
  );
}

function Ballot({ t, rtl, data, selections, onPick, onDetail, filled, total, complete, err, onReview }) {
  const positions = data.positions || [];
  const byPos = {};
  for (const c of data.candidates || []) { const k = c.position_id || 0; (byPos[k] = byPos[k] || []).push(c); }
  return (
    <div className="animate-fade-up pb-28">
      <h1 className={`text-2xl font-bold text-center mb-1 ${rtl ? 'urdu' : ''}`}>{rtl ? 'اپنا بیلٹ مکمل کریں' : 'Complete Your Ballot'}</h1>
      <p className="text-center text-xs text-gray-500 mb-5">
        {rtl ? 'ہر عہدے کے لیے ایک امیدوار منتخب کریں' : 'Select one candidate for every position'}
      </p>

      <ProgressCard positions={positions} selections={selections} rtl={rtl} />

      {positions.map(p => {
        const cands = byPos[p.id] || [];
        const chosen = selections[p.id];
        return (
          <div key={p.id} className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <div className="chip bg-tnr-green2/50 text-tnr-goldLight border border-tnr-line">{p.title}</div>
              {chosen
                ? <span className="text-xs text-tnr-gold font-semibold">✓ {rtl ? 'منتخب' : 'Selected'}</span>
                : <span className="text-xs text-gray-400">{rtl ? 'ابھی منتخب نہیں' : 'Not selected yet'}</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {cands.map(c => {
                const active = chosen?.id === c.id;
                return (
                  <button key={c.id} type="button" onClick={() => onPick(p.id, c)}
                    className={`card p-4 flex gap-3 items-center text-left transition ${
                      active ? 'border-tnr-gold ring-2 ring-tnr-gold/40 bg-tnr-gold/5' : 'hover:border-tnr-gold/50'}`}>
                    <img src={c.photo_url || '/tnr-logo.png'} alt="" className="w-16 h-16 rounded-xl object-cover bg-black/30 border border-tnr-line" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-tnr-cream truncate">{c.name}</div>
                      <div className="text-xs text-tnr-cream/60 truncate">
                        {c.symbol ? `${t.symbol}: ${c.symbol}` : ''}{c.union_name ? ` · ${c.union_name}` : ''}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold ${
                          active ? 'bg-tnr-gold text-tnr-black' : 'border border-tnr-line text-transparent'}`}>✓</span>
                        <span className={`text-xs ${active ? 'text-tnr-goldLight font-semibold' : 'text-tnr-cream/50'}`}>
                          {active ? (rtl ? 'منتخب شدہ' : 'Selected') : (rtl ? 'منتخب کریں' : 'Tap to select')}
                        </span>
                        <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onDetail(c); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onDetail(c); } }}
                          className="ml-auto text-xs text-tnr-gold hover:underline">{t.details}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!cands.length && <p className="text-sm text-gray-400">No candidates for this position yet.</p>}
            </div>
          </div>
        );
      })}

      {err && <p className="text-red-400 text-sm text-center mb-3">{err}</p>}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-tnr-line bg-tnr-black/95 backdrop-blur px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="text-xs text-tnr-cream/60 shrink-0">
            <b className="text-tnr-goldLight">{filled}</b> / {total} {rtl ? 'مکمل' : 'done'}
          </div>
          <button className="btn-gold flex-1 text-lg disabled:opacity-40" disabled={!complete} onClick={onReview}>
            {rtl ? 'بیلٹ کا جائزہ لیں' : 'Review Ballot'} →
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewBallot({ t, rtl, positions, selections, loading, err, onEdit, onSubmit }) {
  return (
    <div className="card p-6 sm:p-8 animate-pop">
      <h1 className={`text-2xl font-bold text-white text-center ${rtl ? 'urdu' : ''}`}>{rtl ? 'اپنے بیلٹ کا جائزہ لیں' : 'Review Your Ballot'}</h1>
      <p className="text-center text-xs text-tnr-cream/50 mt-1 mb-5">
        {rtl ? 'جمع کرانے کے بعد تبدیلی ممکن نہیں' : 'You cannot change your ballot after submitting'}
      </p>
      <div className="rounded-2xl bg-black/30 border border-tnr-line divide-y divide-tnr-line/60 mb-5">
        {positions.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-tnr-cream/50">{p.title}</div>
              <div className="font-bold text-tnr-cream truncate">{selections[p.id]?.name || '—'}</div>
            </div>
            {selections[p.id]?.photo_url && (
              <img src={selections[p.id].photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-tnr-line" />
            )}
          </div>
        ))}
      </div>
      {err && <p className="text-red-400 text-sm text-center mb-3">{err}</p>}
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" disabled={loading} onClick={onEdit}>{rtl ? 'تبدیل کریں' : 'Change'}</button>
        <button className="btn-gold flex-1" disabled={loading} onClick={onSubmit}>
          {loading ? '…' : (rtl ? 'بیلٹ جمع کرائیں' : 'Submit Ballot')}
        </button>
      </div>
      <p className="mt-4 text-[11px] text-center text-tnr-cream/40">
        {rtl ? 'تمام ووٹ ایک ساتھ محفوظ کیے جائیں گے۔' : 'All votes are saved together in one transaction.'}
      </p>
    </div>
  );
}

function LeaveWarning({ rtl, onStay }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm animate-pop text-center">
        <div className="text-3xl mb-3">🗳️</div>
        <h3 className="text-lg font-bold text-tnr-goldLight mb-2">
          {rtl ? 'براہ کرم اپنا بیلٹ مکمل کریں' : 'PLEASE COMPLETE YOUR BALLOT'}
        </h3>
        <p className={`text-sm text-tnr-cream/70 ${rtl ? 'urdu' : ''}`}>
          {rtl
            ? 'آپ سرکاری ووٹنگ کے عمل میں داخل ہو چکے ہیں۔ اس صفحے سے نکلنے سے پہلے آپ کو ہر عہدے کے لیے ایک امیدوار منتخب کرنا ہوگا۔'
            : 'You have entered the official voting process. You must select one candidate for every election position before leaving this page.'}
        </p>
        <button className="btn-gold w-full mt-5" onClick={onStay}>
          {rtl ? 'بیلٹ پر واپس جائیں' : 'Return to Ballot'}
        </button>
      </div>
    </div>
  );
}

function DetailModal({ t, rtl, cand, positions, onClose }) {
  const pos = positions.find(p => p.id === cand.position_id)?.title;
  const Row = ({ k, v }) => v ? <div className="flex gap-2 py-1.5 border-b border-tnr-line/60"><span className="text-tnr-cream/50 text-sm w-28">{k}</span><span className="text-tnr-cream text-sm flex-1">{v}</span></div> : null;
  return <Modal onClose={onClose}>
    <div className="text-center mb-3"><img src={cand.photo_url || '/tnr-logo.png'} className="w-24 h-24 rounded-2xl object-cover mx-auto border border-tnr-line" alt="" />
      <div className="text-xl font-bold text-tnr-goldLight mt-3">{cand.name}</div></div>
    <Row k={t.position} v={pos} /><Row k={t.symbol} v={cand.symbol} /><Row k={t.area} v={cand.union_name} />
    <Row k={t.education} v={cand.education} /><Row k={t.manifesto} v={cand.manifesto} />
    <button className="btn-ghost w-full mt-4" onClick={onClose}>{t.cancel}</button>
  </Modal>;
}
function Success({ t, rtl, receipt }) {
  return <div className="card p-8 text-center animate-pop">
    <div className="w-20 h-20 rounded-full bg-tnr-green2 grid place-items-center mx-auto mb-4 border-2 border-tnr-gold">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#E4C25B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    <h1 className={`text-2xl font-bold text-tnr-goldLight ${rtl ? 'urdu' : ''}`}>{t.successTitle}</h1>
    <div className="my-5 py-4 rounded-xl bg-black/30 border border-tnr-line">
      <div className="text-xs uppercase tracking-wider text-tnr-cream/50">{t.receipt}</div>
      <div className="text-2xl font-black tracking-widest text-tnr-gold mt-1">{receipt}</div></div>
    <a href="/" className="btn-gold w-full">{t.backHome}</a>
  </div>;
}
function ErrorState({ t, rtl, kind, msg, detail }) {
  const voted = kind === 'ALREADY_VOTED';
  return <div className="card p-8 text-center animate-pop">
    <div className={`w-20 h-20 rounded-full grid place-items-center mx-auto mb-4 border-2 ${voted ? 'bg-tnr-green2 border-tnr-gold' : 'bg-red-900/40 border-red-500/60'}`}>
      <span className="text-4xl">{voted ? '✓' : '!'}</span></div>
    <p className={`text-lg text-tnr-cream ${rtl ? 'urdu' : ''}`}>{msg}</p>
    {detail && <p className="mt-3 text-xs text-red-300/80 break-words font-mono bg-black/30 border border-red-500/20 rounded-lg px-3 py-2">{detail}</p>}
    <a href="/" className="btn-ghost w-full mt-6">{t.backHome}</a>
  </div>;
}
function Modal({ children, onClose }) {
  return <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <div className="card p-6 w-full max-w-sm animate-pop" onClick={e => e.stopPropagation()}>{children}</div>
  </div>;
}
