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
          const bg = active ? COLORS.green700 : done ? COLORS.green800 : COLORS.neutral;
          const fg = active || done ? '#fff' : COLORS.muted;
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
                    style={{ background: i < current ? COLORS.green700 : COLORS.neutral }} />
                </div>
                <div className="mt-2 pr-2">
                  <div className="text-[11px] font-bold leading-tight truncate"
                    style={{ color: active ? COLORS.green900 : COLORS.muted }}>{s.title}</div>
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
