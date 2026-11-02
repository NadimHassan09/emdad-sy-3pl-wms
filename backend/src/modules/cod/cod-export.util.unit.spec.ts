import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import {
  COD_DETAIL_HEADERS,
  buildCodReportWorkbook,
  collectionStatusLabel,
  parseCodAmount,
  payoutStatusLabel,
  sanitizeExcelText,
  sanitizeFilenamePart,
  summarizeCodRecords,
  type CodExportRecord,
} from './cod-export.util';
import { buildCodReportHtml } from './cod-export-pdf.util';

function rec(overrides: Partial<CodExportRecord>): CodExportRecord {
  return {
    id: 'cod-1',
    companyName: 'Client A',
    omsOrderId: 'oms-1',
    orderNumber: 'OMS-1',
    outboundOrderNumber: 'OUT-1',
    recipientName: 'Buyer',
    trackingNumber: 'AWB-1',
    currentAmount: '100',
    currency: 'USD',
    status: 'pending',
    availableAt: null,
    paidOutAt: null,
    ...overrides,
  };
}

function sheetText(sheet: ExcelJS.Worksheet): string {
  const rows = sheet.getSheetValues() as unknown[][];
  return rows.map((row) => (row ?? []).join('|')).join('\n');
}

function detailHeaderRow(sheet: ExcelJS.Worksheet): string[] {
  const rows = sheet.getSheetValues() as unknown[][];
  const header = rows.find((row) => Array.isArray(row) && row.includes('OMS Order ID'));
  return (header ?? []).filter((cell) => cell != null && cell !== '').map(String);
}

