import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

import {
  buildCodPdfFooterTemplate,
  buildCodReportHtml,
} from '../src/modules/cod/cod-export-pdf.util';
import {
  buildCodReportWorkbook,
  type CodExportRecord,
} from '../src/modules/cod/cod-export.util';
import { resolveBranding } from '../src/pdf/branding';
import { PdfService } from '../src/pdf/pdf.service';

function rec(overrides: Partial<CodExportRecord>): CodExportRecord {
  return {
    id: 'hidden-cod-id',
    companyName: 'Hidden Client Column',
    omsOrderId: 'oms-hidden',
    orderNumber: 'OMS-2026-00001',
    outboundOrderNumber: 'OUT-HIDDEN',
    recipientName: 'Nadin Hassan',
    trackingNumber: '260303707929',
    currentAmount: '100',
    currency: 'USD',
    status: 'available',
    availableAt: '2026-10-04T10:44:00.000Z',
    paidOutAt: null,
    ...overrides,
  };
}

async function main() {
  const outDir = join(__dirname, '../../tmp/cod-export-samples');
  mkdirSync(outDir, { recursive: true });

  const records: CodExportRecord[] = [
    rec({
      orderNumber: 'OMS-2026-02003',
      recipientName: 'Nadin Hassan',
      currentAmount: '100',
      status: 'available',
    }),
    rec({
      orderNumber: 'OMS-2026-02004',
      recipientName: 'نادر حسن',
      currentAmount: '100',
      status: 'pending',
      availableAt: null,
    }),
    rec({
      orderNumber: 'OMS-2026-03685-VERY-LONG-ORDER-IDENTIFIER',
      recipientName: 'Mohammad Al-Hariri with a particularly long recipient name',
      currentAmount: '12.5',
      status: 'paid_out',
      paidOutAt: '2026-10-22T08:00:00.000Z',
    }),
    rec({
      orderNumber: 'OMS-2026-02016',
      recipientName: 'Ahmad Ali',
      currentAmount: '0',
      currency: 'USD',
      status: 'returned',
      availableAt: null,
    }),
    rec({
      orderNumber: 'OMS-SYP-00001',
      recipientName: 'Client SYP',
      currentAmount: '200000',
      currency: 'SYP',
      status: 'paid_out',
      paidOutAt: '2026-10-21T09:00:00.000Z',
    }),
    ...Array.from({ length: 40 }, (_, i) =>
      rec({
        id: `page-row-${i}`,
        orderNumber: `OMS-2026-${String(30000 + i)}`,
        recipientName: i % 2 === 0 ? `Buyer ${i + 1}` : `مستلم ${i + 1}`,
        currentAmount: String(10 + i),
        status: i % 4 === 0 ? 'pending' : i % 4 === 1 ? 'available' : i % 4 === 2 ? 'paid_out' : 'returned',
        currency: i % 5 === 0 ? 'SYP' : 'USD',
      }),
    ),
  ];

  const xlsx = await buildCodReportWorkbook({
    records,
    clientLabel: 'Acme Imports',
  });
  const xlsxPath = join(outDir, 'COD_Report_Acme_Imports.xlsx');
  writeFileSync(xlsxPath, xlsx);

  const emptyXlsx = await buildCodReportWorkbook({
    records: [],
    clientLabel: 'All Clients',
  });
  writeFileSync(join(outDir, 'COD_Report_All_Clients_empty.xlsx'), emptyXlsx);

  const pdf = new PdfService();
  const branding = resolveBranding({ get: () => undefined } as never);
  const html = buildCodReportHtml({
    records,
    clientLabel: 'Acme Imports',
    brand: {
      companyName: branding.companyName,
      companyNameAr: branding.companyNameAr,
      tagline: branding.tagline,
      logoDataUri: pdf.logo,
      fontFaceCss: pdf.fontFaceCss,
    },
  });
  const pdfBuffer = await pdf.renderHtml(html, {
    format: 'A4',
    landscape: true,
    preferCSSPageSize: false,
    margin: { top: '10mm', bottom: '16mm', left: '10mm', right: '10mm' },
    footerTemplate: buildCodPdfFooterTemplate(branding.companyName),
  });
  const pdfPath = join(outDir, 'COD_Report_Acme_Imports.pdf');
  writeFileSync(pdfPath, pdfBuffer);

  const emptyHtml = buildCodReportHtml({
    records: [],
    clientLabel: 'All Clients',
    brand: {
      companyName: branding.companyName,
      companyNameAr: branding.companyNameAr,
      tagline: branding.tagline,
      logoDataUri: pdf.logo,
      fontFaceCss: pdf.fontFaceCss,
    },
  });
  const emptyPdf = await pdf.renderHtml(emptyHtml, {
    format: 'A4',
    landscape: true,
    preferCSSPageSize: false,
    margin: { top: '10mm', bottom: '16mm', left: '10mm', right: '10mm' },
    footerTemplate: buildCodPdfFooterTemplate(branding.companyName),
  });
  writeFileSync(join(outDir, 'COD_Report_All_Clients_empty.pdf'), emptyPdf);

  const parsed = await PDFDocument.load(pdfBuffer);
  const emptyParsed = await PDFDocument.load(emptyPdf);
  writeFileSync(
    join(outDir, 'inspection.json'),
    JSON.stringify(
      {
        xlsxBytes: xlsx.length,
        pdfBytes: pdfBuffer.length,
        pdfPages: parsed.getPageCount(),
        emptyPdfPages: emptyParsed.getPageCount(),
        pdfStartsWith: pdfBuffer.subarray(0, 5).toString('utf8'),
        logoEmbedded: html.includes('data:image/png;base64,') && html.includes('alt="EMDAD"'),
      },
      null,
      2,
    ),
  );

  await pdf.onModuleDestroy();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir,
        pdfPages: parsed.getPageCount(),
        emptyPdfPages: emptyParsed.getPageCount(),
      },
      null,
      2,
    ),
  );
}

void main();
