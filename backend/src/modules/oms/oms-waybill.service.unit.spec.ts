import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { OmsWaybillService } from './oms-waybill.service';
import { ACTIVE_CARRIER_SHIPMENT_WHERE } from '../shipping/shipping-lifecycle.util';
import type { AuthPrincipal } from '../../common/auth/current-user.types';

const createMockPagePdfBuffer = async (width = 283.46, height = 425.20) => {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return Buffer.from(await doc.save());
};

jest.setTimeout(30000);

describe('OmsWaybillService', () => {
  const user: AuthPrincipal = {
    id: 'user-1',
    companyId: 'comp-1',
    role: 'wh_operator',
    tenantScope: 'restricted',
    authorizedCompanyIds: ['comp-1'],
  };

  let prisma: any;
  let pdf: { renderHtml: jest.Mock; logo: string };
  let service: OmsWaybillService;

  const order = {
    id: 'oms-1',
    orderNumber: 'OMS-1',
    outboundOrderId: 'out-1',
    carrier: 'مسارات',
    trackingNumber: 'OLD-AWB',
    shippingServiceId: 'SILA_SY:old:area',
    createdAt: new Date('2026-10-21T00:00:00Z'),
    recipientName: 'Ali',
    recipientPhone: '0999',
    city: 'Damascus',
    district: '',
    addressLine1: 'Street',
    destinationAddress: 'Street',
    deliveryInstructions: '',
    notes: '',
    codAmount: 0,
    currency: 'USD',
    shippingFee: 0,
    paymentMethod: 'COD',
    subtotal: 10,
    company: { id: 'comp-1', name: 'Co', tradeName: 'Co', logoUrl: null, contactPhone: '' },
    lines: [],
    outboundOrder: {
      id: 'out-1',
      carrier: 'مسارات',
      trackingNumber: 'OLD-AWB',
      shippingServiceId: 'SILA_SY:new:area',
    },
  };

  beforeEach(() => {
    prisma = {
      omsOrder: { findFirst: jest.fn().mockResolvedValue(order) },
      carrierShipment: { findFirst: jest.fn() },
      shippingOriginAddress: {
        findUnique: jest.fn().mockResolvedValue({ street: 'Hub St', district: '', city: 'Aleppo' }),
      },
    };
    pdf = { renderHtml: jest.fn(), logo: '' };
    service = new OmsWaybillService(prisma, pdf as never);
  });

  it('11. waybill reflects a carrier change immediately on a new request', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce({
      status: 'created',
      supersededAt: null,
      providerCode: 'SILA_SY',
      trackingNumber: 'NEW-AWB',
      rawResultMeta: { courier_id: 'new', courier_name: 'ترابط' },
    });
    const data = await service.getWaybillData('oms-1', user);
    expect(data.carrier).toBe('ترابط');
    expect(data.carrierTrackingNumber).toBe('NEW-AWB');
    expect(prisma.carrierShipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          outboundOrderId: 'out-1',
          ...ACTIVE_CARRIER_SHIPMENT_WHERE,
        }),
      }),
    );
  });

  it('12. waybill does not display a cancelled/superseded shipment as active', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce(null);
    const data = await service.getWaybillData('oms-1', user);
    expect(data.shippingMethod).toBe('manual');
    expect(data.carrierTrackingNumber).toBeUndefined();
    expect(data.carrier).toBe('إمداد اكسبرس (داخلي)');
  });

  it('13. current waybill generation does not reuse a stale cached or persisted PDF', async () => {
    jest.spyOn(service, 'getWaybillData').mockResolvedValue({
      orderId: 'oms-1',
      orderNumber: 'OMS-1',
      internalWaybillNumber: 'OMS-1',
      carrier: 'ترابط',
      carrierTrackingNumber: 'NEW-AWB',
      isCarrierAwbFromApi: true,
      shippingMethod: 'carrier',
      createdAt: '2026-10-21T00:00:00.000Z',
      qrCodeData: 'OMS-1',
      company: { id: 'c1', name: 'Co' },
      recipient: { name: 'Ali', phone: '1', city: 'D', address: 'A' },
      sender: { name: 'Co', hub: 'Hub' },
      financials: { codAmount: 0, currency: 'USD', shippingFee: 0, paymentMethod: 'COD', total: 0 },
      items: [],
      totalQuantity: 0,
    } as never);
    jest.spyOn(service, 'labelHtml').mockResolvedValue('<html>waybill</html>');
    pdf.renderHtml.mockResolvedValueOnce(Buffer.from('pdf-1')).mockResolvedValueOnce(Buffer.from('pdf-2'));

    const first = await service.generateWaybillPdf('oms-1', user);
    const second = await service.generateWaybillPdf('oms-1', user);
    expect(service.getWaybillData).toHaveBeenCalledTimes(2);
    expect(pdf.renderHtml).toHaveBeenCalledTimes(2);
    expect(first.buffer.toString()).toBe('pdf-1');
    expect(second.buffer.toString()).toBe('pdf-2');
  });

  it('does not print a stale TARABUT label AWB after Karam issued a new tracking number', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce({
      status: 'created',
      supersededAt: null,
      providerCode: 'SILA_SY',
      trackingNumber: 'KARAM-NEW-AWB',
      rawResultMeta: {
        courier_id: '9575208d-3587-4d23-84b3-cdc97d09b60e',
        courier_name: 'Karam',
        courier_barcode: 'TARABUT-OLD-AWB',
        shipments: [{ remote_label_code: 'TARABUT-OLD-AWB' }],
      },
    });
    const data = await service.getWaybillData('oms-1', user);
    expect(data.carrier).toBe('كرم للشحن');
    expect(data.carrierTrackingNumber).toBe('KARAM-NEW-AWB');
    expect(data.carrierTrackingNumber).not.toBe('TARABUT-OLD-AWB');
  });

  it('prints a pending AWB state when the confirmed carrier has no new AWB yet', async () => {
    prisma.carrierShipment.findFirst.mockResolvedValueOnce({
      status: 'created',
      supersededAt: null,
      providerCode: 'SILA_SY',
      trackingNumber: null,
      rawResultMeta: {
        courier_name: 'كرم للشحن',
        awbPendingReassignment: true,
        previousAwb: 'TARABUT-OLD-AWB',
        shipments: [{ remote_label_code: 'TARABUT-OLD-AWB' }],
      },
    });
    const data = await service.getWaybillData('oms-1', user);
    expect(data.carrier).toBe('كرم للشحن');
    expect(data.carrierTrackingNumber).toBeUndefined();
  });

  it('2/9. Babel waybill uses the active shipment and ignores stale TARABUT label metadata', async () => {
    prisma.omsOrder.findFirst.mockResolvedValueOnce({
      ...order,
      carrier: 'ترابط',
      trackingNumber: 'TARABUT-OLD-AWB',
      shippingServiceId: 'SILA_SY:fd4f088d-243b-4582-bb72-bb97c69b589c:area',
      outboundOrder: {
        ...order.outboundOrder,
        carrier: 'ترابط',
        trackingNumber: 'TARABUT-OLD-AWB',
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingServiceId: 'BABEL_EXPRESS:address',
      },
    });
    prisma.carrierShipment.findFirst.mockResolvedValueOnce({
      status: 'created',
      supersededAt: null,
      providerCode: 'BABEL_EXPRESS',
      trackingNumber: '260303707929',
      externalAwb: '260303707929',
      rawResultMeta: {
        awb: '260303707929',
        shipments: [{ remote_label_code: 'TARABUT-OLD-AWB' }],
      },
    });
    const data = await service.getWaybillData('oms-1', user);
    expect(data.carrier).toBe('Babel Express');
    expect(data.carrierTrackingNumber).toBe('260303707929');
    expect(data.carrierTrackingNumber).not.toBe('TARABUT-OLD-AWB');
  });

  describe('Babel Express Multi-Part Shipping Labels (Phases 1-6)', () => {
    const babelOrder = {
      ...order,
      carrier: 'بابل إكسبريس',
      trackingNumber: '260302271039',
      shippingProviderCode: 'BABEL_EXPRESS',
      shippingServiceId: 'BABEL_EXPRESS:address',
      outboundOrder: {
        ...order.outboundOrder,
        carrier: 'بابل إكسبريس',
        trackingNumber: '260302271039',
        shippingProviderCode: 'BABEL_EXPRESS',
        shippingServiceId: 'BABEL_EXPRESS:address',
      },
    };

    it('1. Babel shipment with one part produces one label with correct part barcode and main AWB', async () => {
      prisma.omsOrder.findFirst.mockResolvedValueOnce(babelOrder);
      prisma.carrierShipment.findFirst.mockResolvedValueOnce({
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: '260302271039',
        externalAwb: '260302271039',
        rawResultMeta: {
          awb: '260302271039',
          partBarcodes: ['PB-189348-TTZFG'],
        },
      });
      pdf.renderHtml.mockImplementation(async () => createMockPagePdfBuffer());

      const data = await service.getWaybillData('oms-1', user);
      expect(data.partBarcodes).toEqual(['PB-189348-TTZFG']);
      expect(data.partIndex).toBe(1);
      expect(data.partTotal).toBe(1);
      expect(data.partBarcode).toBe('PB-189348-TTZFG');
      expect(data.mainAwb).toBe('260302271039');

      const result = await service.generateWaybillPdf('oms-1', user);
      const doc = await PDFDocument.load(result.buffer);
      expect(doc.getPageCount()).toBe(1);
    });

    it('2. Babel shipment with three part barcodes produces three labels', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(babelOrder);
      prisma.carrierShipment.findFirst.mockResolvedValue({
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: '260302271039',
        externalAwb: '260302271039',
        rawResultMeta: {
          awb: '260302271039',
          partBarcodes: ['PB-189348-TTZFG', 'PB-189349-FWMBA', 'PB-189350-0LHQ0'],
        },
      });
      pdf.renderHtml.mockImplementation(async () => createMockPagePdfBuffer());

      const data = await service.getWaybillData('oms-1', user);
      expect(data.partBarcodes).toHaveLength(3);
      expect(data.partTotal).toBe(3);

      const result = await service.generateWaybillPdf('oms-1', user);
      const doc = await PDFDocument.load(result.buffer);
      expect(doc.getPageCount()).toBe(3);
    });

    it('3. Every label uses the correct distinct part barcode as its Babel QR payload (never main AWB)', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(babelOrder);
      prisma.carrierShipment.findFirst.mockResolvedValue({
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: '260302271039',
        externalAwb: '260302271039',
        rawResultMeta: {
          awb: '260302271039',
          partBarcodes: ['PB-189348-TTZFG', 'PB-189349-FWMBA', 'PB-189350-0LHQ0'],
        },
      });

      const labelHtmlSpy = jest.spyOn(service, 'labelHtml');
      pdf.renderHtml.mockImplementation(async () => createMockPagePdfBuffer());

      await service.generateWaybillPdf('oms-1', user);
      expect(labelHtmlSpy).toHaveBeenCalledTimes(3);

      const firstCallArg = labelHtmlSpy.mock.calls[0][0];
      const secondCallArg = labelHtmlSpy.mock.calls[1][0];
      const thirdCallArg = labelHtmlSpy.mock.calls[2][0];

      expect(firstCallArg.partBarcode).toBe('PB-189348-TTZFG');
      expect(secondCallArg.partBarcode).toBe('PB-189349-FWMBA');
      expect(thirdCallArg.partBarcode).toBe('PB-189350-0LHQ0');

      // Verify that the part barcode is never the main AWB
      expect(firstCallArg.partBarcode).not.toBe('260302271039');
      expect(secondCallArg.partBarcode).not.toBe('260302271039');
      expect(thirdCallArg.partBarcode).not.toBe('260302271039');
    });

    it('4. Every label retains the same OMS order ID and internal EMDAD QR payload', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(babelOrder);
      prisma.carrierShipment.findFirst.mockResolvedValue({
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: '260302271039',
        externalAwb: '260302271039',
        rawResultMeta: {
          awb: '260302271039',
          partBarcodes: ['PB-189348-TTZFG', 'PB-189349-FWMBA'],
        },
      });

      const labelHtmlSpy = jest.spyOn(service, 'labelHtml');
      pdf.renderHtml.mockImplementation(async () => createMockPagePdfBuffer());

      await service.generateWaybillPdf('oms-1', user);

      for (let i = 0; i < 2; i++) {
        const arg = labelHtmlSpy.mock.calls[i][0];
        expect(arg.orderNumber).toBe('OMS-1');
        expect(arg.internalWaybillNumber).toBe('OMS-1');
        expect(arg.qrCodeData).toBe('OMS-1');
      }
    });

    it('5. Every label displays the same main Babel AWB as readable text', async () => {
      const p1Html = await service.labelHtml({
        ...order,
        orderId: 'oms-1',
        isCarrierAwbFromApi: true,
        shippingMethod: 'carrier',
        createdAt: '2026-10-21T00:00:00.000Z',
        qrCodeData: 'OMS-1',
        internalWaybillNumber: 'OMS-1',
        recipient: { name: 'Ali', phone: '0999', city: 'Damascus', address: 'Street' },
        sender: { name: 'Co', hub: 'Hub St' },
        financials: { codAmount: 0, currency: 'USD', shippingFee: 0, paymentMethod: 'COD', total: 10 },
        totalQuantity: 0,
        carrierTrackingNumber: '260302271039',
        mainAwb: '260302271039',
        partBarcode: 'PB-189348-TTZFG',
        partIndex: 1,
        partTotal: 3,
      } as any);

      expect(p1Html).toContain('AWB:');
      expect(p1Html).toContain('260302271039');
      expect(p1Html).toContain('PB-189348-TTZFG');
      expect(p1Html).toContain('باركود الطرد لدى الناقل');
    });

    it('6. Part numbering is correct across all generated labels', async () => {
      const p1Html = await service.labelHtml({
        ...order,
        orderId: 'oms-1',
        isCarrierAwbFromApi: true,
        shippingMethod: 'carrier',
        createdAt: '2026-10-21T00:00:00.000Z',
        qrCodeData: 'OMS-1',
        internalWaybillNumber: 'OMS-1',
        recipient: { name: 'Ali', phone: '0999', city: 'Damascus', address: 'Street' },
        sender: { name: 'Co', hub: 'Hub St' },
        financials: { codAmount: 0, currency: 'USD', shippingFee: 0, paymentMethod: 'COD', total: 10 },
        totalQuantity: 0,
        carrierTrackingNumber: '260302271039',
        mainAwb: '260302271039',
        partBarcode: 'PB-189348-TTZFG',
        partIndex: 1,
        partTotal: 3,
      } as any);
      expect(p1Html).toContain('طرد 1 من 3');
      expect(p1Html).toContain('Part 1 of 3');

      const p2Html = await service.labelHtml({
        ...order,
        orderId: 'oms-1',
        isCarrierAwbFromApi: true,
        shippingMethod: 'carrier',
        createdAt: '2026-10-21T00:00:00.000Z',
        qrCodeData: 'OMS-1',
        internalWaybillNumber: 'OMS-1',
        recipient: { name: 'Ali', phone: '0999', city: 'Damascus', address: 'Street' },
        sender: { name: 'Co', hub: 'Hub St' },
        financials: { codAmount: 0, currency: 'USD', shippingFee: 0, paymentMethod: 'COD', total: 10 },
        totalQuantity: 0,
        carrierTrackingNumber: '260302271039',
        mainAwb: '260302271039',
        partBarcode: 'PB-189349-FWMBA',
        partIndex: 2,
        partTotal: 3,
      } as any);
      expect(p2Html).toContain('طرد 2 من 3');
      expect(p2Html).toContain('Part 2 of 3');

      const p3Html = await service.labelHtml({
        ...order,
        orderId: 'oms-1',
        isCarrierAwbFromApi: true,
        shippingMethod: 'carrier',
        createdAt: '2026-10-21T00:00:00.000Z',
        qrCodeData: 'OMS-1',
        internalWaybillNumber: 'OMS-1',
        recipient: { name: 'Ali', phone: '0999', city: 'Damascus', address: 'Street' },
        sender: { name: 'Co', hub: 'Hub St' },
        financials: { codAmount: 0, currency: 'USD', shippingFee: 0, paymentMethod: 'COD', total: 10 },
        totalQuantity: 0,
        carrierTrackingNumber: '260302271039',
        mainAwb: '260302271039',
        partBarcode: 'PB-189350-0LHQ0',
        partIndex: 3,
        partTotal: 3,
      } as any);
      expect(p3Html).toContain('طرد 3 من 3');
      expect(p3Html).toContain('Part 3 of 3');
    });

    it('7. Missing, empty, duplicate, or malformed part barcode data is handled safely', async () => {
      // Empty array
      expect(() =>
        service.resolveBabelParts({
          providerCode: 'BABEL_EXPRESS',
          trackingNumber: '260302271039',
          rawResultMeta: { awb: '260302271039', partBarcodes: [] },
        }),
      ).toThrow(BadRequestException);

      // Duplicate barcodes
      expect(() =>
        service.resolveBabelParts({
          providerCode: 'BABEL_EXPRESS',
          trackingNumber: '260302271039',
          rawResultMeta: { awb: '260302271039', partBarcodes: ['PB-1', 'PB-1'] },
        }),
      ).toThrow(BadRequestException);

      // Malformed (whitespace or non-string)
      expect(() =>
        service.resolveBabelParts({
          providerCode: 'BABEL_EXPRESS',
          trackingNumber: '260302271039',
          rawResultMeta: { awb: '260302271039', partBarcodes: ['PB-1', '   ', 'PB-3'] },
        }),
      ).toThrow(BadRequestException);

      // Non-array
      expect(() =>
        service.resolveBabelParts({
          providerCode: 'BABEL_EXPRESS',
          trackingNumber: '260302271039',
          rawResultMeta: { awb: '260302271039', partBarcodes: 'PB-1' as any },
        }),
      ).toThrow(BadRequestException);
    });

    it('8. Superseded shipment barcodes cannot leak into the current label', async () => {
      // Prisma findFirst is called with ACTIVE_CARRIER_SHIPMENT_WHERE which excludes superseded rows.
      // Even if old meta has stale barcodes, the active shipment's barcodes are strictly used.
      prisma.omsOrder.findFirst.mockResolvedValueOnce(babelOrder);
      prisma.carrierShipment.findFirst.mockResolvedValueOnce({
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: 'NEW-AWB-999',
        externalAwb: 'NEW-AWB-999',
        rawResultMeta: {
          awb: 'NEW-AWB-999',
          partBarcodes: ['PB-ACTIVE-1'],
        },
      });

      const data = await service.getWaybillData('oms-1', user);
      expect(data.partBarcodes).toEqual(['PB-ACTIVE-1']);
      expect(data.carrierTrackingNumber).toBe('NEW-AWB-999');
      expect(data.partBarcodes).not.toContain('PB-OLD-SUPERSEDED');
    });

    it('9. The main AWB is never accidentally substituted for a missing part barcode', async () => {
      // If Babel shipment confirmed multiple parts in provider meta, but partBarcodes is missing:
      expect(() =>
        service.resolveBabelParts({
          providerCode: 'BABEL_EXPRESS',
          trackingNumber: '260302271039',
          rawResultMeta: {
            awb: '260302271039',
            parts: [{ weight: 1 }, { weight: 2 }],
          },
        }),
      ).toThrow(BadRequestException);
    });

    it('10. Existing Sila waybill tests remain unchanged and pass', async () => {
      prisma.omsOrder.findFirst.mockResolvedValueOnce(order);
      prisma.carrierShipment.findFirst.mockResolvedValueOnce({
        status: 'created',
        supersededAt: null,
        providerCode: 'SILA_SY',
        trackingNumber: 'SILA-AWB-100',
        rawResultMeta: { courier_name: 'ترابط' },
      });

      const data = await service.getWaybillData('oms-1', user);
      expect(data.carrier).toBe('ترابط');
      expect(data.carrierTrackingNumber).toBe('SILA-AWB-100');
      expect(data.partBarcodes).toBeUndefined();
      expect(data.partBarcode).toBeUndefined();
      expect(data.partIndex).toBeUndefined();
    });

    it('11. Existing single-label and batch-print behavior remains correct', async () => {
      const order1 = {
        id: 'ord-1',
        orderNumber: 'ORD-1',
        status: 'ready_to_ship',
        outboundOrder: {
          status: 'ready_to_ship',
          trackingNumber: '260302271039',
          carrierShipments: [
            {
              status: 'created',
              supersededAt: null,
              providerCode: 'BABEL_EXPRESS',
              trackingNumber: '260302271039',
              externalAwb: '260302271039',
              rawResultMeta: {
                awb: '260302271039',
                partBarcodes: ['PB-1', 'PB-2'],
              },
            },
          ],
        },
      };

      const order2 = {
        id: 'ord-2',
        orderNumber: 'ORD-2',
        status: 'ready_to_ship',
        outboundOrder: {
          status: 'ready_to_ship',
          trackingNumber: 'SILA-999',
          carrierShipments: [
            {
              status: 'created',
              supersededAt: null,
              providerCode: 'SILA_SY',
              trackingNumber: 'SILA-999',
              externalAwb: 'SILA-999',
              rawResultMeta: {},
            },
          ],
        },
      };

      prisma.omsOrder.findMany = jest.fn().mockResolvedValue([order1, order2]);

      // Mock generateWaybillPdf:
      // ord-1 has 2 pages, ord-2 has 1 page
      const doc1 = await PDFDocument.create();
      doc1.addPage([283.46, 425.20]);
      doc1.addPage([283.46, 425.20]);
      const buf1 = Buffer.from(await doc1.save());

      const doc2 = await PDFDocument.create();
      doc2.addPage([283.46, 425.20]);
      const buf2 = Buffer.from(await doc2.save());

      jest.spyOn(service, 'generateWaybillPdf')
        .mockResolvedValueOnce({ buffer: buf1, filename: 'w1.pdf' })
        .mockResolvedValueOnce({ buffer: buf2, filename: 'w2.pdf' });

      const combined = await service.generateCombinedWaybillPdf(['ord-1', 'ord-2'], user);
      expect(combined.count).toBe(2);
      const combinedDoc = await PDFDocument.load(combined.buffer);
      // 2 pages from order 1 + 1 page from order 2 = 3 pages total
      expect(combinedDoc.getPageCount()).toBe(3);
    });

    it('12. Generated PDF page count and dimensions match expected label count and 100x150 mm size', async () => {
      prisma.omsOrder.findFirst.mockResolvedValue(babelOrder);
      prisma.carrierShipment.findFirst.mockResolvedValue({
        status: 'created',
        supersededAt: null,
        providerCode: 'BABEL_EXPRESS',
        trackingNumber: '260302271039',
        externalAwb: '260302271039',
        rawResultMeta: {
          awb: '260302271039',
          partBarcodes: ['PB-189348-TTZFG', 'PB-189349-FWMBA', 'PB-189350-0LHQ0'],
        },
      });

      pdf.renderHtml.mockImplementation(async (_html, options) => {
        expect(options.width).toBe('100mm');
        expect(options.height).toBe('150mm');
        expect(options.preferCSSPageSize).toBe(true);
        return createMockPagePdfBuffer(283.46, 425.20);
      });

      const result = await service.generateWaybillPdf('oms-1', user);
      const doc = await PDFDocument.load(result.buffer);
      expect(doc.getPageCount()).toBe(3);

      for (let i = 0; i < 3; i++) {
        const size = doc.getPage(i).getSize();
        // 100mm in points ~ 283.46 pt, 150mm in points ~ 425.20 pt
        expect(Math.abs(size.width - 283.46)).toBeLessThan(1);
        expect(Math.abs(size.height - 425.20)).toBeLessThan(1);
      }
    });
  });
});

