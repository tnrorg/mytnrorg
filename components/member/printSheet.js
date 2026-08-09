'use client';

/**
 * Opens a clean print window containing only the given sheet, so a member can
 * save a real PDF with the browser — no paid PDF service, no extra dependency,
 * and the output stays ATS-readable because it is real text.
 *
 * Four different sheets use this and they do NOT want the same page setup:
 *
 *   cv-sheet     A4 portrait, flows over several pages
 *   letter-sheet A4 portrait, usually one page
 *   cert-sheet   A4 LANDSCAPE, fixed 297×210, exactly one page
 *   card-sheet   small fixed card
 *
 * A single set of print rules cannot serve all four: the reset that lets a CV
 * flow correctly (drop the fixed height and padding, let @page own the margin)
 * would collapse the certificate's fixed landscape geometry. So the setup is
 * chosen from the element id, and callers need no changes.
 */
const SETUP = {
  'cv-sheet':     { size: 'A4 portrait',  margin: '14mm', flow: true },
  'letter-sheet': { size: 'A4 portrait',  margin: '18mm', flow: true },
  // Fixed-geometry sheets keep their own padding and size — margin 0 so the
  // browser does not add a second one on top.
  'cert-sheet':   { size: 'A4 landscape', margin: '0',    flow: false },
  'card-sheet':   { size: 'auto',         margin: '0',    flow: false },
};

export function printSheet(elementId, title) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const cfg = SETUP[elementId] || { size: 'A4 portrait', margin: '12mm', flow: false };

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(n => n.outerHTML).join('');

  /* Flowing documents only, and ONLY inside @media print.
     These rules strip the sheet's fixed width and padding so the printed page
     box owns the geometry. Applied unconditionally they also hit the popup
     window on screen, where there is no page box — the sheet then loses its
     210mm width, the text runs past the window edge and the dates get cut off.
     The margin moves to @page because a sheet's own padding is applied once:
     that is why page 1 had a top margin and every later page started hard
     against the paper edge. */
  const flowCss = cfg.flow ? `
    @media print {
      #print-root > * {
        width: auto !important;
        min-height: 0 !important;
        height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      /* Keep one job or qualification whole, but let a SECTION break across
         pages. Holding whole sections together is what pushed all of Education
         to page 2 and left the bottom of page 1 empty. */
      .cv-entry   { break-inside: avoid; page-break-inside: avoid; }
      .cv-section { break-inside: auto;  page-break-inside: auto; }
      .cv-heading { break-after: avoid;  page-break-after: avoid; }
      .cv-header  { break-after: avoid;  page-break-after: avoid; }
      /* Two lines alone at the top or bottom of a page. */
      p, li { orphans: 2; widows: 2; }
    }
  ` : '';

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { alert('Please allow pop-ups to download or print this document.'); return; }

  w.document.write(`<!doctype html><html><head><title>${title || 'Document'}</title>${styles}
    <style>
      @page { size: ${cfg.size}; margin: ${cfg.margin}; }

      /* White everywhere.
         globals.css paints <body> with a dark gradient
         (linear-gradient(180deg,#071410,#0A0F0C)) and cream text. The popup
         has to copy the site's stylesheets — the CV is built from Tailwind
         classes — so that rule arrives too. background-image is reset
         explicitly: the shorthand alone has been known to leave a gradient
         behind when a later rule only sets background-color. */
      html, body {
        margin: 0 !important;
        background: #fff !important;
        background-image: none !important;
        background-color: #fff !important;
        color: #111 !important;
        min-height: 0 !important;
      }
      #print-root {
        background: #fff !important;
        /* Fills the viewport, so no dark page shows below a short document. */
        min-height: 100vh;
        display: flex;
        /* "safe center" centres the sheet but falls back to flex-start when it
           is wider than the window. Plain centring would push the left edge
           off-screen and make it unreachable — you cannot scroll to it. */
        justify-content: safe center;
        padding: 16px;
        overflow: auto;
      }
      #print-root > * { background: #fff !important; }
      #print-root, #print-root * { box-shadow: none !important; }

      /* Backgrounds and accent colours inside the DOCUMENT are part of the
         design, not decoration the browser should helpfully strip.

         Scoped to #print-root and never applied to html/body. Applied to *, it
         also forces the site's dark body gradient into the output — which is
         exactly how a black frame ended up printed around the page. */
      #print-root, #print-root * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* And the page itself must print white regardless of what the copied
         stylesheets say. The "economy" value lets the browser drop the
         background entirely, which is what we want here. */
      @media print {
        html, body {
          background: #fff !important;
          background-image: none !important;
          -webkit-print-color-adjust: economy;
          print-color-adjust: economy;
        }
      }

      @media print {
        #print-root { display: block; padding: 0; overflow: visible; min-height: 0; }
        /* The toolbar is screen furniture; it must never reach the paper. */
        #tnr-bar { display: none !important; }
      }
      ${flowCss}
    </style></head>
    <body style="margin:0;background:#fff;background-image:none;color:#111">
      <div id="tnr-bar" style="position:sticky;top:0;z-index:99;display:flex;gap:10px;
        align-items:center;justify-content:center;padding:10px;background:#063D2B;color:#fff;
        font:500 13px system-ui,sans-serif">
        <span>Check the document below, then print or save as PDF.</span>
        <button onclick="window.print()" style="border:0;border-radius:8px;padding:7px 16px;
          background:#D4A72C;color:#063D2B;font:500 13px system-ui,sans-serif;cursor:pointer">
          Print / Save as PDF
        </button>
      </div>
      <div id="print-root" style="background:#fff">${el.outerHTML}</div>
    </body></html>`);

  w.document.close();

  /* Force white on the document itself.
   *
   * The <style> block above should already win — it is last in the head and
   * uses !important — but the site's stylesheet arrives as a <link> that
   * resolves asynchronously, and the exact cascade in a document built with
   * document.write has proved unreliable across browsers. An inline style set
   * with priority 'important' sits above every stylesheet rule, so this is the
   * one place the dark page background cannot follow us into.
   */
  const paintWhite = () => {
    try {
      for (const el of [w.document.documentElement, w.document.body]) {
        if (!el) continue;
        el.style.setProperty('background', '#ffffff', 'important');
        el.style.setProperty('background-image', 'none', 'important');
        el.style.setProperty('color', '#111111', 'important');
      }
      const root = w.document.getElementById('print-root');
      if (root) root.style.setProperty('background', '#ffffff', 'important');
    } catch { /* window closed early */ }
  };

  paintWhite();
  // Again once the copied stylesheets have finished loading, in case one of
  // them repaints the body on arrival.
  w.onload = paintWhite;
  setTimeout(paintWhite, 600);

  /* Deliberately does NOT call w.print().
   *
   * It used to fire twice — once on load and once on a timer — so the print
   * dialog opened immediately, on top of the document. Everything the reader
   * saw was Chrome's print preview: a white page on the browser's own dark
   * backdrop, which no stylesheet can change and which does not appear in the
   * saved PDF. That backdrop was repeatedly mistaken for a bug in the CV.
   *
   * The toolbar above prints on request instead, so the document is visible
   * first and the dialog is something the reader chose to open.
   */
  try { w.focus(); } catch { /* window closed early */ }
}
