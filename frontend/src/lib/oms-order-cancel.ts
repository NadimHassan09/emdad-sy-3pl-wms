/**
 * Raw OMS statuses where admin may cancel (must match backend cancel transitions).
 * Includes Out for Delivery raw statuses: shipped and out_for_delivery.
 */
const OMS_ADMIN_CANCELLABLE_STATUSES = new Set([
  'waiting_for_confirmation',
  'confirmed_waiting_for_admin_approval',
  'pending_approval',
  'pending',
  'draft',
  'processing',
  'ready_to_ship',
  'allocated',
  'picking',
  'packing',
  'shipped',
  'out_for_delivery',
]);

export function isOmsAdminCancellableStatus(
  status: string | null | undefined,
): boolean {
  return !!status && OMS_ADMIN_CANCELLABLE_STATUSES.has(status);
}
