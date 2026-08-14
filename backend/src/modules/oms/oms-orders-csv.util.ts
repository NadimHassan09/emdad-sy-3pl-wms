/** Shared CSV helpers for OMS export/import (Excel-friendly UTF-8). */

export const OMS_IMPORT_CSV_HEADERS = [
  'external_reference',
  'company_id',
  'required_ship_date',
  'recipient_name',
  'recipient_phone',
  'city',
  'district',
  'address_line1',
  'address_line2',
  'delivery_instructions',
  'payment_method',
  'currency',
  'cod_amount',
  'shipping_fee',
  'store_channel',
  'client_reference',
  'notes',
  'product_sku',
  'quantity',
  'unit_price',
] as const;

export type OmsImportCsvHeader = (typeof OMS_IMPORT_CSV_HEADERS)[number];

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
  indexByHeader: Partial<Record<OmsImportCsvHeader, number>>;
  unknown: string[];
} {
  const indexByHeader: Partial<Record<OmsImportCsvHeader, number>> = {};
  const unknown: string[] = [];
  const allowed = new Set<string>(OMS_IMPORT_CSV_HEADERS);
  headerRow.forEach((raw, idx) => {
    const key = normalizeHeader(raw);
    if (!key) return;
    if (allowed.has(key)) {
      indexByHeader[key as OmsImportCsvHeader] = idx;
    } else {
      unknown.push(raw.trim());
    }
  });
  return { indexByHeader, unknown };
}

export function cell(
  cells: string[],
  indexByHeader: Partial<Record<OmsImportCsvHeader, number>>,
  header: OmsImportCsvHeader,
): string {
  const idx = indexByHeader[header];
  if (idx == null || idx < 0 || idx >= cells.length) return '';
  return (cells[idx] ?? '').trim();
}

export function omsImportTemplateCsv(): string {
  const example = [
    'ORD-IMPORT-001',
    '',
    '2026-12-31',
    'Example Customer',
    '0944123456',
    'دمشق',
    'المزة',
    'شارع المثال 12',
    '',
    'Leave at door',
    'COD',
    'USD',
    '25',
    '0',
    'csv_import',
    '',
    'Imported via CSV template',
    'EXAMPLE-SKU',
    '2',
    '12.5',
  ];
  const secondLine = [
    'ORD-IMPORT-001',
    '',
    '2026-12-31',
    'Example Customer',
    '0944123456',
    'دمشق',
    'المزة',
    'شارع المثال 12',
    '',
    '',
    'COD',
    'USD',
    '',
    '',
    'csv_import',
    '',
    '',
    'EXAMPLE-SKU-2',
    '1',
    '5',
  ];
  return rowsToCsv([...OMS_IMPORT_CSV_HEADERS], [example, secondLine]);
}