describe('COD Excel export helpers', () => {
  it('does not mix currencies and distinguishes collected, paid out, unpaid, and uncollected', () => {
    const summary = summarizeCodRecords([
      rec({ id: '1', status: 'paid_out', currentAmount: '40', currency: 'USD' }),
      rec({ id: '2', status: 'available', currentAmount: '25', currency: 'USD' }),
      rec({ id: '3', status: 'pending', currentAmount: '10', currency: 'USD' }),
      rec({ id: '4', status: 'returned', currentAmount: '5', currency: 'USD' }),
      rec({ id: '5', status: 'paid_out', currentAmount: '200', currency: 'SYP' }),
      rec({ id: '6', status: 'pending', currentAmount: '50', currency: 'SYP' }),
    ]);
    expect(summary.recordCount).toBe(6);
    expect(summary.byCurrency).toEqual([
      {
        currency: 'SYP',
        recordCount: 2,
        collected: 200,
        paidOut: 200,
        collectedUnpaid: 0,
        uncollected: 50,
        returned: 0,
      },
      {
        currency: 'USD',
        recordCount: 4,
        collected: 65,
        paidOut: 40,
        collectedUnpaid: 25,
        uncollected: 10,
        returned: 5,
      },
    ]);
  });

  it('does not inflate totals when currentAmount already includes adjustments', () => {
    const summary = summarizeCodRecords([
      rec({
        id: 'adj',
        status: 'available',
        currentAmount: '80',
      }),
    ]);
    expect(summary.byCurrency[0]?.collected).toBe(80);
    expect(summary.recordCount).toBe(1);
  });

  it('treats formula-like text as plain text', () => {
    expect(sanitizeExcelText('=CMD()')).toBe("'=CMD()");
    expect(sanitizeExcelText('+1+1')).toBe("'+1+1");
    expect(sanitizeExcelText('-SUM(A1)')).toBe("'-SUM(A1)");
    expect(sanitizeExcelText('@foo')).toBe("'@foo");
    expect(sanitizeExcelText('Normal')).toBe('Normal');
    expect(sanitizeExcelText(null)).toBe('');
  });

  it('maps collection vs payout from the existing status enum', () => {
    expect(collectionStatusLabel('available')).toBe('Collected');
    expect(collectionStatusLabel('paid_out')).toBe('Collected');
    expect(collectionStatusLabel('pending')).toBe('Not collected');
    expect(payoutStatusLabel('paid_out')).toBe('Paid out');
    expect(payoutStatusLabel('available')).toBe('Not paid out');
  });

  it('keeps the seven detail columns and omits the removed fields', async () => {
    const records = [
      rec({ id: 'cod-page-1', orderNumber: 'OMS-A' }),
      rec({
        id: 'cod-page-2',
        orderNumber: 'OMS-B',
        outboundOrderNumber: null,
        recipientName: null,
        trackingNumber: null,
        status: 'available',
        currentAmount: '12.5',
        availableAt: '2026-10-21T12:00:00.000Z',
      }),
      rec({
        id: 'cod-formula',
        companyName: '=1+1',
        recipientName: '+cmd',
        trackingNumber: '@AWB',
        status: 'paid_out',
        paidOutAt: '2026-10-22T08:00:00.000Z',
      }),
    ];
    const buffer = await buildCodReportWorkbook({
      records,
      exportedAt: new Date('2026-10-22T11:00:00.000Z'),
      clientLabel: 'Client A',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet('COD Report');
    expect(sheet).toBeDefined();
    const joined = sheetText(sheet!);
    expect(joined).toContain('Client A');
    expect(joined).toContain('OMS-A');
    expect(joined).toContain('OMS-B');
    expect(joined).toContain("'+cmd");
    expect(joined).not.toContain('Export date/time');
    expect(joined).not.toContain('Total COD records');
    expect(joined).not.toContain('original + adjustments');
    expect(joined).not.toContain('COD ID');
    expect(joined).not.toContain('Client name');
    expect(joined).not.toContain('Shipment ID');
    expect(joined).not.toContain('Tracking/AWB');
    expect(joined).not.toContain('cod-page-1');
    expect(joined).not.toContain('OUT-1');
    expect(joined).not.toContain('AWB-1');
    expect(detailHeaderRow(sheet!)).toEqual([...COD_DETAIL_HEADERS]);
    expect(parseCodAmount('12.5')).toBe(12.5);
  });

  it('handles an empty dataset without dropping the summary table', async () => {
    const buffer = await buildCodReportWorkbook({
      records: [],
      clientLabel: 'All Clients',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const joined = sheetText(workbook.getWorksheet('COD Report')!);
    expect(joined).toContain('All Clients');
    expect(joined).toContain('Total collected');
    expect(joined).toContain('OMS Order ID');
    expect(joined).not.toContain('Export date/time');
  });

  it('sanitizes client names for export filenames', () => {
    expect(sanitizeFilenamePart('Mr Jad')).toBe('Mr_Jad');
    expect(sanitizeFilenamePart('All Clients')).toBe('All_Clients');
    expect(sanitizeFilenamePart('a/b\\c:d')).toBe('a_b_c_d');
  });
});

describe('COD PDF export HTML', () => {
  const logoPath = join(__dirname, '../../pdf/assets/logo.png');
  const officialLogo = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;

  it('uses the official EMDAD logo and the same seven columns as Excel', () => {
    const html = buildCodReportHtml({
      records: [
        rec({
          orderNumber: 'OMS-2026-00001',
          recipientName: 'نادر حسن',
          trackingNumber: '260303707929',
          outboundOrderNumber: 'OUT-1',
        }),
      ],
      clientLabel: 'Acme Imports',
      brand: {
        companyName: 'EMDAD Logistics & Warehousing',
        companyNameAr: 'إمداد للخدمات اللوجستية والتخزين',
        tagline: 'Logistics & Warehousing',
        logoDataUri: officialLogo,
        fontFaceCss: "@font-face{font-family:'Cairo';src:local('Cairo');}",
      },
    });
    expect(html).toContain(officialLogo);
    expect(html).toContain('alt="EMDAD"');
    expect(html).toContain('Acme Imports');
    expect(html).toContain('OMS-2026-00001');
    expect(html).toContain('نادر حسن');
    expect(html).toContain('font-family: \'Cairo\'');
    for (const header of COD_DETAIL_HEADERS) {
      expect(html).toContain(header);
    }
    expect(html).not.toContain('Export date/time');
    expect(html).not.toContain('Total COD records');
    expect(html).not.toContain('original + adjustments');
    expect(html).not.toContain('COD ID');
    expect(html).not.toContain('Client name');
    expect(html).not.toContain('Shipment ID');
    expect(html).not.toContain('Tracking/AWB');
    expect(html).not.toContain('260303707929');
    expect(html).not.toContain('OUT-1');
    expect(html).not.toContain('cod-1');
  });

  it('repeats table headers and keeps each detail row together across pages', () => {
    const html = buildCodReportHtml({
      records: Array.from({ length: 80 }, (_, i) =>
        rec({
          id: `cod-${i}`,
          orderNumber: `OMS-LONG-${String(i).padStart(5, '0')}-VERY-LONG-ORDER-ID`,
          recipientName: i % 2 === 0 ? `Buyer ${i}` : `مستلم طويل الاسم ${i}`,
        }),
      ),
      clientLabel: 'All Clients',
      brand: {
        companyName: 'EMDAD Logistics & Warehousing',
        companyNameAr: 'إمداد للخدمات اللوجستية والتخزين',
        tagline: 'Logistics & Warehousing',
        logoDataUri: officialLogo,
        fontFaceCss: '',
      },
    });
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toContain('overflow-wrap: break-word');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('OMS-LONG-00000-VERY-LONG-ORDER-ID');
    expect(html).toContain('OMS-LONG-00079-VERY-LONG-ORDER-ID');
    expect(html).toContain('مستلم طويل الاسم 1');
  });

  it('reconciles Excel and PDF summary figures for mixed currencies', async () => {
    const records = [
      rec({ id: '1', status: 'paid_out', currentAmount: '40', currency: 'USD', orderNumber: 'OMS-USD-1' }),
      rec({ id: '2', status: 'available', currentAmount: '25', currency: 'USD', orderNumber: 'OMS-USD-2' }),
      rec({ id: '3', status: 'pending', currentAmount: '10', currency: 'USD', orderNumber: 'OMS-USD-3' }),
      rec({ id: '4', status: 'returned', currentAmount: '5', currency: 'USD', orderNumber: 'OMS-USD-4' }),
      rec({ id: '5', status: 'paid_out', currentAmount: '200', currency: 'SYP', orderNumber: 'OMS-SYP-1' }),
    ];
    const excelBuffer = await buildCodReportWorkbook({ records, clientLabel: 'All Clients' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as unknown as ArrayBuffer);
    const joined = sheetText(workbook.getWorksheet('COD Report')!);
    const html = buildCodReportHtml({
      records,
      clientLabel: 'All Clients',
      brand: {
        companyName: 'EMDAD',
        companyNameAr: 'إمداد',
        tagline: 'Logistics',
        logoDataUri: officialLogo,
        fontFaceCss: '',
      },
    });
    expect(joined).toContain('USD');
    expect(joined).toContain('SYP');
    expect(html).toContain('USD');
    expect(html).toContain('SYP');
    expect(joined).toMatch(/65(\.0+)?/);
    expect(html).toContain('65.00');
    expect(html).toContain('200.00');
    expect(html).toContain('OMS-USD-1');
    expect(html).toContain('OMS-SYP-1');
  });

  it('renders an empty PDF dataset without forbidden fields', () => {
    const html = buildCodReportHtml({
      records: [],
      clientLabel: 'All Clients',
      brand: {
        companyName: 'EMDAD Logistics & Warehousing',
        companyNameAr: 'إمداد للخدمات اللوجستية والتخزين',
        tagline: 'Logistics & Warehousing',
        logoDataUri: officialLogo,
        fontFaceCss: '',
      },
    });
    expect(html).toContain('All Clients');
    expect(html).toContain('No COD records match the current filters.');
    expect(html).not.toContain('Export date/time');
    expect(html).not.toContain('Total COD records');
  });
});
