import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import type { OmsWaybillData } from './oms-order.types';
import { OmsWaybillService } from './oms-waybill.service';

const MM = 72 / 25.4;

function fixture(productCount: number): OmsWaybillData {
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
      address: 'خان أرنبة',
    },
    sender: { name: 'Mr jad', hub: 'مستودع إمداد المركزي — دمشق' },
    financials: { codAmount: 85, currency: 'USD', shippingFee: 0, paymentMethod: 'COD', total: 85 },
    items: Array.from({ length: productCount }, (_, index) => ({
      id: `line-${index + 1}`,
      name: `منتج تجريبي ${index + 1}`,
      sku: `SKU-${index + 1}`,
      quantity: 1,
      price: 10,
    })),
    totalQuantity: productCount,
  };
}

describe('shipping waybill label layout', () => {
  const service = new OmsWaybillService({} as never, { logo: '' } as never);

  it('bounds the QR and keeps a one-product label on one 100×150 mm page', async () => {
    const html = await service.labelHtml(fixture(1));
    expect(html).toContain('max-height: 18mm');
    expect(html).toContain('max-width: 18mm');
    expect(html).not.toContain('min-height: 140mm');

    const backendRoot = join(__dirname, '../../..');
    const probe = spawnSync(
      process.execPath,
      ['-r', 'ts-node/register/transpile-only', join(backendRoot, 'src/modules/oms/oms-waybill-layout.probe.ts')],
      { cwd: backendRoot, encoding: 'utf8', timeout: 120_000 },
    );
    if (probe.status !== 0) {
      throw new Error(probe.stderr || probe.stdout);
    }
    const line = probe.stdout.split('\n').find((entry) => entry.startsWith('WAYBILL_LAYOUT_JSON '));
    expect(line).toBeTruthy();
    const report = JSON.parse(line!.slice('WAYBILL_LAYOUT_JSON '.length)) as {
      onePages: number;
      width: number;
      height: number;
      oneText: string;
      dualPages: number;
      twoPages: number;
      threePages: number;
      manyPages: number;
      qrHeight: number;
    };

    expect(report.onePages).toBe(1);
    expect(Math.abs(report.width - 100 * MM)).toBeLessThan(2);
    expect(Math.abs(report.height - 150 * MM)).toBeLessThan(2);
    for (const marker of ['محمد الحريري', 'Mr jad', 'USD', 'منتج تجريبي 1', 'توقيع المستلم', 'EMD-OMS-2026-03301']) {
      expect(report.oneText).toContain(marker);
    }
    expect(report.dualPages).toBe(1);
    expect(report.twoPages).toBe(1);
    expect(report.threePages).toBe(2);
    expect(report.manyPages).toBeGreaterThan(1);
    expect(report.qrHeight).toBeGreaterThan(60);
    expect(report.qrHeight).toBeLessThan(90);
  }, 120_000);
});
