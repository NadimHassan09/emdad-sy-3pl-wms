import { OmsOrderStatus } from '@prisma/client';

import { buildOmsOrderStatusDateFilter } from './oms-order-status-filter.util';

describe('buildOmsOrderStatusDateFilter', () => {
  it('returns empty array when neither fromDate nor toDate is provided', () => {
    expect(buildOmsOrderStatusDateFilter()).toEqual([]);
    expect(buildOmsOrderStatusDateFilter(undefined, undefined)).toEqual([]);
  });

  it('builds date filters for all status buckets when date range is provided', () => {
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date('2026-09-30T23:59:59.999Z');

    const filters = buildOmsOrderStatusDateFilter(from, to);
    expect(filters.length).toBeGreaterThanOrEqual(10);

    // 1. Delivered / Completed bucket
    const deliveredFilter = filters.find(
      (f) =>
        f.status &&
        typeof f.status === 'object' &&
        'in' in f.status &&
        (f.status.in as OmsOrderStatus[]).includes(OmsOrderStatus.delivered),
    );
    expect(deliveredFilter).toBeDefined();
    expect(deliveredFilter?.OR).toEqual([
      { deliveredAt: { gte: from, lte: to } },
      { deliveredAt: null, updatedAt: { gte: from, lte: to } },
    ]);

    // 2. Out for delivery / Shipped bucket
    const outFilter = filters.find(
      (f) =>
        f.status &&
        typeof f.status === 'object' &&
        'in' in f.status &&
        (f.status.in as OmsOrderStatus[]).includes(OmsOrderStatus.out_for_delivery),
    );
    expect(outFilter).toBeDefined();
    expect(outFilter?.OR).toEqual([
      { outForDeliveryAt: { gte: from, lte: to } },
      { outForDeliveryAt: null, updatedAt: { gte: from, lte: to } },
    ]);

    // 3. Returned bucket
    const returnedFilter = filters.find((f) => f.status === OmsOrderStatus.returned);
    expect(returnedFilter).toBeDefined();
    expect(returnedFilter?.OR).toEqual([
      { returnedAt: { gte: from, lte: to } },
      { returnedAt: null, updatedAt: { gte: from, lte: to } },
    ]);

    // 4. Cancelled bucket
    const cancelledFilter = filters.find((f) => f.status === OmsOrderStatus.cancelled);
    expect(cancelledFilter).toBeDefined();
    expect(cancelledFilter?.OR).toEqual([
      { cancelledAt: { gte: from, lte: to } },
      { cancelledAt: null, updatedAt: { gte: from, lte: to } },
    ]);

    // 5. Rejected bucket
    const rejectedFilter = filters.find((f) => f.status === OmsOrderStatus.rejected);
    expect(rejectedFilter).toBeDefined();
    expect(rejectedFilter?.OR).toEqual([
      { rejectedAt: { gte: from, lte: to } },
      { rejectedAt: null, updatedAt: { gte: from, lte: to } },
    ]);

    // 6. Waiting confirmation bucket
    const waitingFilter = filters.find(
      (f) =>
        f.status &&
        typeof f.status === 'object' &&
        'in' in f.status &&
        (f.status.in as OmsOrderStatus[]).includes(OmsOrderStatus.waiting_for_confirmation),
    );
    expect(waitingFilter).toBeDefined();
    expect(waitingFilter?.OR).toEqual([
      { submittedAt: { gte: from, lte: to } },
      { submittedAt: null, createdAt: { gte: from, lte: to } },
    ]);

    // 7. Confirmed waiting approval bucket
    const confirmedWaitingFilter = filters.find(
      (f) => f.status === OmsOrderStatus.confirmed_waiting_for_admin_approval,
    );
    expect(confirmedWaitingFilter).toBeDefined();
    expect(confirmedWaitingFilter?.OR).toEqual([
      { confirmedAt: { gte: from, lte: to } },
      { confirmedAt: null, submittedAt: { gte: from, lte: to } },
      { confirmedAt: null, submittedAt: null, createdAt: { gte: from, lte: to } },
    ]);

    // 8. Draft
    const draftFilter = filters.find((f) => f.status === OmsOrderStatus.draft);
    expect(draftFilter).toBeDefined();
    expect(draftFilter?.createdAt).toEqual({ gte: from, lte: to });

    // 9. Pending fulfillment bucket
    const pendingFulfillmentFilter = filters.find(
      (f) =>
        f.status &&
        typeof f.status === 'object' &&
        'in' in f.status &&
        (f.status.in as OmsOrderStatus[]).includes(OmsOrderStatus.processing),
    );
    expect(pendingFulfillmentFilter).toBeDefined();
    expect(pendingFulfillmentFilter?.OR).toEqual([
      { approvedAt: { gte: from, lte: to } },
      { approvedAt: null, confirmedAt: { gte: from, lte: to } },
      { approvedAt: null, confirmedAt: null, allocatedAt: { gte: from, lte: to } },
      {
        approvedAt: null,
        confirmedAt: null,
        allocatedAt: null,
        updatedAt: { gte: from, lte: to },
      },
    ]);
  });

  it('supports open-ended start date (fromDate only)', () => {
    const from = new Date('2026-09-01T00:00:00.000Z');
    const filters = buildOmsOrderStatusDateFilter(from, undefined);

    const deliveredFilter = filters.find(
      (f) =>
        f.status &&
        typeof f.status === 'object' &&
        'in' in f.status &&
        (f.status.in as OmsOrderStatus[]).includes(OmsOrderStatus.delivered),
    );
    expect(deliveredFilter?.OR).toEqual([
      { deliveredAt: { gte: from } },
      { deliveredAt: null, updatedAt: { gte: from } },
    ]);
  });

  it('supports open-ended end date (toDate only)', () => {
    const to = new Date('2026-09-30T23:59:59.999Z');
    const filters = buildOmsOrderStatusDateFilter(undefined, to);

    const deliveredFilter = filters.find(
      (f) =>
        f.status &&
        typeof f.status === 'object' &&
        'in' in f.status &&
        (f.status.in as OmsOrderStatus[]).includes(OmsOrderStatus.delivered),
    );
    expect(deliveredFilter?.OR).toEqual([
      { deliveredAt: { lte: to } },
      { deliveredAt: null, updatedAt: { lte: to } },
    ]);
  });
});
