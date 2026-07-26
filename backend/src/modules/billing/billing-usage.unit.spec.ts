import { Prisma } from '@prisma/client';

import { computeProductVolumeCbm } from '../products/product-volume.util';
import { BillingUsageService } from './billing-usage.service';

/** Mirrors live used-storage SQL: Σ(max(qty,0) × product CBM). */
function usedStorageFromInventory(
  lines: Array<{ qty: number; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null }>,
): Prisma.Decimal {
  return lines.reduce((sum, line) => {
    const cbm = computeProductVolumeCbm(line.lengthCm, line.widthCm, line.heightCm);
    const qty = Math.max(0, line.qty);
    return sum.add(cbm.mul(qty));
  }, new Prisma.Decimal(0));
}

describe('inventory × product CBM storage accounting', () => {
  it('increases used storage on inbound and decreases on outbound', () => {
    const dims = { lengthCm: 100, widthCm: 50, heightCm: 40 }; // 0.2 CBM
    let inventory = [{ qty: 10, ...dims }];
    expect(Number(usedStorageFromInventory(inventory))).toBeCloseTo(2.0, 6);

    inventory = [{ qty: 15, ...dims }]; // inbound +5
    expect(Number(usedStorageFromInventory(inventory))).toBeCloseTo(3.0, 6);

    inventory = [{ qty: 12, ...dims }]; // outbound −3
    expect(Number(usedStorageFromInventory(inventory))).toBeCloseTo(2.4, 6);
  });

  it('treats inventory adjustments and missing dimensions correctly', () => {
    const afterAdjustment = usedStorageFromInventory([
      { qty: 5, lengthCm: 100, widthCm: 100, heightCm: 100 }, // 1 CBM × 5
      { qty: 100, lengthCm: 100, widthCm: null, heightCm: 50 }, // 0 CBM
    ]);
    expect(Number(afterAdjustment)).toBeCloseTo(5, 6);

    const cycleCountNeg = usedStorageFromInventory([
      { qty: -3, lengthCm: 100, widthCm: 100, heightCm: 100 },
    ]);
    expect(cycleCountNeg.equals(0)).toBe(true);
  });
});

describe('BillingUsageService.buildUtilizationSnapshot', () => {
  const service = new BillingUsageService({} as never);

  it('computes remaining and utilization from used vs reserved CBM', () => {
    const snap = service.buildUtilizationSnapshot(
      new Prisma.Decimal('64.8'),
      new Prisma.Decimal('100'),
    );
    expect(snap.usedStorageCbm.toString()).toBe('64.8');
    expect(snap.reservedStorageCbm.toString()).toBe('100');
    expect(snap.remainingStorageCbm.toString()).toBe('35.2');
    expect(snap.storageUsagePercent).toBe(64.8);
  });

  it('never returns negative remaining storage', () => {
    const snap = service.buildUtilizationSnapshot(
      new Prisma.Decimal('120'),
      new Prisma.Decimal('100'),
    );
    expect(snap.remainingStorageCbm.toString()).toBe('0');
    expect(snap.storageUsagePercent).toBe(100);
  });

  it('returns 0% utilization when reserved is zero', () => {
    const snap = service.buildUtilizationSnapshot(
      new Prisma.Decimal('10'),
      new Prisma.Decimal(0),
    );
    expect(snap.storageUsagePercent).toBe(0);
    expect(snap.remainingStorageCbm.toString()).toBe('0');
  });
});
