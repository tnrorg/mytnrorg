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
        /* Centre the sheet in the preview window and stop it being clipped on
           a narrow screen — the sheet is 210mm wide and the popup is not. */
        display: flex;
        justify-content: center;
        padding: 16px;
        overflow: auto;
      }
      #print-root > * { background: #fff !important; }
      #print-root, #print-root * { box-shadow: none !important; }

      /* Backgrounds and accent colours are part of the design, not decoration
         the browser should helpfully strip. */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

      @media print {
        #print-root { display: block; padding: 0; overflow: visible; }
      }
      ${flowCss}
    </style></head>
    <body style="margin:0;background:#fff;background-image:none;color:#111">
      <div id="print-root" style="background:#fff">${el.outerHTML}</div>
    </body></html>`);

  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 600);
}
