'use client';
import { useRef, useState } from 'react';
import { aPost } from './adminApi';

/**
 * File picker that routes uploads two different ways depending on size.
 *
 *   Small files  → read as a base64 data URL and hand back via `data`.
 *                  The API route uploads it server-side, exactly as before.
 *   Large files  → fetch a signature, POST straight to Cloudinary from the
 *                  browser, and hand back the final `url`. Never touches our
 *                  server, so Vercel's ~4.5 MB body cap doesn't apply.
 *
 * Usage:
 *   <MediaUpload
 *     folder="candidates"
 *     accept="image/*"
 *     value={form.photo_url}
 *     onChange={({ data, url }) =>
 *       setForm(s => ({ ...s, photo_data: data, photo_url: url }))}
 *     onError={msg => toast(msg, 'err')}
 *   />
 *
 * The API routes already do `let photo_url = b.photo_url || null;` and only
 * overwrite it when `photo_data` is present — so both paths work unchanged.
 */

// Base64 inflates by ~33% and Vercel caps request bodies near 4.5 MB.
// Anything above this goes direct-to-Cloudinary instead.
const INLINE_LIMIT = 3 * 1024 * 1024; // 3 MB

export default function MediaUpload({
  folder = 'documents',
  accept = 'image/*',
  value = '',
  onChange,
  onError,
  label = 'Choose file',
  maxBytes = 100 * 1024 * 1024, // 100 MB — Cloudinary's single-request ceiling
  className = '',
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');

  const report = (msg) => (onError ? onError(msg) : console.error(msg));

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxBytes) {
      report(`That file is ${mb(file.size)} MB. The limit is ${mb(maxBytes)} MB.`);
      reset();
      return;
    }

    setName(file.name);
    setBusy(true);
    setPct(0);

    try {
      if (file.size <= INLINE_LIMIT) {
        const dataUrl = await readAsDataUrl(file);
        if (file.type.startsWith('image/')) setPreview(dataUrl);
        // url stays empty — the server fills it in after uploading `data`.
        onChange?.({ data: dataUrl, url: '', file });
      } else {
        const url = await directUpload(file, folder, setPct);
        if (file.type.startsWith('image/')) setPreview(url);
        onChange?.({ data: null, url, file });
      }
    } catch (err) {
      report(err?.message || 'Upload failed.');
      reset();
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (inputRef.current) inputRef.current.value = '';
    setName('');
    setPct(0);
  }

  function clear() {
    reset();
    setPreview('');
    onChange?.({ data: null, url: '', file: null });
  }

  const shown = preview || value;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50">
          {busy ? 'Uploading…' : label}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={pick}
            disabled={busy}
            className="hidden"
          />
        </label>

        {shown && !busy && (
          <button
            type="button"
            onClick={clear}
            className="text-sm text-red-600 hover:underline"
          >
            Remove
          </button>
        )}

        {name && !busy && <span className="truncate text-xs text-gray-500">{name}</span>}
      </div>

      {busy && pct > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-gray-200">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {shown && isImageUrl(shown) && (
        <img
          src={shown}
          alt=""
          className="h-20 w-20 rounded border border-gray-200 object-cover"
        />
      )}

      {shown && !isImageUrl(shown) && (
        <a
          href={shown}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          View uploaded file
        </a>
      )}
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function isImageUrl(u) {
  if (!u) return false;
  if (u.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u) || /\/image\/upload\//.test(u);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(rd.result);
    rd.onerror = () => reject(new Error('Could not read that file.'));
    rd.readAsDataURL(file);
  });
}

/** Signed browser → Cloudinary upload. Reports progress via XHR. */
async function directUpload(file, folder, setPct) {
  const sig = await aPost('/api/admin/upload-signature', { folder });
  if (!sig?.ok) {
    throw new Error(sig?.message || 'Could not authorise the upload.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.uploadUrl);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error('Cloudinary returned an unreadable response.'));
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        return resolve(body.secure_url);
      }
      reject(new Error(body?.error?.message || `Upload failed (${xhr.status}).`));
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(form);
  });
}
