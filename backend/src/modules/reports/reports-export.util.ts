export type ReportExportColumn = {
  id: string;
  header: string;
};

export type ReportExportRow = Record<string, string | number | boolean | null | undefined>;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function reportRowsToCsv(columns: ReportExportColumn[], rows: ReportExportRow[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(String(row[c.id] ?? ''))).join(','))
    .join('\n');
  return `\uFEFF${header}\n${body}`;
}

export function reportRowsToXls(columns: ReportExportColumn[], rows: ReportExportRow[]): string {
  const headerRow = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(String(row[c.id] ?? ''))}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}
