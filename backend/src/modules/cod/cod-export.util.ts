import ExcelJS from 'exceljs';
import { CodRecordStatus } from '@prisma/client';

export type CodExportStatus = `${CodRecordStatus}`;

export type CodExportRecord = {
  id: string;
  companyName: string | null;
  omsOrderId: string;
  orderNumber: string | null;
  outboundOrderNumber: string | null;
  recipientName: string | null;
  trackingNumber: string | null;
  currentAmount: string;
  currency: string;
  status: CodExportStatus;
  availableAt: Date | string | null;
  paidOutAt: Date | string | null;
};

export type CodCurrencySummary = {
  currency: string;
  recordCount: number;
  collected: number;
  paidOut: number;
  collectedUnpaid: number;
  uncollected: number;
  returned: number;
};

export type CodExportSummary = {
  recordCount: number;
  byCurrency: CodCurrencySummary[];
};

export const COD_DETAIL_HEADERS = [
  'OMS Order ID',
  'Buyer / Recipient Name',
  'COD Amount',
  'Collection Status',
  'Client Payout Status',
  'Collection Date',
  'Client Payout Date',
] as const;

export const COD_SUMMARY_HEADERS = [
  'Currency',
  'Records',
  'Total collected',
  'Paid out to clients',
  'Collected, not yet paid out',
  'Not yet collected',
  'Returned (excluded from collection totals)',
] as const;

export type CodReportView = {
  clientLabel: string;
  summary: CodExportSummary;
  records: CodExportRecord[];
};

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Treat user-controlled text as plain text in spreadsheet cells. */
export function sanitizeExcelText(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  if (!text) return '';
  if (FORMULA_PREFIX.test(text) || text.startsWith("'")) {
    return `'${text}`;
  }
  return text;
}

