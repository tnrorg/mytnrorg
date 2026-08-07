'use client';
// Opens a clean print window containing only the CV/letter sheet, so the
// member can save a real PDF with the browser (no paid PDF dependency).
export function printSheet(elementId, title) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(n => n.outerHTML).join('');
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { alert('Please allow pop-ups to download or print this document.'); return; }
  w.document.write(`<!doctype html><html><head><title>${title || 'Document'}</title>${styles}
    <style>@page{size:A4;margin:0}body{margin:0;background:#fff}
    #print-root{box-shadow:none!important}</style></head>
    <body><div id="print-root">${el.outerHTML}</div></body></html>`);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 600);
}
