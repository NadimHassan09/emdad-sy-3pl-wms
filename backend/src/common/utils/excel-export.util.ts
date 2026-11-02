import ExcelJS from 'exceljs';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Sanitizes user-controlled text to prevent spreadsheet formula injection.
 * If text begins with formula operators (=, +, -, @, tab, cr), prepends an apostrophe.
 */
export function sanitizeExcelText(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  if (!text) return '';
  if (FORMULA_PREFIX.test(text) || text.startsWith("'")) {
    return `'${text}`;
  }
  return text;
}

export type ExcelExportColumn = {
  header: string;
  key: string;
  width?: number;
};

export interface BuildExcelOptions {
  sheetName?: string;
  title?: string;
  columns: ExcelExportColumn[];
  rows: Array<Record<string, unknown>>;
  isRtl?: boolean;
}

/**
 * Builds an Excel (.xlsx) buffer with formatted headers, auto-adjusted column widths,
 * formula injection sanitization, and RTL/LTR layout support.
 */
export async function buildExcelBuffer(options: BuildExcelOptions): Promise<Buffer> {
  const { sheetName = 'Sheet1', columns, rows, isRtl = false } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMDAD 3PL WMS/OMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: isRtl }],
  });

  // Define columns
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? Math.max(col.header.length + 4, 12),
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: isRtl ? 'right' : 'left',
    wrapText: false,
  };
  headerRow.border = {
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // Add data rows with sanitization
  for (const row of rows) {
    const rowValues: Record<string, unknown> = {};
    for (const col of columns) {
      const raw = row[col.key];
      if (raw == null) {
        rowValues[col.key] = '';
      } else if (typeof raw === 'number' || typeof raw === 'boolean') {
        rowValues[col.key] = raw;
      } else if (raw instanceof Date) {
        rowValues[col.key] = raw.toISOString().replace('T', ' ').slice(0, 19);
      } else {
        rowValues[col.key] = sanitizeExcelText(raw);
      }
    }
    sheet.addRow(rowValues);
  }

  // Adjust row height and alignment
  sheet.eachRow((r, rowNumber) => {
    if (rowNumber > 1) {
      r.height = 20;
      r.alignment = {
        vertical: 'middle',
        horizontal: isRtl ? 'right' : 'left',
      };
      r.font = { name: 'Arial', size: 9, color: { argb: 'FF334155' } };
    }
  });

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}