export function parseCodAmount(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * One CodRecord is counted once using currentAmount (original + adjustments).
 * Status buckets follow CodRecordStatus:
 * - collected = available + paid_out
 * - paid out to client = paid_out
 * - collected but unpaid = available
 * - not yet collected = pending
 * - returned is excluded from those four and listed separately
 */
export function summarizeCodRecords(records: CodExportRecord[]): CodExportSummary {
  const byCurrency = new Map<string, CodCurrencySummary>();
  const bucket = (currency: string): CodCurrencySummary => {
    const key = (currency || 'USD').trim() || 'USD';
    let row = byCurrency.get(key);
    if (!row) {
      row = {
        currency: key,
        recordCount: 0,
        collected: 0,
        paidOut: 0,
        collectedUnpaid: 0,
        uncollected: 0,
        returned: 0,
      };
      byCurrency.set(key, row);
    }
    return row;
  };

  for (const record of records) {
    const row = bucket(record.currency);
    const amount = parseCodAmount(record.currentAmount);
    row.recordCount += 1;
    switch (record.status) {
      case 'paid_out':
        row.collected += amount;
        row.paidOut += amount;
        break;
      case 'available':
        row.collected += amount;
        row.collectedUnpaid += amount;
        break;
      case 'pending':
        row.uncollected += amount;
        break;
      case 'returned':
        row.returned += amount;
        break;
      default:
        break;
    }
  }

  return {
    recordCount: records.length,
    byCurrency: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

export function collectionStatusLabel(status: CodExportStatus): string {
  switch (status) {
    case 'available':
    case 'paid_out':
      return 'Collected';
    case 'returned':
      return 'Returned';
    case 'pending':
    default:
      return 'Not collected';
  }
}

export function payoutStatusLabel(status: CodExportStatus): string {
  return status === 'paid_out' ? 'Paid out' : 'Not paid out';
}

export function excelDate(value: Date | string | null | undefined): Date | string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date;
}

export function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function buildCodReportView(
  records: CodExportRecord[],
  clientLabel: string,
): CodReportView {
  return {
    clientLabel: clientLabel.trim() || 'All Clients',
    summary: summarizeCodRecords(records),
    records,
  };
}

export function displayOrderNumber(record: CodExportRecord): string {
  return (record.orderNumber || record.omsOrderId || '—').trim() || '—';
}

export function displayRecipientName(record: CodExportRecord): string {
  return (record.recipientName || '—').trim() || '—';
}

export async function buildCodReportWorkbook(params: {
  records: CodExportRecord[];
  exportedAt?: Date;
  clientLabel: string;
}): Promise<Buffer> {
  const view = buildCodReportView(params.records, params.clientLabel);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EMDAD OMS';
  workbook.created = params.exportedAt ?? new Date();
  const sheet = workbook.addWorksheet('COD Report');

  const title = sheet.addRow(['COD Report']);
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF08452C' },
  };
  sheet.mergeCells(1, 1, 1, 7);

  const clientRow = sheet.addRow(['Client', sanitizeExcelText(view.clientLabel)]);
  clientRow.getCell(1).font = { bold: true };
  clientRow.getCell(2).font = { bold: true, size: 12 };
  sheet.addRow([]);

  const summaryHeader = sheet.addRow([...COD_SUMMARY_HEADERS]);
  summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summaryHeader.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B5E3C' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  const summaryRows =
    view.summary.byCurrency.length > 0
      ? view.summary.byCurrency
      : [
          {
            currency: '—',
            recordCount: 0,
            collected: 0,
            paidOut: 0,
            collectedUnpaid: 0,
            uncollected: 0,
            returned: 0,
          },
        ];

  for (const row of summaryRows) {
    const excelRow = sheet.addRow([
      row.currency,
      row.recordCount,
      roundMoney(row.collected),
      roundMoney(row.paidOut),
      roundMoney(row.collectedUnpaid),
      roundMoney(row.uncollected),
      roundMoney(row.returned),
    ]);
    for (let col = 3; col <= 7; col += 1) {
      excelRow.getCell(col).numFmt = '#,##0.00##';
      excelRow.getCell(col).alignment = { horizontal: 'right' };
    }
    excelRow.getCell(2).alignment = { horizontal: 'center' };
  }

  sheet.addRow([]);
  const detailTitle = sheet.addRow(['COD records']);
  detailTitle.font = { bold: true, size: 12, color: { argb: 'FF08452C' } };

  const headerRow = sheet.addRow([...COD_DETAIL_HEADERS]);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF08452C' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  const detailHeaderRowNumber = headerRow.number;

  for (const record of view.records) {
    const excelRow = sheet.addRow([
      sanitizeExcelText(displayOrderNumber(record)),
      sanitizeExcelText(displayRecipientName(record)),
      roundMoney(parseCodAmount(record.currentAmount)),
      collectionStatusLabel(record.status),
      payoutStatusLabel(record.status),
      excelDate(record.availableAt),
      excelDate(record.paidOutAt),
    ]);
    excelRow.getCell(1).alignment = { wrapText: true, vertical: 'middle' };
    excelRow.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
    excelRow.getCell(3).numFmt = '#,##0.00##';
    excelRow.getCell(3).alignment = { horizontal: 'right' };
    excelRow.getCell(6).numFmt = 'yyyy-mm-dd hh:mm';
    excelRow.getCell(7).numFmt = 'yyyy-mm-dd hh:mm';
  }

  const lastRow = Math.max(detailHeaderRowNumber, sheet.rowCount);
  sheet.autoFilter = {
    from: { row: detailHeaderRowNumber, column: 1 },
    to: { row: lastRow, column: COD_DETAIL_HEADERS.length },
  };
  sheet.views = [
    {
      state: 'frozen',
      ySplit: detailHeaderRowNumber,
      activeCell: `A${detailHeaderRowNumber + 1}`,
    },
  ];

  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 32;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 22;
  sheet.getColumn(6).width = 22;
  sheet.getColumn(7).width = 22;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function sanitizeFilenamePart(value: string): string {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return cleaned || 'All_Clients';
}

export function codExportFilename(clientLabel: string, ext: 'xlsx' | 'pdf'): string {
  return `COD_Report_${sanitizeFilenamePart(clientLabel)}.${ext}`;
}

export function codExportContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
