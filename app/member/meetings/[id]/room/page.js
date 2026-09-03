'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import dynamicImport from 'next/dynamic';
import { mGet, mPost } from '@/components/member/memberApi';

/* The meeting room.
 *
 * LOADED ONLY IN THE BROWSER, and only once a token has been issued. The
 * LiveKit SDK is a large bundle that reaches for getUserMedia and WebRTC APIs
 * that do not exist during server rendering, so it is imported dynamically
 * with ssr:false — and, because the import lives behind the connection state,
 * a member who is refused, waiting, or hitting an unconfigured provider never
 * downloads it at all.
 */
const MeetingRoom = dynamicImport(() => import('@/components/meetings/MeetingRoom'), {
  ssr: false,
  loading: () => <Splash title="Connecting…" body="Setting up your camera and microphone." />,
});

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D7AE4A' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function RoomPage(props) {
  const params = use(props.params);
  const id = params.id;

  const [state, setState] = useState('loading');   // loading|waiting|ready|error|password
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const pollRef = useRef(null);

  const connect = useCallback(async (pw) => {
    const r = await mPost('/api/member/meetings/token', {
      meeting_id: id, ...(pw ? { password: pw } : {}),
    });

    if (r?.ok && r.token) { setData(r); setState('ready'); return; }
    if (r?.ok && r.waiting) { setState('waiting'); return; }

    if (r?.error === 'PASSWORD_REQUIRED' || r?.error === 'PASSWORD_WRONG') {
      setError(r.error === 'PASSWORD_WRONG' ? r.message : null);
      setState('password');
      return;
    }
    setError({ code: r?.error, message: r?.message || 'Could not join this meeting.' });
    setState('error');
  }, [id]);

  useEffect(() => { connect(); }, [connect]);

  /* While held in the waiting room, ask every four seconds whether the host
   * has admitted us. Polling rather than a socket: this is the one screen in
   * the app where a stale answer means someone sits staring at a door that is
   * already open, and four seconds of polling for a few minutes is a cost
   * worth paying to avoid that. */
  useEffect(() => {
    if (state !== 'waiting') return;
    pollRef.current = setInterval(async () => {
      const r = await mGet(`/api/member/meetings/room?meeting_id=${id}`);
      if (r?.ok && r.my_admission === 'admitted') connect();
      if (r?.ok && (r.my_admission === 'rejected' || r.my_admission === 'removed')) {
        setError({ code: 'REJECTED', message: 'The host did not admit you to this meeting.' });
        setState('error');
      }
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [state, id, connect]);

  if (state === 'loading') return <Splash title="Joining…" body="Checking your invitation." />;

  if (state === 'waiting') return (
    <Splash title="Waiting for the host"
      body="Your request has been sent. You will join automatically once the host admits you."
      spinner
      action={{ label: 'Leave', href: `/member/meetings/${id}` }} />
  );

  if (state === 'password') return (
    <Splash title="This meeting has a passcode"
      body="Enter the passcode the host gave you."
      error={error}>
      <form onSubmit={(e) => { e.preventDefault(); setState('loading'); connect(password); }}
        className="mt-5 flex w-full max-w-xs flex-col gap-2">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoFocus placeholder="Passcode"
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-center text-white
            outline-none placeholder:text-white/40 focus:border-white/50" />
        <button type="submit" disabled={!password.trim()}
          className="rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-40"
          style={{ background: C.gold, color: C.deep }}>
          Join meeting
        </button>
      </form>
    </Splash>
  );

  if (state === 'error') return <ErrorScreen id={id} error={error} onRetry={() => { setState('loading'); connect(); }} />;

  return <MeetingRoom id={id} data={data} />;
}

/* Full-screen states, in TNR green rather than the provider's own dark theme.
 * A member should not be able to tell where our product ends and LiveKit
 * begins. */
function Splash({ title, body, spinner, action, error, children }) {
  return (
    <main style={{ ...mont, background: `linear-gradient(150deg, ${C.green}, ${C.deep})` }}
      className="grid min-h-screen place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        {spinner && (
          <span className="mb-5 h-8 w-8 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
        )}
        <h1 className="text-2xl font-black text-white">{title}</h1>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/70">{body}</p>
        {error && <p className="mt-3 text-[13px] font-semibold text-red-300">{error.message || error}</p>}
        {children}
        {action && (
          <a href={action.href}
            className="mt-6 rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white
              transition-colors hover:bg-white/10">
            {action.label}
          </a>
        )}
      </div>
    </main>
  );
}

/* Every failure gets its own words.
 *
 * Section 26 of the brief asks for this and it is worth the lines: "Unable to
 * connect" sends a member to the help desk, whereas "the host has not started
 * it yet" sends them back to wait. The video-not-configured case is called out
 * separately because it is an ADMINISTRATOR's problem, not the member's, and
 * saying so is what gets it fixed.
 */
const MESSAGES = {
  VIDEO_NOT_CONFIGURED: {
    title: 'Video is not set up yet',
    body: 'Your invitation is valid and everything else is working — the meeting '
      + 'provider has not been connected. An administrator needs to add the '
      + 'LiveKit credentials to the site settings.',
  },
  NOT_JOINABLE: { title: 'Not open yet' },
  TOO_EARLY: { title: 'Too early' },
  REMOVED: { title: 'Removed from this meeting' },
  REJECTED: { title: 'Not admitted' },
  NOT_FOUND: {
    title: 'Meeting not found',
    body: 'This meeting does not exist, or you are not on its invitation list.',
  },
  UNAUTHORIZED: { title: 'Please sign in', body: 'Your session has expired.' },
};

function ErrorScreen({ id, error, onRetry }) {
  const m = MESSAGES[error?.code] || {};
  const retryable = !['NOT_FOUND', 'REMOVED', 'REJECTED'].includes(error?.code);

  return (
    <main style={{ ...mont, background: `linear-gradient(150deg, ${C.green}, ${C.deep})` }}
      className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-black text-white">{m.title || 'Unable to join'}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/75">
          {m.body || error?.message || 'Something went wrong connecting to this meeting.'}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {retryable && (
            <button onClick={onRetry}
              className="rounded-xl px-5 py-2.5 text-sm font-black"
              style={{ background: C.gold, color: C.deep }}>
              Try again
            </button>
          )}
          <a href={`/member/meetings/${id}`}
            className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white
              transition-colors hover:bg-white/10">
            Meeting details
          </a>
        </div>
      </div>
    </main>
  );
}
