'use client';
import {
  User, Award, GraduationCap, Globe, Landmark, BookOpen, Briefcase, Newspaper, PenLine, Trophy,
  Map, MapPin, BarChart3, School, Hammer, Building2, FileText,
} from 'lucide-react';
import { TYPES, typeLabel, highlightParts } from '@/lib/search/types';

const ICONS = {
  User, Award, GraduationCap, Globe, Landmark, BookOpen, Briefcase, Newspaper, PenLine, Trophy,
  Map, MapPin, BarChart3, School, Hammer, Building2, FileText,
};

const fmt = (d) => {
  const t = Date.parse(d || '');
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

/** Tell the server a result of this CATEGORY was opened. Fire-and-forget. */
export function recordOpen(type) {
  try {
    const body = JSON.stringify({ type });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/public/search', new Blob([body], { type: 'application/json' }));
    else fetch('/api/public/search', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  } catch { /* analytics never gets in the way of a click */ }
}

/* Matching words emphasised. Each part is rendered as a text node — nothing
   from a title or snippet is ever treated as HTML. */
export function Highlight({ text, query }) {
  return highlightParts(text, query).map((p, i) => (p.hit
    ? <mark key={i} className="rounded bg-[#C9A227]/25 px-0.5 text-inherit">{p.text}</mark>
    : <span key={i}>{p.text}</span>));
}

export function ResultIcon({ result, size = 40 }) {
  const Icon = ICONS[TYPES[result.type]?.icon] || FileText;
  /* A photo only for people — and only when the server sent one, which it does
     not for a member who has chosen to keep their photo private. */
  const person = TYPES[result.type]?.tab === 'people';
  if (person && result.thumbnail) {
    return <img src={result.thumbnail} alt="" loading="lazy" width={size} height={size}
      className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-[#0B6B4F]/10 text-[#0B6B4F]"
      style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.48)} strokeWidth={1.9} />
    </span>
  );
}

/** Compact row — the navbar overlay. */
export function ResultRow({ result, query, active, id, onHover }) {
  return (
    <a id={id} href={result.url} role="option" aria-selected={active}
      onMouseEnter={onHover} onClick={() => recordOpen(result.type)}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 ${
        active ? 'bg-[#0B6B4F]/10' : 'hover:bg-gray-50'}`}>
      <ResultIcon result={result} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-gray-900">
          <Highlight text={result.title} query={query} />
        </span>
        {result.description && (
          <span className="block truncate text-[12.5px] text-gray-500">
            <Highlight text={result.description} query={query} />
          </span>
        )}
      </span>
      <span className="hidden shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-gray-500 sm:inline">
        {typeLabel(result.type)}
      </span>
    </a>
  );
}

/** Full card — the results page. */
export function ResultCard({ result, query }) {
  const m = result.meta || {};
  const region = result.type === 'uc' || result.type === 'village';
  const figure = ['statistic', 'institution', 'project', 'university'].includes(result.type);

  return (
    <a href={result.url} onClick={() => recordOpen(result.type)}
      className="group flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition
        duration-200 hover:-translate-y-0.5 hover:border-[#0B6B4F]/40 hover:shadow-md focus-visible:outline
        focus-visible:outline-2 focus-visible:outline-[#0B6B4F]">
      <ResultIcon result={result} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-[#0B6B4F]/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#0B6B4F]">
            {typeLabel(result.type)}
          </span>
          {figure && m.kind && (
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
              m.kind === 'tnr' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'}`}>
              {m.kind === 'tnr' ? 'TNR membership figure' : 'Official record'}
            </span>
          )}
          {m.status === 'closed' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-500">Closed</span>}
          {m.status === 'closing_soon' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700">Closing soon</span>}
          {result.updated_at && !figure && <span className="text-[11.5px] text-gray-400">{fmt(result.updated_at)}</span>}
        </div>

        <h3 className="mt-1 text-[16px] font-bold leading-snug text-[#063D2B] group-hover:underline">
          <Highlight text={result.title} query={query} />
        </h3>
        {result.description && (
          <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-relaxed text-gray-600">
            <Highlight text={result.description} query={query} />
          </p>
        )}

        {/* Regional detail. Two different kinds of number, never mixed: what
            TNR has counted among its own members, and what an official source
            says about the place — which TNR does not have, and says so. */}
        {region && (
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
            {m.union_council && <div><dt className="inline text-gray-400">Union Council: </dt><dd className="inline font-medium text-gray-700">{m.union_council}</dd></div>}
            <div><dt className="inline text-gray-400">TNR members: </dt>
              <dd className="inline font-medium text-gray-700">{m.tnr_members ?? 'fewer than 5'}</dd></div>
            <div><dt className="inline text-gray-400">Population (official): </dt>
              <dd className="inline font-medium text-gray-500">Data not available</dd></div>
          </dl>
        )}
        {result.type === 'uc' && m.villages?.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {m.villages.slice(0, 14).map(v => (
              <span key={v} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11.5px] text-gray-700">{v}</span>
            ))}
            {m.villages.length > 14 && <span className="text-[11.5px] text-gray-400">+{m.villages.length - 14} more</span>}
          </p>
        )}
        {figure && (m.source || m.last_verified || m.note) && (
          <p className="mt-1.5 text-[11.5px] text-gray-400">
            {m.source ? `Source: ${m.source}` : m.note}
            {m.last_verified ? ` · verified ${fmt(m.last_verified)}` : ''}
          </p>
        )}
      </div>
    </a>
  );
}
