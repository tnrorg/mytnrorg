'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat, useLocalParticipant } from '@livekit/components-react';
import { readMeta } from './TnrTile';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D7AE4A' };

/* Meeting chat, TNR's own.
 *
 * The stock <Chat> is a flat list of "name: message" with no faces. In a
 * committee of thirty, half of whom share a family name, a photograph is how
 * you know who said something — and every TNR member already has one on their
 * membership record. The server puts it in the participant metadata when it
 * mints the token, so nothing extra is fetched here.
 *
 * useChat() is still LiveKit's: the transport, ordering and delivery
 * guarantees are theirs. Only the presentation is ours.
 */
export default function TnrChat({ onClose }) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Follow new messages. Instant on first paint, smooth afterwards, so opening
  // a busy chat does not animate through fifty messages.
  const first = useRef(true);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: first.current ? 'auto' : 'smooth' });
    first.current = false;
  }, [chatMessages.length]);

  const submit = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || isSending) return;
    setText('');
    setPicker(false);
    try { await send(body); } catch { setText(body); }   // put it back rather than lose it
  };

  const insert = (glyph) => {
    setText(t => t + glyph);
    setPicker(false);
    inputRef.current?.focus();
  };

  /* Group consecutive messages from one person, the way every messaging app
   * does — repeating the same photo and name six times for six lines of one
   * person thinking out loud is what makes a chat panel feel cheap. */
  const grouped = useMemo(() => chatMessages.map((m, i) => {
    const prev = chatMessages[i - 1];
    const sameAuthor = prev && prev.from?.identity === m.from?.identity;
    const closeInTime = prev && Math.abs(m.timestamp - prev.timestamp) < 3 * 60 * 1000;
    return { ...m, grouped: !!(sameAuthor && closeInTime) };
  }), [chatMessages]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: 'rgba(255,255,255,.10)' }}>
        <h3 className="text-[12px] font-black uppercase tracking-wider text-white/60">Chat</h3>
        <button onClick={onClose} aria-label="Close chat"
          className="rounded-md px-2 py-0.5 text-white/50 hover:bg-white/10 hover:text-white">✕</button>
      </div>

      {/* ── Messages ── */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {!grouped.length && (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <div className="text-3xl opacity-40">💬</div>
              <p className="mt-2 text-[12.5px] text-white/40">
                No messages yet. Anything typed here is visible to everyone in the meeting.
              </p>
            </div>
          </div>
        )}

        {grouped.map((m, i) => {
          const mine = m.from?.identity === localParticipant?.identity;
          const meta = readMeta(m.from);
          return (
            <Bubble key={m.id || `${m.timestamp}-${i}`} m={m} mine={mine} meta={meta} />
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Composer ── */}
      <form onSubmit={submit} className="border-t p-2.5"
        style={{ borderColor: 'rgba(255,255,255,.10)' }}>
        {picker && (
          <div className="mb-2 grid grid-cols-8 gap-0.5 rounded-xl border p-2"
            style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.12)' }}>
            {CHAT_EMOJI.map(g => (
              <button key={g} type="button" onClick={() => insert(g)}
                aria-label={`Insert ${g}`}
                className="rounded-lg py-1 text-lg transition-transform hover:scale-125">
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5 rounded-xl border px-2 py-1.5 transition-colors
          focus-within:border-[rgba(215,174,74,.55)]"
          style={{ background: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.12)' }}>
          <button type="button" onClick={() => setPicker(!picker)}
            aria-label="Emoji" aria-expanded={picker}
            className="shrink-0 rounded-lg px-1.5 py-0.5 text-lg opacity-70 hover:opacity-100">
            😀
          </button>

          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            /* Enter sends, Shift+Enter breaks the line. The opposite trips
               people up mid-meeting, when they are typing fast. */
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
            rows={1}
            placeholder="Message everyone…"
            className="max-h-24 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[13px]
              text-white outline-none placeholder:text-white/35" />

          <button type="submit" disabled={!text.trim() || isSending}
            aria-label="Send"
            className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-black transition
              disabled:opacity-30"
            style={{ background: C.gold, color: C.deep }}>
            {isSending ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ m, mine, meta }) {
  const time = new Date(m.timestamp)
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${m.grouped ? 'mt-0.5' : 'mt-3'}`}>
      {/* The photo is drawn once per group; the space is kept so the bubbles
          below still line up under it. */}
      <span className="w-7 shrink-0">
        {!m.grouped && <Face meta={meta} name={m.from?.name} />}
      </span>

      <div className={`min-w-0 max-w-[78%] ${mine ? 'items-end text-right' : ''}`}>
        {!m.grouped && (
          <div className={`mb-0.5 flex items-baseline gap-1.5 ${mine ? 'justify-end' : ''}`}>
            <span className="truncate text-[11.5px] font-bold text-white/85">
              {mine ? 'You' : (m.from?.name || 'Member')}
            </span>
            {meta.role === 'host' && (
              <span className="rounded px-1 text-[8.5px] font-black uppercase tracking-wider"
                style={{ background: 'rgba(215,174,74,.22)', color: C.gold }}>Host</span>
            )}
            <span className="text-[10px] text-white/35">{time}</span>
          </div>
        )}

        <div className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5
          text-left text-[13px] leading-relaxed ${mine ? 'text-[#05271C]' : 'text-white/90'}`}
          style={mine
            ? { background: C.gold, borderBottomRightRadius: m.grouped ? 16 : 4 }
            : { background: 'rgba(255,255,255,.09)', borderBottomLeftRadius: m.grouped ? 16 : 4 }}>
          {/* Plain text. React escapes it, so a message containing markup is
              shown as the characters someone typed rather than rendered. */}
          {m.message}
        </div>
      </div>
    </div>
  );
}

function Face({ meta, name }) {
  if (meta.photo_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={meta.photo_url} alt="" className="h-7 w-7 rounded-full object-cover"
      style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,.18)' }} />
  );
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-white"
      style={{ background: 'linear-gradient(150deg,#0F6B4E,#083527)' }}>
      {String(name || 'M').trim().charAt(0).toUpperCase()}
    </span>
  );
}

/* A deliberately small set. A full emoji keyboard in a committee meeting is
 * a distraction; these cover acknowledgement, agreement and applause, which is
 * what a chat alongside a live discussion is actually used for. */
const CHAT_EMOJI = [
  '👍', '👏', '🙏', '❤️', '😀', '😂', '🎉', '🔥',
  '✅', '❌', '🤔', '👀', '💡', '📌', '⏰', '✋',
];
