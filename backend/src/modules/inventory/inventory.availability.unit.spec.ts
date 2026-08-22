import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from './inventory.service';

function dec(n: number) {
  return new Prisma.Decimal(n);
}

describe('InventoryService.availability (OMS→Outbound soft-hold credit)', () => {
  function build(opts: {
    available: number;
    reserved: number;
    onHand: number;
    ownReserved?: number;
    orderFound?: boolean;
  }) {
    const prisma = {
      currentStock: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            quantityOnHand: dec(opts.onHand),
            quantityReserved: dec(opts.reserved),
            quantityAvailable: dec(opts.available),
          },
        }),
      },
      outboundOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValue(opts.orderFound === false ? null : { id: 'ob-1' }),
      },
      stockReservation: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { quantity: dec(opts.ownReserved ?? 0) },
        }),
      },
    } as unknown as PrismaService;

    const companyAccess = {
      resolveWriteCompanyId: jest.fn().mockReturnValue('co-1'),
    } as unknown as CompanyAccessService;

    const service = new InventoryService(
      prisma,
      {} as never, // stockHelpers
      companyAccess,
      {} as never, // audit
      {} as never, // realtime
    );
    return { service, prisma };
  }

  it('returns global available when no outboundOrderId', async () => {
    const { service } = build({ onHand: 100, reserved: 20, available: 80 });
    const result = await service.availability({} as never, 'prod-1', 'co-1');
    expect(result.available).toBe('80');
    expect(result.reservedByThisOrder).toBeUndefined();
  });

  it('credits this outbound soft-hold so linked OMS→Outbound is not out of stock', async () => {
    // After OMS soft-hold of 20 against on-hand 100: available=80 globally is wrong example;
    // typical failure: on-hand 50, reserved 50 by this order → available 0.
    const { service, prisma } = build({
      onHand: 50,
      reserved: 50,
      available: 0,
      ownReserved: 50,
    });

    const result = await service.availability({} as never, 'prod-1', 'co-1', 'ob-1');

    expect(prisma.stockReservation.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          outboundOrderId: 'ob-1',
          productId: 'prod-1',
          status: 'active',
        }),
      }),
    );
    expect(result.available).toBe('50');
    expect(result.reservedByThisOrder).toBe('50');
    expect(result.availableForOrder).toBe('50');
  });

  it('does not credit another order’s reservation (ownReserved=0)', async () => {
    const { service } = build({
      onHand: 100,
      reserved: 30,
      available: 70,
      ownReserved: 0,
    });
    const result = await service.availability({} as never, 'prod-1', 'co-1', 'ob-1');
    expect(result.available).toBe('70');
    expect(result.reservedByThisOrder).toBe('0');
  });

  it('throws when outboundOrderId does not belong to company', async () => {
    const { service } = build({
      onHand: 10,
      reserved: 0,
      available: 10,
      orderFound: false,
    });
    await expect(
      service.availability({} as never, 'prod-1', 'co-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
