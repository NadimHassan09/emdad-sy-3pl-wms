import { OmsReturnStatus, Prisma } from '@prisma/client';

import { ExpectedReturnHoldService } from './expected-return-hold.service';

function dec(n: number | string) {
  return new Prisma.Decimal(n);
}

describe('ExpectedReturnHoldService (Path A — no current_stock)', () => {
  function build(returnRow: {
    id: string;
    status: OmsReturnStatus;
    lines: Array<{ productId: string; quantity: number }>;
  } | null) {
    const prisma = {
      omsReturn: {
        findUnique: jest.fn().mockResolvedValue(
          returnRow
            ? {
                id: returnRow.id,
                status: returnRow.status,
                lines: returnRow.lines.map((l) => ({
                  productId: l.productId,
                  quantity: dec(l.quantity),
                })),
              }
            : null,
        ),
      },
      omsReturnLine: {
        findMany: jest.fn().mockResolvedValue(
          returnRow &&
            (returnRow.status === OmsReturnStatus.requested ||
              returnRow.status === OmsReturnStatus.approved)
            ? returnRow.lines.map((l) => ({
                productId: l.productId,
                quantity: dec(l.quantity),
              }))
            : [],
        ),
      },
    };

    const service = new ExpectedReturnHoldService(prisma as never);
    return { service, prisma };
  }

  it('treats requested return lines as active expected hold without implying physical stock', async () => {
    const { service } = build({
      id: 'ret-1',
      status: OmsReturnStatus.requested,
      lines: [
        { productId: 'p1', quantity: 10 },
        { productId: 'p2', quantity: 3 },
      ],
    });

    const activate = await service.activateHold('ret-1');
    expect(activate).toEqual({ activated: true, state: 'active', totalQuantity: '13' });

    const byProduct = await service.sumExpectedByProduct('co-1', ['p1', 'p2']);
    expect(byProduct.get('p1')?.toString()).toBe('10');
    expect(byProduct.get('p2')?.toString()).toBe('3');
  });

  it('activateHold is idempotent and does not re-activate converted holds', async () => {
    const { service } = build({
      id: 'ret-1',
      status: OmsReturnStatus.completed,
      lines: [{ productId: 'p1', quantity: 10 }],
    });

    const first = await service.activateHold('ret-1');
    expect(first.activated).toBe(false);
    expect(first.state).toBe('converted');

    const second = await service.activateHold('ret-1');
    expect(second).toEqual(first);
  });

  it('assertConvertible blocks after warehouse confirmation (converted)', async () => {
    const { service } = build({
      id: 'ret-1',
      status: OmsReturnStatus.completed,
      lines: [{ productId: 'p1', quantity: 10 }],
    });

    const result = await service.assertConvertible('ret-1');
    expect(result.ok).toBe(false);
    expect(result.state).toBe('converted');
  });

  it('assertReleasable allows active holds and is idempotent for already-released', async () => {
    const active = build({
      id: 'ret-1',
      status: OmsReturnStatus.requested,
      lines: [{ productId: 'p1', quantity: 10 }],
    });
    await expect(active.service.assertReleasable('ret-1')).resolves.toEqual({
      ok: true,
      state: 'active',
    });

    const released = build({
      id: 'ret-2',
      status: OmsReturnStatus.cancelled,
      lines: [{ productId: 'p1', quantity: 10 }],
    });
    const again = await released.service.assertReleasable('ret-2');
    expect(again.ok).toBe(true);
    expect(again.state).toBe('released');
  });

  it('assertReleasable MUST NOT allow draft reversal after confirmation', async () => {
    const { service } = build({
      id: 'ret-1',
      status: OmsReturnStatus.completed,
      lines: [{ productId: 'p1', quantity: 10 }],
    });

    const result = await service.assertReleasable('ret-1');
    expect(result.ok).toBe(false);
    expect(result.state).toBe('converted');
  });

  it('sumExpectedByProduct ignores completed/cancelled returns (not sellable inflate)', async () => {
    const { service, prisma } = build({
      id: 'ret-1',
      status: OmsReturnStatus.completed,
      lines: [{ productId: 'p1', quantity: 10 }],
    });

    const map = await service.sumExpectedByProduct('co-1');
    expect(map.size).toBe(0);
    expect(prisma.omsReturnLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          omsReturn: expect.objectContaining({
            status: { in: [OmsReturnStatus.requested, OmsReturnStatus.approved] },
          }),
        }),
      }),
    );
  });
});
