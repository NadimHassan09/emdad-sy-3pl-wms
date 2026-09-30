import { ClientOmsExportService } from './client-oms-export.service';
import { CLIENT_OMS_EXPORT_COLUMNS } from './client-order-export.columns';

describe('ClientOmsExportService', () => {
  it('includes ship date (dispatch) and buyer delivery date columns', () => {
    expect(CLIENT_OMS_EXPORT_COLUMNS.some((c) => c.id === 'out_for_delivery_at')).toBe(true);
    expect(CLIENT_OMS_EXPORT_COLUMNS.some((c) => c.id === 'delivered_at')).toBe(true);
    const ship = CLIENT_OMS_EXPORT_COLUMNS.find((c) => c.id === 'out_for_delivery_at');
    expect(ship?.labelAr).toBe('تاريخ الشحن');
    expect(ship?.labelEn).toBe('Ship date');
    const delivered = CLIENT_OMS_EXPORT_COLUMNS.find((c) => c.id === 'delivered_at');
    expect(delivered?.labelAr).toBe('تاريخ التسليم');
    expect(delivered?.labelEn).toBe('Delivery date');
  });

  it('writes outForDeliveryAt into CSV as dispatch timestamp', async () => {
    const dispatched = new Date('2026-08-30T15:04:00.000Z');
    const listForExport = jest.fn().mockResolvedValue({
      items: [
        {
          orderNumber: 'OMS-C1',
          status: 'shipped',
          outForDeliveryAt: dispatched,
        },
      ],
      truncated: false,
    });
    const svc = new ClientOmsExportService({ listForExport } as never);
    const result = await svc.exportCsv({ companyId: 'c1' } as never, {
      columnIds: ['order_number', 'out_for_delivery_at'],
      arabicHeaders: true,
    });
    expect(result.body).toContain('تاريخ الشحن');
    expect(result.body).toContain('2026-08-30T15:04:00.000Z');
    expect(result.body).not.toContain('وقت التسليم');
    expect(result.body).toContain('OMS-C1');
  });

  it('writes deliveredAt into CSV as date-only', async () => {
    const delivered = new Date('2026-08-30T15:04:00.000Z');
    const listForExport = jest.fn().mockResolvedValue({
      items: [
        {
          orderNumber: 'OMS-C1',
          status: 'delivered',
          deliveredAt: delivered,
        },
      ],
      truncated: false,
    });
    const svc = new ClientOmsExportService({ listForExport } as never);
    const result = await svc.exportCsv({ companyId: 'c1' } as never, {
      columnIds: ['order_number', 'delivered_at'],
      arabicHeaders: true,
    });
    expect(result.body).toContain('تاريخ التسليم');
    expect(result.body).toContain('2026-08-30');
    expect(result.body).not.toContain('T15:04:00.000Z');
    expect(result.body).toContain('OMS-C1');
  });
});
