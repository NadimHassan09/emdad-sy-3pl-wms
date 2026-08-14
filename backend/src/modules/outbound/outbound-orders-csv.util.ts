/** Shared CSV helpers for outbound export/import (Excel-friendly UTF-8). */

export const OUTBOUND_IMPORT_CSV_HEADERS = [
  'external_reference',
  'company_id',
  'destination_address',
  'required_ship_date',
  'carrier',
  'client_reference',
  'notes',
  'requires_packing',
  'product_sku',
  'requested_quantity',
] as const;

export type OutboundImportCsvHeader = (typeof OUTBOUND_IMPORT_CSV_HEADERS)[number];

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
  indexByHeader: Partial<Record<OutboundImportCsvHeader, number>>;
  unknown: string[];
} {
  const indexByHeader: Partial<Record<OutboundImportCsvHeader, number>> = {};
  const unknown: string[] = [];
  const allowed = new Set<string>(OUTBOUND_IMPORT_CSV_HEADERS);
  headerRow.forEach((raw, idx) => {
    const key = normalizeHeader(raw);
    if (!key) return;
    if (allowed.has(key)) {
      indexByHeader[key as OutboundImportCsvHeader] = idx;
    } else {
      unknown.push(raw.trim());
    }
  });
  return { indexByHeader, unknown };
}

export function cell(
  cells: string[],
  indexByHeader: Partial<Record<OutboundImportCsvHeader, number>>,
  header: OutboundImportCsvHeader,
): string {
  const idx = indexByHeader[header];
  if (idx == null || idx < 0 || idx >= cells.length) return '';
  return (cells[idx] ?? '').trim();
}

export function parseRequiresPacking(raw: string): boolean | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  throw new Error(`Invalid requires_packing "${raw}" (use true/false).`);
}

export function outboundImportTemplateCsv(): string {
  const example = [
    'OUT-IMPORT-001',
    '',
    'دمشق، المزة، شارع المثال 12',
    '2026-12-31',
    '',
    '',
    'Imported via CSV template',
    'true',
    'EXAMPLE-SKU',
    '2',
  ];
  const secondLine = [
    'OUT-IMPORT-001',
    '',
    'دمشق، المزة، شارع المثال 12',
    '2026-12-31',
    '',
    '',
    '',
    'true',
    'EXAMPLE-SKU-2',
    '1',
  ];
  return rowsToCsv([...OUTBOUND_IMPORT_CSV_HEADERS], [example, secondLine]);
}
