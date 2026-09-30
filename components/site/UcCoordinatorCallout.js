'use client';
import { useEffect, useState } from 'react';
import { COLORS } from '@/lib/design/tokens';

/* "Applications are open" — the link to apply, on a public page.
 *
 * TWO RULES THIS COMPONENT FOLLOWS
 *
 * 1. IT RENDERS NOTHING WHEN NOTHING IS OPEN. Not a greyed-out box, not
 *    "applications are currently closed" — nothing at all. A governance page
 *    carrying a permanent dead "Apply now" button teaches readers that the
 *    button is decoration, and then they do not press it on the one week it
 *    works.
 *
 * 2. IT SAYS "MEMBERS ONLY" BEFORE THE CLICK, NOT AFTER. The form lives in the
 *    member portal, so a visitor who is not signed in lands on a login screen.
 *    Being told that up front reads as a rule; discovering it after clicking
 *    reads as the site being broken.
 */
export default function UcCoordinatorCallout() {
  const [d, setD] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/public/uc-coordinator')
      .then(r => r.json())
      .then(j => { if (alive && j?.ok && j.open) setD(j); })
      /* Silent on failure. This is an optional invitation on a page about
       * governance criteria — if the check cannot be made, the page is still
       * complete without it, and an error box here would be noise a reader
       * can do nothing about. */
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!d) return null;

  return (
    <aside className="mb-12 overflow-hidden rounded-2xl border"
      style={{ borderColor: 'rgba(11,107,79,.22)', background: 'linear-gradient(135deg,#F4FAF7,#FFFFFF)' }}>
      <div className="p-5 sm:p-6">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[.22em]"
          style={{ color: COLORS.gold500 }}>
          Applications open
        </div>

        <h3 className="text-[19px] font-black" style={{ color: COLORS.green900 }}>
          {d.title}
        </h3>

        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed" style={{ color: '#4A554E' }}>
          {d.summary
            || 'TNR is inviting members to serve as Coordinator for their Union Council — '
             + 'leading TNR activity, organising programmes and representing the organisation locally.'}
        </p>

        {d.closes_on && (
          <p className="mt-2 text-[13px] font-semibold" style={{ color: COLORS.green700 }}>
            Closing date: {new Date(`${d.closes_on}T00:00:00`).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href="/member/uc-coordinator"
            className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-white"
            style={{ background: COLORS.green700 }}>
            Apply now
          </a>
          {/* The eligibility rule, stated where the decision is made. */}
          <span className="text-[12.5px]" style={{ color: '#6B7280' }}>
            Open to existing TNR members — sign in to apply.{' '}
            <a href="/membership/apply" className="font-semibold underline"
              style={{ color: COLORS.green700 }}>
              Not a member yet?
            </a>
          </span>
        </div>
      </div>
    </aside>
  );
}
