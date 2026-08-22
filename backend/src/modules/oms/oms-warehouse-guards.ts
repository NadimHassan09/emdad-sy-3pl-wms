import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

/**
 * Commercial OMS statuses that must not start / continue warehouse execution
 * (confirm, pick bootstrap, carrier createShipment).
 * Same rule for newly created and migrated orders — not a legacy branch.
 */
export const OMS_BLOCKS_WAREHOUSE_EXECUTION: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.shipped,
  OmsOrderStatus.out_for_delivery,
  OmsOrderStatus.delivered,
  OmsOrderStatus.returned,
  OmsOrderStatus.cancelled,
  OmsOrderStatus.failed_delivery,
  OmsOrderStatus.completed,
  OmsOrderStatus.rejected,
]);

/** Outbound statuses where warehouse / carrier execution must not start. */
export const OUTBOUND_WAREHOUSE_CLOSED: ReadonlySet<OutboundOrderStatus> = new Set([
  OutboundOrderStatus.externally_fulfilled,
  OutboundOrderStatus.shipped,
  OutboundOrderStatus.cancelled,
  OutboundOrderStatus.delivered,
  OutboundOrderStatus.returned,
  OutboundOrderStatus.ready_to_ship,
]);

/** Outbound statuses allowed to spawn shipping_details tasks. */
export const OUTBOUND_SHIPPING_DETAILS_SPAWNABLE: ReadonlySet<string> = new Set([
  'picking',
  'packing',
  'waiting_for_shipping_details',
]);

export function omsBlocksWarehouseExecution(status: OmsOrderStatus | string): boolean {
  return OMS_BLOCKS_WAREHOUSE_EXECUTION.has(status as OmsOrderStatus);
}

export function outboundWarehouseClosed(status: OutboundOrderStatus | string): boolean {
  return OUTBOUND_WAREHOUSE_CLOSED.has(status as OutboundOrderStatus);
}

export function outboundAllowsShippingDetailsSpawn(status: string): boolean {
  return OUTBOUND_SHIPPING_DETAILS_SPAWNABLE.has(status);
}
