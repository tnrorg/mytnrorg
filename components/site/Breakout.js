'use client';

/* Escape a reading-width column.
 *
 * DocPage is a PROSE container — max-w-4xl, 896px — which is the right
 * measure for governance text and far too narrow for a card grid. Measured on
 * the live Advisory Council page at a 1440px viewport, it left each card 199px
 * wide with 103px for the name, so every name wrapped and the glass plate
 * swallowed the portrait.
 *
 * Widening DocPage itself would wreck the line length of every governance
 * document on the site, so a roster breaks out instead: centre on the
 * viewport, take the page's own width up to 1400px, and leave the prose
 * around it exactly as it was.
 *
 * `margin-left: 50%` then `translateX(-50%)` centres the block against the
 * viewport regardless of how narrow the parent is — it does not need to know
 * what the parent's width or padding are, which is why it survives DocPage
 * changing either.
 *
 * Extracted here because three pages now need it. The first copy was written
 * inline on the Advisory Council page; a second and third would have been the
 * point where one of them quietly got a different max width.
 */
export default function Breakout({ children, className = '' }) {
  return (
    <div className={`mx-auto w-[min(1400px,100vw-2.5rem)]
      [margin-left:50%] [transform:translateX(-50%)] ${className}`}>
      {children}
    </div>
  );
}
