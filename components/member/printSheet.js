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

  /* Flowing documents only.
     The margin moves to @page because a sheet's own padding is applied once —
     which is why page 1 had a top margin and every page after it started hard
     against the paper edge. @page margins apply to every page. */
  const flowCss = cfg.flow ? `
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
  ` : '';

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { alert('Please allow pop-ups to download or print this document.'); return; }

  w.document.write(`<!doctype html><html><head><title>${title || 'Document'}</title>${styles}
    <style>
      @page { size: ${cfg.size}; margin: ${cfg.margin}; }
      html, body { margin: 0; background: #fff; }
      #print-root, #print-root * { box-shadow: none !important; }
      /* Backgrounds and accent colours are part of the design, not decoration
         the browser should helpfully strip. */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${flowCss}
    </style></head>
    <body><div id="print-root">${el.outerHTML}</div></body></html>`);

  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 600);
}
