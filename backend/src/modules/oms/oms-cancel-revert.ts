import { OmsOrderStatus, OutboundOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import type { OmsTransitionActor } from './oms-order-transitions';

export const CLIENT_CANCEL_REVERT_STATUSES: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.waiting_for_confirmation,
  OmsOrderStatus.confirmed_waiting_for_admin_approval,
  OmsOrderStatus.pending_approval,
]);

export const UNSAFE_OMS_RESTORE_STATUSES: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.cancelled,
  OmsOrderStatus.rejected,
  OmsOrderStatus.delivered,
  OmsOrderStatus.returned,
  OmsOrderStatus.failed_delivery,
  OmsOrderStatus.completed,
]);

export const UNSAFE_OUTBOUND_RESTORE_STATUSES: ReadonlySet<OutboundOrderStatus> = new Set([
  OutboundOrderStatus.cancelled,
  OutboundOrderStatus.delivered,
  OutboundOrderStatus.returned,
]);

export const OMS_FULFILLMENT_RESTORE_STATUSES: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.processing,
  OmsOrderStatus.pending,
  OmsOrderStatus.approved,
  OmsOrderStatus.confirmed,
  OmsOrderStatus.allocated,
  OmsOrderStatus.picking,
  OmsOrderStatus.packing,
  OmsOrderStatus.ready_to_ship,
]);

const OMS_STATUS_VALUES = new Set<string>(Object.values(OmsOrderStatus));
const OUTBOUND_STATUS_VALUES = new Set<string>(Object.values(OutboundOrderStatus));

const CANCEL_EVENT_TYPES = new Set(['oms.cancelled', 'order.cancelled']);

const EVENT_TYPE_TO_OMS: Record<string, OmsOrderStatus> = {
  'order.waiting_for_confirmation': OmsOrderStatus.waiting_for_confirmation,
  'oms.confirmed': OmsOrderStatus.confirmed_waiting_for_admin_approval,
  'oms.approved': OmsOrderStatus.processing,
  'oms.processing': OmsOrderStatus.processing,
  'order.processing': OmsOrderStatus.processing,
  'oms.ready_to_ship': OmsOrderStatus.ready_to_ship,
  'order.ready_to_ship': OmsOrderStatus.ready_to_ship,
  'order.allocated': OmsOrderStatus.allocated,
  'order.picking': OmsOrderStatus.picking,
  'order.packing': OmsOrderStatus.packing,
};

export type CancelTimelineEvent = {
  eventType: string;
  payload?: unknown;
};

export function isRestorableOmsStatus(
  status: OmsOrderStatus | null | undefined,
): status is OmsOrderStatus {
  return !!status && !UNSAFE_OMS_RESTORE_STATUSES.has(status);
}

export function isRestorableOutboundStatus(
  status: OutboundOrderStatus | null | undefined,
): status is OutboundOrderStatus {
  return !!status && !UNSAFE_OUTBOUND_RESTORE_STATUSES.has(status);
}

export function parseOmsStatus(value: unknown): OmsOrderStatus | null {
  if (typeof value !== 'string' || !OMS_STATUS_VALUES.has(value)) return null;
  return value as OmsOrderStatus;
}

export function parseOutboundStatus(value: unknown): OutboundOrderStatus | null {
  if (typeof value !== 'string' || !OUTBOUND_STATUS_VALUES.has(value)) return null;
  return value as OutboundOrderStatus;
}

/** Snapshot taken only when entering cancelled from a live non-cancelled row. */
export function snapshotOnEnteringCancelled(
  currentOmsStatus: OmsOrderStatus,
  currentOutboundStatus: OutboundOrderStatus | null,
): {
  cancelledFromStatus: OmsOrderStatus;
  cancelledFromOutboundStatus: OutboundOrderStatus | null;
} {
  return {
    cancelledFromStatus: currentOmsStatus,
    cancelledFromOutboundStatus:
      currentOutboundStatus && currentOutboundStatus !== OutboundOrderStatus.cancelled
        ? currentOutboundStatus
        : null,
  };
}

function statusFromEvent(event: CancelTimelineEvent): OmsOrderStatus | null {
  const payload =
    event.payload && typeof event.payload === 'object'
      ? (event.payload as Record<string, unknown>)
      : null;
  const fromPayload = parseOmsStatus(payload?.omsStatus ?? payload?.status);
  if (fromPayload) return fromPayload;
  return EVENT_TYPE_TO_OMS[event.eventType] ?? null;
}

/**
 * Conservative resolve. No timestamp fallback.
 * 1) cancelledFromStatus if restorable
 * 2) last high-confidence event immediately before cancel
 * 3) null — caller must refuse
 */
export function resolvePreviousOmsStatus(params: {
  cancelledFromStatus?: OmsOrderStatus | null;
  events?: CancelTimelineEvent[];
}): OmsOrderStatus | null {
  if (isRestorableOmsStatus(params.cancelledFromStatus ?? null)) {
    return params.cancelledFromStatus!;
  }

  const events = params.events ?? [];
  const cancelIdx = [...events]
    .map((e, i) => ({ e, i }))
    .reverse()
    .find(({ e }) => CANCEL_EVENT_TYPES.has(e.eventType))?.i;

  const beforeCancel = cancelIdx == null ? events : events.slice(0, cancelIdx);
  for (let i = beforeCancel.length - 1; i >= 0; i--) {
    const status = statusFromEvent(beforeCancel[i]);
    if (isRestorableOmsStatus(status)) return status;
    if (status && UNSAFE_OMS_RESTORE_STATUSES.has(status)) return null;
  }
  return null;
}

export function assertPreviousOmsStatusOrThrow(status: OmsOrderStatus | null): OmsOrderStatus {
  if (!isRestorableOmsStatus(status)) {
    throw new InvalidStateException('Cannot safely determine previous OMS status');
  }
  return status;
}

export function clientMayRevertTo(status: OmsOrderStatus): boolean {
  return CLIENT_CANCEL_REVERT_STATUSES.has(status);
}

export function canRevertCancel(params: {
  orderStatus: OmsOrderStatus;
  restoreTo: OmsOrderStatus | null;
  actor: OmsTransitionActor;
}): boolean {
  if (params.orderStatus !== OmsOrderStatus.cancelled) return false;
  if (!isRestorableOmsStatus(params.restoreTo)) return false;
  if (params.actor === 'client') return clientMayRevertTo(params.restoreTo);
  return true;
}

export function resolveOutboundRestoreStatus(params: {
  cancelledFromOutboundStatus?: OutboundOrderStatus | null;
  outboundCancelledAt: Date | null;
  hasActiveReservations: boolean;
  auditPreviousStatus?: OutboundOrderStatus | null;
}): OutboundOrderStatus | null {
  if (isRestorableOutboundStatus(params.cancelledFromOutboundStatus ?? null)) {
    return params.cancelledFromOutboundStatus!;
  }
  // Historical OMS-path cancel: status flip only (cancelledAt unset).
  if (params.outboundCancelledAt == null) {
    return params.hasActiveReservations
      ? OutboundOrderStatus.allocated
      : OutboundOrderStatus.draft;
  }
  // Historical outbound-path cancel: require audit previousState.
  if (isRestorableOutboundStatus(params.auditPreviousStatus ?? null)) {
    return params.auditPreviousStatus!;
  }
  return null;
}

export function needsReallocation(params: {
  omsStatus: OmsOrderStatus;
  hasActiveReservations: boolean;
}): boolean {
  return (
    OMS_FULFILLMENT_RESTORE_STATUSES.has(params.omsStatus) && !params.hasActiveReservations
  );
}
