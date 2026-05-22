import type { ReportColumnDef, ReportRow } from './types';

/**
 * Export report rows to CSV with UTF-8 BOM for Excel Arabic compatibility.
 */
export function exportReportCsv(
  columns: ReportColumnDef[],
  rows: ReportRow[],
  fileName: string,
  isArabic: boolean,
): void {
  const headers = columns.map((c) => (isArabic ? c.headerAr : c.header));
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsvCell(c.csv(row))).join(',')),
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  const s = value ?? '';
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Download arbitrary tabular data as CSV (UTF-8 BOM for Excel). */
export function downloadCsv(headers: string[], rows: string[][], fileName: string): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(',')),
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
