import { OmsOrderStatus } from '@prisma/client';

/** Raw OMS statuses that may start / complete a return request. */
export const OMS_RETURN_ELIGIBLE_STATUSES: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.delivered,
  OmsOrderStatus.shipped,
  OmsOrderStatus.out_for_delivery,
]);

export function isOmsReturnEligibleStatus(
  status: OmsOrderStatus | string | null | undefined,
): boolean {
  if (!status) return false;
  return OMS_RETURN_ELIGIBLE_STATUSES.has(status as OmsOrderStatus);
}
