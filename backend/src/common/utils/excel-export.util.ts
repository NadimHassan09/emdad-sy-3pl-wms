import ExcelJS from 'exceljs';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Prevents spreadsheet formula injection. */
export function sanitizeExcelText(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  if (!text) return '';
  if (FORMULA_PREFIX.test(text) || text.startsWith("'")) return `'${text}`;
  return text;
}

export type ExcelExportColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ExcelSummaryStat = {
  label: string;
  value: string | number;
};

export interface BuildExcelOptions {
  sheetName?: string;
  /** Report title shown in the branded header. */
  title?: string;
  columns: ExcelExportColumn[];
  rows: Array<Record<string, unknown>>;
  isRtl?: boolean;
  /**
   * Optional analytics/summary stats displayed above the data table.
   * Each entry renders as a label-value pair in the header section.
   */
  summary?: ExcelSummaryStat[];
}

// EMDAD brand colours
const BRAND_GREEN = 'FF1B6B3A';
const BRAND_GREEN_LIGHT = 'FFE8F5EE';
const BRAND_GREEN_MID = 'FF2D8A52';
const HEADER_BG = 'FFF1F5F9';
const HEADER_FONT = 'FF1E293B';
const DATA_FONT = 'FF334155';
const STAT_LABEL_COLOR = 'FF4B7A5A';

export async function buildExcelBuffer(options: BuildExcelOptions): Promise<Buffer> {
  const { sheetName = 'Sheet1', title, columns, rows, isRtl = false, summary = [] } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMDAD 3PL WMS/OMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: isRtl }],
  });

  const colCount = columns.length;
  let currentRow = 1;

  // ── Branded header ────────────────────────────────────────────────────────
  // Row 1: EMDAD logo row (green background, company name)
  const logoRow = sheet.getRow(currentRow++);
  logoRow.getCell(1).value = 'EMDAD — إمداد';
  if (title) {
    logoRow.getCell(2).value = title;
  }
  logoRow.height = 32;
  for (let c = 1; c <= colCount; c++) {
    const cell = logoRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } };
    cell.font = {
      name: 'Arial',
      size: c === 1 ? 13 : 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left' };
  }

  // Row 2: Subtitle / metadata (date + record count)
  const metaRow = sheet.getRow(currentRow++);
  const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  metaRow.getCell(1).value = `Generated: ${dateStr}  |  Records: ${rows.length}`;
  metaRow.height = 20;
  for (let c = 1; c <= colCount; c++) {
    const cell = metaRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_LIGHT } };
    cell.font = { name: 'Arial', size: 9, color: { argb: STAT_LABEL_COLOR } };
    cell.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left' };
  }

  // ── Summary stats block ────────────────────────────────────────────────────
  if (summary.length > 0) {
    // Blank separator
    const sepRow = sheet.getRow(currentRow++);
    sepRow.height = 6;
    for (let c = 1; c <= colCount; c++) {
      sepRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_LIGHT } };
    }

    // Stats header label
    const statsTitleRow = sheet.getRow(currentRow++);
    statsTitleRow.getCell(1).value = 'Summary';
    statsTitleRow.height = 20;
    for (let c = 1; c <= colCount; c++) {
      const cell = statsTitleRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_MID } };
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left' };
    }

    // Stats are written 2 per row (label col, value col, label col2, value col2...)
    const statsPerRow = Math.max(1, Math.floor(colCount / 2));
    for (let i = 0; i < summary.length; i += statsPerRow) {
      const statRow = sheet.getRow(currentRow++);
      statRow.height = 18;
      for (let j = 0; j < statsPerRow && i + j < summary.length; j++) {
        const stat = summary[i + j];
        const labelCol = j * 2 + 1;
        const valueCol = labelCol + 1;
        const labelCell = statRow.getCell(labelCol);
        labelCell.value = stat.label;
        labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: STAT_LABEL_COLOR } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_LIGHT } };
        labelCell.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left' };
        if (valueCol <= colCount) {
          const valueCell = statRow.getCell(valueCol);
          valueCell.value = stat.value;
          valueCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: HEADER_FONT } };
          valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_LIGHT } };
          valueCell.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left' };
        }
      }
      // Fill remaining cells
      for (let c = statsPerRow * 2 + 1; c <= colCount; c++) {
        statRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_LIGHT } };
      }
    }

    // Separator after stats
    const sepRow2 = sheet.getRow(currentRow++);
    sepRow2.height = 6;
    for (let c = 1; c <= colCount; c++) {
      sepRow2.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_LIGHT } };
    }
  }

  // Empty row between header block and data
  const gapRow = sheet.getRow(currentRow++);
  gapRow.height = 4;

  // ── Column headers ─────────────────────────────────────────────────────────
  const dataHeaderRowNum = currentRow;
  sheet.columns = columns.map((col) => ({
    header: '',
    key: col.key,
    width: col.width ?? Math.max(col.header.length + 4, 12),
  }));

  const headerRow = sheet.getRow(dataHeaderRowNum);
  columns.forEach((col, idx) => {
    headerRow.getCell(idx + 1).value = col.header;
  });
  currentRow++;
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: HEADER_FONT } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
  headerRow.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left', wrapText: false };
  headerRow.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };

  // ── Data rows ──────────────────────────────────────────────────────────────
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
    const dataRow = sheet.addRow(rowValues);
    dataRow.height = 20;
    dataRow.alignment = { vertical: 'middle', horizontal: isRtl ? 'right' : 'left' };
    dataRow.font = { name: 'Arial', size: 9, color: { argb: DATA_FONT } };
    currentRow++;
  }

  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}
