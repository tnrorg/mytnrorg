'use client';
export async function exportResultsPdf(results, orgName = 'TNR') {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text(`${orgName} — Election Results`, 14, 18);
  doc.setFontSize(10); doc.text(results.election?.title || '', 14, 25);
  let y = 32;
  (results.positions || []).forEach(p => {
    doc.setFontSize(12); doc.text(p.position, 14, y); y += 2;
    autoTable(doc, { startY: y + 2, head: [['Candidate', 'Symbol', 'Union', 'Votes', '%']],
      body: p.candidates.map(c => [c.name, c.symbol || '-', c.union_name || '-', c.votes, c.percent + '%']),
      styles: { fontSize: 9 }, headStyles: { fillColor: [11, 61, 46] }, margin: { left: 14, right: 14 } });
    y = doc.lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 20; }
  });
  doc.save('tnr-results.pdf');
}
export async function exportExcel(rows, sheet = 'Sheet1', filename = 'tnr-export.xlsx') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
}
export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const Papa = (await import('papaparse')).default;
    return new Promise((resolve) => { Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => resolve(r.data) }); });
  }
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
}
