import { OmsOrderStatus, Prisma } from '@prisma/client';

/**
 * Builds Prisma where conditions matching OMS orders based on the timestamp
 * they entered their CURRENT status (status transition date) rather than createdAt.
 *
 * This ensures:
 * 1. An order in status S is counted in the period it entered S.
 * 2. When an order transitions from S1 in Month 1 to S2 in Month 2 (e.g. out_for_delivery -> delivered),
 *    it is counted under S2 in Month 2, and automatically excluded from Month 1 (because its current
 *    status is S2 with transition date in Month 2).
 */
export function buildOmsOrderStatusDateFilter(
  fromDate?: Date,
  toDate?: Date,
): Prisma.OmsOrderWhereInput[] {
  if (!fromDate && !toDate) {
    return [];
  }

  const dateFilter: Prisma.DateTimeFilter = {};
  if (fromDate) dateFilter.gte = fromDate;
  if (toDate) dateFilter.lte = toDate;

  return [
    // 1. Delivered / Completed
    {
      status: { in: [OmsOrderStatus.delivered, OmsOrderStatus.completed] },
      OR: [
        { deliveredAt: dateFilter },
        { deliveredAt: null, updatedAt: dateFilter },
      ],
    },
    // 2. Out for delivery / Shipped
    {
      status: { in: [OmsOrderStatus.out_for_delivery, OmsOrderStatus.shipped] },
      OR: [
        { outForDeliveryAt: dateFilter },
        { outForDeliveryAt: null, updatedAt: dateFilter },
      ],
    },
    // 3. Returned
    {
      status: OmsOrderStatus.returned,
      OR: [
        { returnedAt: dateFilter },
        { returnedAt: null, updatedAt: dateFilter },
      ],
    },
    // 3b. Failed delivery
    {
      status: OmsOrderStatus.failed_delivery,
      OR: [
        { deliveryFailedAt: dateFilter },
        { deliveryFailedAt: null, updatedAt: dateFilter },
      ],
    },
    // 4. Cancelled
    {
      status: OmsOrderStatus.cancelled,
      OR: [
        { cancelledAt: dateFilter },
        { cancelledAt: null, updatedAt: dateFilter },
      ],
    },
    // 5. Rejected
    {
      status: OmsOrderStatus.rejected,
      OR: [
        { rejectedAt: dateFilter },
        { rejectedAt: null, updatedAt: dateFilter },
      ],
    },
    // 6. Waiting for confirmation / Pending approval
    {
      status: {
        in: [
          OmsOrderStatus.waiting_for_confirmation,
          OmsOrderStatus.pending_approval,
        ],
      },
      OR: [
        { submittedAt: dateFilter },
        { submittedAt: null, createdAt: dateFilter },
      ],
    },
    // 7. Confirmed waiting for admin approval
    {
      status: OmsOrderStatus.confirmed_waiting_for_admin_approval,
      OR: [
        { confirmedAt: dateFilter },
        { confirmedAt: null, submittedAt: dateFilter },
        { confirmedAt: null, submittedAt: null, createdAt: dateFilter },
      ],
    },
    // 8. Draft
    {
      status: OmsOrderStatus.draft,
      createdAt: dateFilter,
    },
    // 9. Allocated
    {
      status: OmsOrderStatus.allocated,
      OR: [
        { allocatedAt: dateFilter },
        { allocatedAt: null, approvedAt: dateFilter },
        { allocatedAt: null, approvedAt: null, updatedAt: dateFilter },
      ],
    },
    // 10. Pending fulfillment / processing / picking / packing / ready_to_ship / confirmed / approved
    {
      status: {
        in: [
          OmsOrderStatus.pending,
          OmsOrderStatus.approved,
          OmsOrderStatus.confirmed,
          OmsOrderStatus.processing,
          OmsOrderStatus.picking,
          OmsOrderStatus.packing,
          OmsOrderStatus.ready_to_ship,
        ],
      },
      OR: [
        { approvedAt: dateFilter },
        { approvedAt: null, confirmedAt: dateFilter },
        { approvedAt: null, confirmedAt: null, allocatedAt: dateFilter },
        {
          approvedAt: null,
          confirmedAt: null,
          allocatedAt: null,
          updatedAt: dateFilter,
        },
      ],
    },
  ];
}
