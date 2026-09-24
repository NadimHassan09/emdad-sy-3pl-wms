import { OmsOrderStatus } from '@prisma/client';

import { OmsOrdersCsvService } from './oms-orders-csv.service';
import { rowsToCsv, OMS_IMPORT_CSV_HEADERS } from './oms-orders-csv.util';

describe('OmsOrdersCsvService.exportCsv', () => {
  it('exports only filtered rows from listForExport', async () => {
    const listForExport = jest.fn().mockResolvedValue({
      items: [
        {
          orderNumber: 'OMS-1',
          status: OmsOrderStatus.confirmed_waiting_for_admin_approval,
          companyId: 'c1',
          company: { id: 'c1', name: 'Acme' },
          externalReference: 'R1',
          clientReference: null,
          recipientName: 'أحمد',
          recipientPhone: '09',
          city: 'دمشق',
          district: null,
          addressLine1: 'addr',
          storeChannel: null,
          paymentMethod: 'COD',
          codStatus: 'pending',
          codAmount: '10',
          currency: 'USD',
          subtotal: '10',
          shippingFee: '0',
          total: '10',
          lines: [{ requestedQuantity: '2', product: { name: 'مروحة', weightKg: '1.25' } }],
          shippingMethod: 'manual',
          shippingProviderCode: null,
          carrier: null,
          linkedOutboundOrder: null,
          requiredShipDate: new Date('2026-12-01'),
          createdAt: new Date('2026-08-01'),
          confirmedAt: null,
          approvedAt: null,
          outForDeliveryAt: null,
          deliveredAt: null,
        },
      ],
      total: 1,
      truncated: false,
    });
    const orders = { listForExport } as never;
    const csv = new OmsOrdersCsvService(orders);
    const query = { status: OmsOrderStatus.confirmed_waiting_for_admin_approval } as never;
    const result = await csv.exportCsv({ id: 'u1' } as never, query);
    expect(listForExport).toHaveBeenCalledWith(
      expect.anything(),
      query,
      expect.objectContaining({ maxRows: expect.any(Number) }),
    );
    expect(result.filename).toMatch(/^oms-orders-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.rowCount).toBe(1);
    expect(result.body).toContain('OMS-1');
    expect(result.body).toContain('أحمد');
    expect(result.body).toContain('دمشق');
    expect(result.body).toContain('مروحة');
    expect(result.body).toContain('1.25');
    expect(result.body).toContain('Product name');
    expect(result.body).toContain('Product weight (kg)');
    expect(result.body).toContain('Ship date');
    expect(result.body).toContain('Delivery date');
    expect(result.body).not.toContain('وقت التسليم');
  });

  it('exports dispatch handover as تاريخ الشحن timestamp', async () => {
    const dispatched = new Date('2026-08-30T15:04:00.000Z');
    const listForExport = jest.fn().mockResolvedValue({
      items: [
        {
          orderNumber: 'OMS-SHIP',
          status: OmsOrderStatus.shipped,
          companyId: 'c1',
          company: { id: 'c1', name: 'Acme' },
          lines: [],
          requiredShipDate: new Date('2026-12-01'),
          createdAt: new Date('2026-08-01'),
          confirmedAt: null,
          approvedAt: null,
          outForDeliveryAt: dispatched,
          deliveredAt: null,
        },
      ],
      total: 1,
      truncated: false,
    });
    const csv = new OmsOrdersCsvService({ listForExport } as never);
    const result = await csv.exportCsv({ id: 'u1' } as never, {} as never, {
      columnIds: ['order_number', 'out_for_delivery_at'],
      arabicHeaders: true,
    });
    expect(result.body).toContain('تاريخ الشحن');
    expect(result.body).toContain('2026-08-30T15:04:00.000Z');
    expect(result.body).not.toContain('وقت التسليم');
    expect(result.body).toContain('OMS-SHIP');
  });

  it('exports buyer deliveredAt as تاريخ التسليم date-only', async () => {
    const delivered = new Date('2026-08-30T15:04:00.000Z');
    const listForExport = jest.fn().mockResolvedValue({
      items: [
        {
          orderNumber: 'OMS-DEL',
          status: OmsOrderStatus.delivered,
          companyId: 'c1',
          company: { id: 'c1', name: 'Acme' },
          lines: [],
          requiredShipDate: new Date('2026-12-01'),
          createdAt: new Date('2026-08-01'),
          confirmedAt: null,
          approvedAt: null,
          outForDeliveryAt: null,
          deliveredAt: delivered,
        },
      ],
      total: 1,
      truncated: false,
    });
    const csv = new OmsOrdersCsvService({ listForExport } as never);
    const result = await csv.exportCsv({ id: 'u1' } as never, {} as never, {
      columnIds: ['order_number', 'delivered_at'],
      arabicHeaders: true,
    });
    expect(result.body).toContain('تاريخ التسليم');
    expect(result.body).toContain('2026-08-30');
    expect(result.body).not.toContain('T15:04:00.000Z');
    expect(result.body).toContain('OMS-DEL');
  });
});

describe('OmsOrdersCsvService import grouping', () => {
  it('template includes multi-line example for one order', () => {
    const svc = new OmsOrdersCsvService({} as never);
    const tpl = svc.getImportTemplate();
    expect(tpl.filename).toBe('oms-orders-import-template.csv');
    const lines = tpl.body.replace(/^\uFEFF/, '').trim().split('\n');
    expect(lines[0]).toContain('external_reference');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain('ORD-IMPORT-001');
    expect(lines[2]).toContain('ORD-IMPORT-001');
  });

  it('builds CSV header list matching import contract', () => {
    const csv = rowsToCsv([...OMS_IMPORT_CSV_HEADERS], [['x']]);
    for (const h of OMS_IMPORT_CSV_HEADERS) {
      expect(csv).toContain(h);
    }
  });
});
