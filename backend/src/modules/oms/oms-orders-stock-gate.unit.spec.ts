import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { OmsOrdersService } from './oms-orders.service';

/**
 * Scenarios A–C focused on stock gate placement:
 * Create/Confirm must not require stock; Approve must.
 */
describe('OmsOrdersService stock gate placement', () => {
  it('assertSufficientStockForLines throws when available is short (Approve gate)', async () => {
    const prisma = {
      currentStock: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: 'p1', _sum: { quantityAvailable: new Prisma.Decimal(2) } },
        ]),
      },
    };

    const service = Object.create(OmsOrdersService.prototype) as OmsOrdersService;
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(
      service.assertSufficientStockForLines(
        'co-1',
        [{ productId: 'p1', requestedQuantity: 5 }],
        [{ id: 'p1', sku: 'SKU-1' }],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.assertSufficientStockForLines(
        'co-1',
        [{ productId: 'p1', requestedQuantity: 5 }],
        [{ id: 'p1', sku: 'SKU-1' }],
      ),
    ).rejects.toThrow(/Cannot approve: insufficient stock/);
  });

  it('assertSufficientStockForLines passes when available covers request', async () => {
    const prisma = {
      currentStock: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: 'p1', _sum: { quantityAvailable: new Prisma.Decimal(10) } },
        ]),
      },
    };

    const service = Object.create(OmsOrdersService.prototype) as OmsOrdersService;
    (service as unknown as { prisma: typeof prisma }).prisma = prisma;

    await expect(
      service.assertSufficientStockForLines(
        'co-1',
        [{ productId: 'p1', requestedQuantity: 5 }],
        [{ id: 'p1', sku: 'SKU-1' }],
      ),
    ).resolves.toBeUndefined();
  });
});
