'use client';
import { useEffect, useState } from 'react';
import { Link2, Check, Share2 } from 'lucide-react';

/* Share an article.
 *
 * The named buttons — WhatsApp, Facebook, X, LinkedIn — are plain links to
 * each platform's own share URL. No third-party script is loaded: the official
 * share widgets track every visitor who merely sees them, which would put a
 * tracker on a page carrying members' names, and cost the PageSpeed work.
 *
 * "More" appears only where the browser actually supports the native share
 * sheet. That is what covers "any other platform" — Telegram, Instagram,
 * email, whatever the reader has installed — without this file needing to know
 * about any of them.
 */

const NETWORKS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    // Listed first deliberately: it is how this community actually shares.
    href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t}\n\n${u}`)}`,
    className: 'hover:border-[#25D366] hover:text-[#128C7E]',
    icon: (
      <path d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.46 1.33 4.97L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01a9.9 9.9 0 0 0 9.9-9.9A9.9 9.9 0 0 0 12.04 2Zm5.8 14.05c-.24.68-1.4 1.3-1.95 1.34-.5.04-.98.22-3.3-.69-2.77-1.09-4.53-3.92-4.67-4.1-.13-.19-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27a1 1 0 0 1 .72-.34h.52c.17 0 .39-.06.6.46.24.58.81 2 .88 2.14.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.14-.3.3-.13.59.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.3 2.35 1.45.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.39-.24.66-.14.27.09 1.7.8 1.99.95.29.14.48.22.55.34.07.12.07.68-.17 1.36Z" />
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    className: 'hover:border-[#1877F2] hover:text-[#1877F2]',
    icon: (
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    ),
  },
  {
    key: 'x',
    label: 'X',
    href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    className: 'hover:border-black hover:text-black',
    icon: (
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.66l7.73-8.84L1.24 2.25H8.07l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64Z" />
    ),
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
    className: 'hover:border-[#0A66C2] hover:text-[#0A66C2]',
    icon: (
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
    ),
  },
];

export default function ShareButtons({ title = '', summary = '', label = 'Share this' }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Read on the client. The server has no idea which URL the reader is on, and
  // guessing it from the slug would break the moment a page moves.
  useEffect(() => {
    setUrl(window.location.href);
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access is refused outside a secure context and in some
      // in-app browsers. Selecting the text is the honest fallback.
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: summary || title, url });
    } catch {
      // Cancelling the sheet throws. That is not an error worth reporting.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mr-0.5">
        {label}
      </span>

      {NETWORKS.map(n => (
        <a key={n.key}
          href={url ? n.href(url, title) : '#'}
          target="_blank" rel="noopener noreferrer"
          aria-label={`Share on ${n.label}`} title={`Share on ${n.label}`}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200
            text-gray-500 transition-colors duration-micro ${n.className}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {n.icon}
          </svg>
        </a>
      ))}

      <button onClick={copy} aria-label="Copy link" title="Copy link"
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors duration-micro
          ${copied ? 'border-[#176B49] text-[#176B49] bg-[rgba(23,107,73,.08)]'
                   : 'border-gray-200 text-gray-500 hover:border-[rgba(23,107,73,.35)] hover:text-[#176B49]'}`}>
        {copied ? <Check size={16} strokeWidth={2.5} /> : <Link2 size={16} strokeWidth={2.2} />}
      </button>

      {/* Only where the browser has a share sheet — on desktop this button
          would do nothing, and a dead control is worse than no control. */}
      {canNativeShare && (
        <button onClick={nativeShare} aria-label="Share to another app" title="More"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200
            text-gray-500 hover:border-[rgba(23,107,73,.35)] hover:text-[#176B49] transition-colors duration-micro">
          <Share2 size={16} strokeWidth={2.2} />
        </button>
      )}

      {copied && <span className="text-[12px] text-[#176B49] font-semibold">Link copied</span>}
    </div>
  );
}
