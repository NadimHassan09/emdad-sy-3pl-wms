import { existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import type { Browser, PuppeteerNode } from 'puppeteer';

import { PdfService } from '../../pdf/pdf.service';
import type { OmsWaybillData } from './oms-order.types';
import { OmsWaybillService } from './oms-waybill.service';

const importPuppeteer = new Function('return import("puppeteer")') as () => Promise<{
  default: PuppeteerNode;
}>;

function fixture(productCount: number): OmsWaybillData {
  const items = Array.from({ length: productCount }, (_, index) => ({
    id: `line-${index + 1}`,
    name: `منتج تجريبي ${index + 1}`,
    sku: `SKU-${index + 1}`,
    quantity: 1,
    price: 10,
  }));
  return {
    orderId: 'order-1',
    orderNumber: 'OMS-2026-03301',
    internalWaybillNumber: 'EMD-OMS-2026-03301',
    carrier: 'إمداد اكسبرس (داخلي)',
    isCarrierAwbFromApi: false,
    shippingMethod: 'manual',
    createdAt: '2026-08-23T00:00:00.000Z',
    qrCodeData: 'OMS-2026-03301',
    company: { id: 'c1', name: 'Mr jad' },
    recipient: {
      name: 'محمد الحريري',
      phone: '+963931655392',
      city: 'القنيطرة',
      district: 'خان أرنبة',
      address: 'خان أرنبة',
    },
    sender: { name: 'Mr jad', hub: 'مستودع إمداد المركزي — دمشق' },
    financials: {
      codAmount: 85,
      currency: 'USD',
      shippingFee: 0,
      paymentMethod: 'COD',
      total: 85,
    },
    items,
    totalQuantity: items.length,
  };
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await importPuppeteer()).default;
  const executablePath = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => candidate && existsSync(candidate));
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function main(): Promise<void> {
  const pdfService = new PdfService();
  const service = new OmsWaybillService({} as never, pdfService);
  const render = (html: string) => pdfService.renderHtml(html, {
    width: '100mm',
    height: '150mm',
    margin: { top: '2.5mm', bottom: '2.5mm', left: '2.5mm', right: '2.5mm' },
    preferCSSPageSize: true,
  });

  try {
    const oneHtml = await service.labelHtml(fixture(1));
    const onePdf = await render(oneHtml);
    writeFileSync('/tmp/waybill-one-product.pdf', onePdf);
    const oneDoc = await PDFDocument.load(onePdf);
    const oneSize = oneDoc.getPage(0).getSize();

    const browser = await launchBrowser();
    let oneText = '';
    let qrHeight = 0;
    try {
      const page = await browser.newPage();
      await page.setContent(oneHtml, { waitUntil: 'load' });
      oneText = String(await page.evaluate('document.body.innerText'));
      const manyHtml = await service.labelHtml(fixture(24));
      await page.setContent(manyHtml, { waitUntil: 'load' });
      qrHeight = Number(
        await page.evaluate('document.querySelector(".qr-slot img").getBoundingClientRect().height'),
      );
    } finally {
      await browser.close();
    }

    const dualHtml = await service.labelHtml({
      ...fixture(1),
      carrierTrackingNumber: 'AWB-998877',
      isCarrierAwbFromApi: true,
      shippingMethod: 'carrier',
    });
    const dualPdf = await render(dualHtml);
    writeFileSync('/tmp/waybill-dual-one.pdf', dualPdf);
    const dualDoc = await PDFDocument.load(dualPdf);

    const counts: Record<string, number> = {};
    for (const count of [2, 3, 24]) {
      const pdf = await render(await service.labelHtml(fixture(count)));
      writeFileSync(`/tmp/waybill-${count}-products.pdf`, pdf);
      counts[String(count)] = (await PDFDocument.load(pdf)).getPageCount();
    }

    const report = {
      onePages: oneDoc.getPageCount(),
      width: oneSize.width,
      height: oneSize.height,
      oneText,
      dualPages: dualDoc.getPageCount(),
      twoPages: counts['2'],
      threePages: counts['3'],
      manyPages: counts['24'],
      qrHeight,
    };
    process.stdout.write(`WAYBILL_LAYOUT_JSON ${JSON.stringify(report)}\n`);
  } finally {
    await pdfService.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
