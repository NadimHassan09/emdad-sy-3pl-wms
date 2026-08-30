/** Raw OMS statuses eligible for Create return (must match backend). */
const OMS_RETURN_ELIGIBLE_STATUSES = new Set([
  'delivered',
  'shipped',
  'out_for_delivery',
]);

export function isOmsReturnEligibleStatus(
  status: string | null | undefined,
): boolean {
  return !!status && OMS_RETURN_ELIGIBLE_STATUSES.has(status);
}
