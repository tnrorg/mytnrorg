'use client';
import { fmtDateTime, fmtDuration, typeLabel } from '@/lib/meetings';

/* Attendance out of the browser.
 *
 * CSV is the deliverable the brief asks for and the one a secretary actually
 * uses — it opens in Excel, sorts, and pastes into a report. PDF is the
 * signed-off version: a sheet the chair can attach to the minutes.
 *
 * BOTH NAME THE RULE THEY USED. An attendance percentage with no stated
 * denominator is an argument waiting to happen — "74%" means nothing until you
 * know it was measured against the 75 minutes the meeting actually ran, not
 * the 60 it was scheduled for.
 */

const RULE = (summary) =>
  `Percentages are of the ${Math.round((summary?.run_seconds || 0) / 60)} minutes the meeting actually ran. `
  + 'Present = 75% or more. Partial = attended but under 75%. Absent = never connected. '
  + 'Late = full attendance but joined more than 10 minutes after the start.';

function rows(list) {
  return list.map((r, i) => ({
    '#': i + 1,
    'Membership ID': r.member?.membership_id || '',
    'Name': r.member?.full_name || '',
    'Role': r.role === 'co_host' ? 'Co-host' : r.role === 'host' ? 'Host' : 'Participant',
    'Invitation': r.invite_status || '',
    'First Joined': r.first_joined_at ? fmtDateTime(r.first_joined_at) : '',
    'Last Left': r.last_left_at ? fmtDateTime(r.last_left_at) : '',
    'Total Duration': r.total_duration_seconds ? fmtDuration(r.total_duration_seconds) : '',
    'Total Minutes': Math.round((r.total_duration_seconds || 0) / 60),
    'Sessions': r.session_count || 0,
    'Attendance %': r.attendance_percentage ?? 0,
    'Status': cap(r.attendance_status || 'absent'),
  }));
}

/** CSV — the one a secretary opens in Excel. */
export function exportAttendanceCsv(meeting, list, summary) {
  const data = rows(list);
  if (!data.length) return false;

  const headers = Object.keys(data[0]);
  const lines = [
    [`TNR Meeting Attendance`],
    [meeting.title],
    [`${typeLabel(meeting.meeting_type)} · ${fmtDateTime(meeting.scheduled_at)}`],
    [`Invited ${summary.invited} · Attended ${summary.attended} · Average ${summary.average_percentage}%`],
    [RULE(summary)],
    [`Generated ${new Date().toLocaleString()}`],
    [],
    headers,
    ...data.map(r => headers.map(h => r[h])),
  ];

  const csv = lines.map(cols => cols.map(esc).join(',')).join('\r\n');

  /* A BOM, deliberately.
   *
   * Excel on Windows reads a UTF-8 CSV as the local code page unless the file
   * starts with one — which turns every name carrying an apostrophe or a
   * non-Latin character into mojibake. This is a Pakistani membership roll;
   * that is most of the list. */
  download(`﻿${csv}`, 'text/csv;charset=utf-8', `${safe(meeting.title)}-attendance.csv`);
  return true;
}

/** PDF — the sheet that goes with the minutes. */
export async function exportAttendancePdf(meeting, list, summary) {
  const data = rows(list);
  if (!data.length) return false;

  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const GREEN = [6, 61, 43];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255); doc.setFontSize(15);
  doc.text('Meeting Attendance', 12, 12);
  doc.setFontSize(10);
  doc.text(meeting.title, 12, 20);

  doc.setTextColor(70); doc.setFontSize(8);
  doc.text(`${typeLabel(meeting.meeting_type)} · ${fmtDateTime(meeting.scheduled_at)}`, 12, 32);
  doc.text(
    `Invited ${summary.invited}  ·  Attended ${summary.attended}  ·  Present ${summary.present}  ·  `
    + `Partial ${summary.partial}  ·  Absent ${summary.absent}  ·  Average ${summary.average_percentage}%`,
    12, 36.5);

  doc.setTextColor(120); doc.setFontSize(7);
  doc.text(doc.splitTextToSize(RULE(summary), W - 24), 12, 41);

  autoTable(doc, {
    startY: 50,
    head: [['#', 'Membership ID', 'Name', 'Role', 'First Joined', 'Last Left', 'Duration', 'Sessions', '%', 'Status']],
    body: data.map(r => [
      r['#'], r['Membership ID'] || '—', r.Name || '—', r.Role,
      r['First Joined'] || '—', r['Last Left'] || '—',
      r['Total Duration'] || '—', r.Sessions, `${r['Attendance %']}%`, r.Status,
    ]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: GREEN, fontSize: 8 },
    alternateRowStyles: { fillColor: [246, 249, 247] },
    // Absent rows tinted, so a chair scanning the sheet finds the gaps first.
    didParseCell: (d) => {
      if (d.section === 'body' && d.row.raw[9] === 'Absent') d.cell.styles.textColor = [159, 18, 57];
    },
    margin: { left: 10, right: 10 },
  });

  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`Page ${p} of ${pages} · generated ${new Date().toLocaleString()}`,
      W - 10, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  doc.save(`${safe(meeting.title)}-attendance.pdf`);
  return true;
}

/* A CSV cell that survives Excel.
 *
 * Quoted whenever it holds a comma, a quote or a newline — and a leading =, +,
 * - or @ is prefixed with a single quote, because Excel treats those as
 * formulas. A member whose name or notes begin with one of them would
 * otherwise execute as a spreadsheet formula on open. */
function esc(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const safe = (s) => String(s || 'meeting').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'meeting';
