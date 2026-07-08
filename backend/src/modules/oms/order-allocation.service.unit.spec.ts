import { ConfigService } from '@nestjs/config';
import {
  OmsAllocationStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';

import * as allocationHelper from '../warehouse-workflow/task-allocation.helper';
import { InsufficientStockException } from '../../common/errors/domain-exceptions';
import { OmsOrderEventsService } from './oms-order-events.service';
import { OrderAllocationService } from './order-allocation.service';

function dec(n: number) {
  return new Prisma.Decimal(n);
}

function buildService(opts: {
  flagOn?: boolean;
  tx?: Record<string, jest.Mock>;
}) {
  const config = {
    get: jest.fn((key: string) =>
      key === 'ALLOCATE_ON_ORDER_CREATE' ? (opts.flagOn ? 'true' : 'false') : undefined,
    ),
  } as unknown as ConfigService;

  const events = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as OmsOrderEventsService;

  const tx = {
    stockReservation: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'res-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    outboundOrder: {
      update: jest.fn().mockResolvedValue({}),
    },
    ...opts.tx,
  };

  const service = new OrderAllocationService(config, events);
  return { service, tx, events };
}

describe('OrderAllocationService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('isEnabled reflects ALLOCATE_ON_ORDER_CREATE', () => {
    expect(buildService({ flagOn: true }).service.isEnabled()).toBe(true);
    expect(buildService({ flagOn: false }).service.isEnabled()).toBe(false);
  });

  it('allocateOrder is a no-op when feature flag is off', async () => {
    const { service, tx } = buildService({ flagOn: false });
    await service.allocateOrder(tx as never, {
      outboundOrderId: 'ord-1',
      companyId: 'co-1',
      lines: [],
    });
    expect(tx.stockReservation.create).not.toHaveBeenCalled();
  });

  it('allocateOrder skips when active reservations already exist', async () => {
    const { service, events } = buildService({ flagOn: true });
    const tx = {
      stockReservation: {
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      outboundOrder: { update: jest.fn() },
    };

    await service.allocateOrder(tx as never, {
      outboundOrderId: 'ord-1',
      companyId: 'co-1',
      lines: [
        {
          outboundOrderLineId: 'line-1',
          productId: 'prod-1',
          requestedQty: dec(5),
          specificLotId: null,
        },
      ],
    });

    expect(tx.stockReservation.create).not.toHaveBeenCalled();
    expect(events.record).not.toHaveBeenCalled();
  });

  it('throws InsufficientStockException when FEFO stock is short', async () => {
    jest.spyOn(allocationHelper, 'findCompanyStockFefo').mockResolvedValue([
      {
        locationId: 'loc-1',
        lotId: null,
        quantityAvailable: dec(2),
      } as never,
    ]);

    const { service, tx } = buildService({ flagOn: true });

    await expect(
      service.allocateOrder(tx as never, {
        outboundOrderId: 'ord-1',
        companyId: 'co-1',
        lines: [
          {
            outboundOrderLineId: 'line-1',
            productId: 'prod-1',
            requestedQty: dec(5),
            specificLotId: null,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InsufficientStockException);
  });

  it('releaseAllocation marks reservations released and records event', async () => {
    const { service, tx, events } = buildService({ flagOn: true });
    tx.stockReservation.findMany = jest.fn().mockResolvedValue([{ id: 'r1' }]);

    await service.releaseAllocation(tx as never, {
      outboundOrderId: 'ord-1',
      companyId: 'co-1',
      actorUserId: 'user-1',
    });

    expect(tx.stockReservation.updateMany).toHaveBeenCalledWith({
      where: { outboundOrderId: 'ord-1', status: ReservationStatus.active },
      data: { status: ReservationStatus.released },
    });
    expect(tx.outboundOrder.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: { allocationStatus: OmsAllocationStatus.released },
    });
    expect(events.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ eventType: 'inventory.released' }),
    );
  });
});
