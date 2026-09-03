'use client';
import { FELLOWSHIP_QUESTIONS, APP_STATUS_LABEL } from '@/lib/opportunities';

/* Exporting applications for offline review.
 *
 * TWO FORMATS, TWO DIFFERENT JOBS — and that is why they are not the same
 * table twice:
 *
 *   Excel is the DATA. One row per applicant, every field, nothing merged or
 *   prettied. It is meant to be sorted, filtered and counted, so a reviewer
 *   can rank by CGPA or pull everyone on mobile-data-only.
 *
 *   PDF is the DOCUMENT. A summary sheet to carry into the room, then one
 *   full block per applicant — the same fields the on-screen dialog shows,
 *   laid out to be read on paper. Twenty-two columns squeezed onto a landscape
 *   page would be unreadable and would defeat the point of printing it.
 *
 * BOTH CARRY PERSONAL DATA — mobile numbers, email addresses, dates of birth.
 * Once a file leaves the admin panel no permission check follows it, so each
 * one is stamped with who generated it and when, and says plainly that it is
 * confidential. That does not stop anyone forwarding it, but it removes the
 * excuse that they did not know.
 */

const CONFIDENTIAL =
  'CONFIDENTIAL — contains member contact details. Do not forward outside the review panel.';

/** dd Mon yyyy, or an empty string. Never "Invalid Date" in a printed table. */
function d(v) {
  if (!v) return '';
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return String(v);
  return t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** How they found TNR, with the referring member or free text folded in. */
function heardAbout(m) {
  const base = String(m?.heard_about || '').trim();
  if (!base) return 'Not recorded';
  const detail = String(m?.heard_about_detail || '').trim();
  return detail ? `${base} — ${detail}` : base;
}

function interviewOf(a) {
  const i = a?.interview;
  if (!i?.date) return '';
  return [d(i.date), i.time, i.mode, i.venue].filter(Boolean).join(' · ');
}

/* The answer keys, taken from the question list rather than hard-coded.
 * When the next opportunity asks different questions, the export follows
 * automatically instead of silently dropping the new ones. */
function answerColumns() {
  return FELLOWSHIP_QUESTIONS.map(q => ({ key: q.key, label: q.label, otherKey: q.otherKey }));
}

function answerValue(a, q) {
  const v = a?.answers?.[q.key];
  const other = q.otherKey ? a?.answers?.[q.otherKey] : '';
  if (!v) return '';
  return other ? `${v} — ${other}` : String(v);
}

/** Every field, flat, one object per applicant. Shared by both formats. */
function flatten(rows) {
  const qs = answerColumns();
  return rows.map((a, i) => {
    const m = a.member || {};
    const out = {
      '#': i + 1,
      'Membership ID': m.membership_id || '',
      'Name': m.full_name || '',
      'Mobile': m.mobile || '',
      'Email': m.email || '',
      'Gender': m.gender || '',
      'Date of Birth': d(m.date_of_birth),
      'Qualification': m.education_level || '',
      'Profession': m.profession || m.field_of_study || '',
      'Current Position': m.current_position || '',
      'Village': m.village || '',
      'Union Council': m.union_council || '',
    };
    for (const q of qs) out[q.label] = answerValue(a, q);
    // Anything the applicant had to type because their profile lacked it.
    for (const [k, v] of Object.entries(a.profile_gaps || {})) out[`${k} (supplied)`] = v;
    out['Heard About TNR'] = heardAbout(m);
    out['Status'] = APP_STATUS_LABEL[a.status] || a.status || '';
    out['Applied On'] = d(a.submitted_at);
    out['Interview'] = interviewOf(a);
    return out;
  });
}

/** Excel — every field, one row each. */
export async function exportApplicationsExcel(rows, opportunityTitle = 'Opportunity') {
  const XLSX = await import('xlsx');
  const data = flatten(rows);
  if (!data.length) return false;

  const ws = XLSX.utils.json_to_sheet(data);

  /* Column widths from the actual content.
   *
   * json_to_sheet leaves every column at the default width, so an email
   * address and a membership ID get the same eight characters and the sheet
   * opens as a wall of ####. Measuring the longest value per column is a few
   * lines and is the difference between a file someone uses and one they
   * spend five minutes dragging column borders in. Capped at 42 so one long
   * free-text answer cannot push everything else off the screen. */
  const headers = Object.keys(data[0]);
  ws['!cols'] = headers.map(h => ({
    wch: Math.min(42, Math.max(h.length + 2,
      ...data.map(r => String(r[h] ?? '').length + 2))),
  }));
  // No frozen header row: the community SheetJS writer accepts `!freeze` and
  // then emits no <pane> element, so setting it would only look like the
  // feature was there. Verified against the installed build.

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Applications');

  // A second sheet rather than rows above the data: a note sitting on top of
  // the table would break sorting and filtering, which is the whole reason
  // the file is a spreadsheet.
  const notes = XLSX.utils.aoa_to_sheet([
    ['Opportunity', opportunityTitle],
    ['Applicants', data.length],
    ['Generated', new Date().toLocaleString()],
    [],
    [CONFIDENTIAL],
  ]);
  notes['!cols'] = [{ wch: 16 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, notes, 'About');

  XLSX.writeFile(wb, `${safeName(opportunityTitle)}-applications.xlsx`);
  return true;
}

/** PDF — a summary sheet, then a full block per applicant. */
export async function exportApplicationsPdf(rows, opportunityTitle = 'Opportunity') {
  if (!rows.length) return false;
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const GREEN = [6, 61, 43];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // ── Cover / summary ──
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255); doc.setFontSize(15);
  doc.text('Applications for Review', 12, 12);
  doc.setFontSize(10);
  doc.text(opportunityTitle, 12, 20);
  doc.setTextColor(90); doc.setFontSize(8);
  doc.text(`${rows.length} applicant(s) · generated ${new Date().toLocaleString()}`, 12, 32);
  doc.setTextColor(150, 30, 30);
  doc.text(CONFIDENTIAL, 12, 37);

  /* The summary carries the identifiers a reviewer reads out loud — the
   * membership ID and the mobile number — because the usual reason to print
   * this is to call people. */
  autoTable(doc, {
    startY: 42,
    head: [['#', 'Membership ID', 'Name', 'Mobile', 'Qualification', 'Semester', 'CGPA', 'Profession', 'Status']],
    body: rows.map((a, i) => {
      const m = a.member || {};
      return [
        i + 1, m.membership_id || '—', m.full_name || '—', m.mobile || '—',
        m.education_level || '—', a.answers?.semester || '—', a.answers?.cgpa || '—',
        m.profession || m.field_of_study || '—', APP_STATUS_LABEL[a.status] || a.status,
      ];
    }),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: GREEN, fontSize: 8 },
    alternateRowStyles: { fillColor: [246, 249, 247] },
    margin: { left: 10, right: 10 },
  });

  // ── One block per applicant ──
  const qs = answerColumns();
  rows.forEach((a, i) => {
    const m = a.member || {};
    doc.addPage();

    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255); doc.setFontSize(12);
    doc.text(`${i + 1}. ${m.full_name || 'Applicant'}`, 12, 9);
    doc.setFontSize(9);
    doc.text(`${m.membership_id || '—'} · ${APP_STATUS_LABEL[a.status] || a.status}`, 12, 15);

    const body = [
      ['Mobile', m.mobile || '—'],
      ['Email', m.email || '—'],
      ['Gender', m.gender || '—'],
      ['Date of birth', d(m.date_of_birth) || '—'],
      ['Qualification', m.education_level || '—'],
      ['Profession', m.profession || m.field_of_study || '—'],
      ['Village', m.village || '—'],
      ['Union Council', m.union_council || '—'],
      ...qs.map(q => [q.label, answerValue(a, q) || '—']),
      ...Object.entries(a.profile_gaps || {}).map(([k, v]) => [`${k} (supplied)`, v]),
      ['Heard about TNR', heardAbout(m)],
      ['Applied on', d(a.submitted_at) || '—'],
      ...(interviewOf(a) ? [['Interview', interviewOf(a)]] : []),
    ];

    autoTable(doc, {
      startY: 24,
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      // The label column is fixed so every applicant's block lines up when the
      // pages are flicked through side by side.
      columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold', textColor: 60 } },
      margin: { left: 10, right: 10 },
    });
  });

  // Page numbers last, once the total is known.
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Page ${p} of ${pages}`, W - 10, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  doc.save(`${safeName(opportunityTitle)}-applications.pdf`);
  return true;
}

/** A filename that survives Windows, macOS and email attachments. */
function safeName(s) {
  return String(s || 'opportunity').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'opportunity';
}
