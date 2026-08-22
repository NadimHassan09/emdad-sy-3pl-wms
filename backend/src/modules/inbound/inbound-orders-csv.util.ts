/** Shared CSV helpers for inbound export/import (Excel-friendly UTF-8). */

export const INBOUND_IMPORT_CSV_HEADERS = [
  'external_reference',
  'company_id',
  'expected_arrival_date',
  'client_reference',
  'notes',
  'source_type',
  'store_channel',
  'product_sku',
  'expected_quantity',
  'expected_lot_number',
  'expected_expiry_date',
] as const;

export type InboundImportCsvHeader = (typeof INBOUND_IMPORT_CSV_HEADERS)[number];

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map((h) => csvEscape(h)).join(',')];
  for (const row of rows) {
    lines.push(row.map((v) => csvEscape(v == null ? '' : String(v))).join(','));
  }
  // BOM helps Excel open Arabic/Unicode correctly.
  return `\uFEFF${lines.join('\n')}`;
}

/** Minimal RFC4180-ish parser (quoted fields, commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[\s-]+/g, '_');
}

export function mapCsvHeaderRow(headerRow: string[]): {
  indexByHeader: Partial<Record<InboundImportCsvHeader, number>>;
  unknown: string[];
} {
  const indexByHeader: Partial<Record<InboundImportCsvHeader, number>> = {};
  const unknown: string[] = [];
  const allowed = new Set<string>(INBOUND_IMPORT_CSV_HEADERS);
  headerRow.forEach((raw, idx) => {
    const key = normalizeHeader(raw);
    if (!key) return;
    if (allowed.has(key)) {
      indexByHeader[key as InboundImportCsvHeader] = idx;
    } else {
      unknown.push(raw.trim());
    }
  });
  return { indexByHeader, unknown };
}

export function cell(
  cells: string[],
  indexByHeader: Partial<Record<InboundImportCsvHeader, number>>,
  header: InboundImportCsvHeader,
): string {
  const idx = indexByHeader[header];
  if (idx == null || idx < 0 || idx >= cells.length) return '';
  return (cells[idx] ?? '').trim();
}

export function inboundImportTemplateCsv(): string {
  const example = [
    'INB-IMPORT-001',
    '',
    '2026-12-31',
    '',
    'Imported via CSV template',
    'purchase',
    'csv_import',
    'EXAMPLE-SKU',
    '10',
    '',
    '',
  ];
  const secondLine = [
    'INB-IMPORT-001',
    '',
    '2026-12-31',
    '',
    '',
    'purchase',
    'csv_import',
    'EXAMPLE-SKU-2',
    '5',
    '',
    '',
  ];
  return rowsToCsv([...INBOUND_IMPORT_CSV_HEADERS], [example, secondLine]);
}
