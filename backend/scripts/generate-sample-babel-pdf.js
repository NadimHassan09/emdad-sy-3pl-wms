const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { OmsWaybillService } = require('../dist/src/modules/oms/oms-waybill.service');
const { PdfService } = require('../dist/src/pdf/pdf.service');

async function run() {
  const pdfService = new PdfService();
  const babelOrder = {
    id: 'sample-babel-order',
    orderNumber: 'OMS-BABEL-2026',
    outboundOrderId: 'out-sample',
    carrier: 'بابل إكسبريس',
    trackingNumber: '260302271039',
    shippingProviderCode: 'BABEL_EXPRESS',
    shippingServiceId: 'BABEL_EXPRESS:address',
    paymentMethod: 'COD',
    totalAmount: '450.00',
    shippingFee: '25.00',
    codFee: '0',
    currency: 'USD',
    recipientName: 'Ahmad Khalil',
    recipientPhone: '+963987654321',
    shippingAddressCity: 'Damascus',
    shippingAddressStreet: 'Al-Mazzeh, Villa 14',
    createdAt: new Date('2026-10-24T18:00:00Z'),
    lines: [
      {
        id: 'line-1',
        product: { title: 'Wireless Ergonomic Keyboard', sku: 'SKU-BABEL-01' },
        requestedQuantity: 2,
        unitPrice: '150.00',
      },
      {
        id: 'line-2',
        product: { title: 'Precision Gaming Mouse', sku: 'SKU-BABEL-02' },
        requestedQuantity: 1,
        unitPrice: '150.00',
      },
    ],
    carrierShipments: [
      {
        id: 'cs-sample-1',
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: '260302271039',
        externalAwb: '260302271039',
        rawResultMeta: {
          awb: '260302271039',
          partBarcodes: [
            'PB-189348-TTZFG',
            'PB-189349-FWMBA',
            'PB-189350-0LHQ0',
          ],
          parts: [
            { barcode: 'PB-189348-TTZFG', partIndex: 1 },
            { barcode: 'PB-189349-FWMBA', partIndex: 2 },
            { barcode: 'PB-189350-0LHQ0', partIndex: 3 },
          ],
        },
      },
    ],
    company: { name: 'EMDAD E-Commerce Partner' },
    warehouse: { name: 'Main Fulfillment Hub Damascus' },
  };

  const prismaMock = {
    omsOrder: {
      findFirst: async () => babelOrder,
    },
    carrierShipment: {
      findFirst: async () => babelOrder.carrierShipments[0],
    },
    shippingOriginAddress: {
      findUnique: async () => ({
        city: 'Damascus',
        district: 'Al-Mazzeh',
        street: 'Central Logistics St',
      }),
    },
  };

  const waybillService = new OmsWaybillService(prismaMock, pdfService);
  const user = {
    id: 'user-staging-1',
    companyId: 'comp-1',
    role: 'wh_operator',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['comp-1'],
  };

  console.log('--- Generating sample 3-part Babel Waybill PDF ---');
  const pdfResult = await waybillService.generateWaybillPdf('sample-babel-order', user);
  const pdfBuffer = pdfResult.buffer;

  const outPath = path.resolve(__dirname, '../../artifacts/sample_babel_3part_waybill.pdf');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`Generated PDF saved to: ${outPath} (${pdfBuffer.length} bytes, filename: ${pdfResult.filename})`);

  const doc = await PDFDocument.load(pdfBuffer);
  const pageCount = doc.getPageCount();
  console.log(`Verified PDF Page Count: ${pageCount}`);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`Page ${i + 1}: ${width.toFixed(2)} pt x ${height.toFixed(2)} pt (~${(width * 25.4 / 72).toFixed(1)}mm x ${(height * 25.4 / 72).toFixed(1)}mm)`);
  }

  const data = await waybillService.getWaybillData('sample-babel-order', user);
  console.log('\n--- Waybill Data Inspection ---');
  console.log('Order Number:', data.orderNumber);
  console.log('Internal QR Payload:', data.qrCodeData);
  console.log('Main AWB (Readable):', data.mainAwb);
  console.log('Part Total:', data.partTotal);
  console.log('Part Barcodes:', data.partBarcodes);
  console.log('Parts Array:', JSON.stringify(data.parts, null, 2));

  // Check HTML for each part to verify QR and label content
  for (let i = 0; i < data.parts.length; i++) {
    const p = data.parts[i];
    const partData = {
      ...data,
      carrierTrackingNumber: p.barcode,
      partBarcode: p.barcode,
      partIndex: p.partIndex,
      partTotal: p.partTotal,
    };
    const html = await waybillService.labelHtml(partData);
    console.log(`\nPart ${p.partIndex} Verification:`);
    console.log(`- Contains part barcode "${p.barcode}":`, html.includes(p.barcode));
    console.log(`- Contains part badge "طرد ${p.partIndex} من 3":`, html.includes(`طرد ${p.partIndex} من 3`));
    console.log(`- Contains main AWB "260302271039":`, html.includes('260302271039'));
    console.log(`- Contains internal QR code slot:`, html.includes('رقم بوليصة إمداد الداخلي'));
    console.log(`- Never uses main AWB as part barcode slot:`, !html.includes(`<div class="qr-number">260302271039</div>`));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
