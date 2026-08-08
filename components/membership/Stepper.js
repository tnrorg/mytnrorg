'use client';
import { Check } from 'lucide-react';
import { COLORS, FONT } from '@/lib/design/tokens';

/** Progress indicator for the application. Completed steps are clickable so
 *  an applicant can go back and correct an answer; steps ahead stay locked
 *  until the current one validates. State is shown by icon as well as colour,
 *  since colour alone must not carry meaning. */
export default function Stepper({ steps, current, isComplete, onJump }) {
  return (
    <nav aria-label="Application progress" style={FONT}>
      <ol className="flex items-start gap-1 sm:gap-2">
        {steps.map((s, i) => {
          const done = i < current && isComplete(s.key);
          const active = i === current;
          const reachable = i <= current || done;

          // On the deep-green panel the circles read as: gold = where you are,
          // solid cream = already done, outlined = still ahead. Three distinct
          // fills, so the current step is unmistakable at a glance.
          const bg = active ? COLORS.gold500 : done ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.10)';
          const fg = active ? COLORS.green950 : done ? COLORS.green900 : 'rgba(255,255,255,.55)';
          return (
            <li key={s.key} className="flex-1 min-w-0">
              <button type="button" disabled={!reachable} onClick={() => reachable && onJump(i)}
                aria-current={active ? 'step' : undefined}
                className={`w-full text-left group ${reachable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="flex items-center gap-2">
                  <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full text-[12px] font-bold
                    transition-colors duration-standard"
                    style={{ background: bg, color: fg }}>
                    {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="hidden sm:block h-[2px] flex-1 rounded"
                    style={{ background: i < current ? COLORS.gold500 : 'rgba(255,255,255,.14)' }} />
                </div>
                <div className="mt-2 pr-2">
                  <div className="text-[11px] font-bold leading-tight truncate"
                    style={{ color: active ? COLORS.gold400 : done ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.5)' }}>
                    {s.title}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Step {current + 1} of {steps.length}: {steps[current]?.title}
      </p>
    </nav>
  );
}
