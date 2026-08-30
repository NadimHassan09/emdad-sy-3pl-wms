import { OmsOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';

export type OmsTransitionActor = 'admin' | 'client' | 'system';

export type OmsTransitionAction =
  | 'client_create'
  | 'admin_create'
  | 'client_confirm'
  | 'admin_confirm'
  | 'admin_approve'
  | 'cancel'
  | 'cancel_revert'
  | 'reject'
  | 'wms_sync'
  | 'mark_delivered'
  | 'delivery_revert'
  | 'failed_delivery'
  | 'mark_returned';

/** Primary commercial statuses written by the new state machine. */
export const OMS_PRIMARY_STATUSES: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.waiting_for_confirmation,
  OmsOrderStatus.confirmed_waiting_for_admin_approval,
  OmsOrderStatus.processing,
  OmsOrderStatus.ready_to_ship,
  OmsOrderStatus.shipped,
  OmsOrderStatus.delivered,
  OmsOrderStatus.cancelled,
  OmsOrderStatus.failed_delivery,
  OmsOrderStatus.returned,
]);

/** Statuses that block warehouse sync overwrites. */
export const OMS_TERMINAL_STATUSES: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.rejected,
  OmsOrderStatus.cancelled,
  OmsOrderStatus.completed,
  OmsOrderStatus.delivered,
  OmsOrderStatus.failed_delivery,
  OmsOrderStatus.returned,
]);

/** Pre-fulfillment statuses (no outbound expected yet). */
export const OMS_PRE_FULFILLMENT: ReadonlySet<OmsOrderStatus> = new Set([
  OmsOrderStatus.waiting_for_confirmation,
  OmsOrderStatus.confirmed_waiting_for_admin_approval,
  OmsOrderStatus.pending_approval,
  OmsOrderStatus.draft,
]);

type TransitionKey = `${OmsOrderStatus}|${OmsTransitionAction}|${OmsTransitionActor}`;

/**
 * Explicit allow-list. Unknown combinations throw.
 * Legacy source statuses may appear only where needed for leftover historical rows.
 */
const ALLOWED: Partial<Record<TransitionKey, OmsOrderStatus>> = {
  // Client confirm
  [`${OmsOrderStatus.waiting_for_confirmation}|client_confirm|client`]:
    OmsOrderStatus.confirmed_waiting_for_admin_approval,

  // Admin confirm from waiting → skip middle, start fulfillment
  [`${OmsOrderStatus.waiting_for_confirmation}|admin_confirm|admin`]:
    OmsOrderStatus.processing,

  // Admin approve
  [`${OmsOrderStatus.confirmed_waiting_for_admin_approval}|admin_approve|admin`]:
    OmsOrderStatus.processing,
  // Legacy leftover rows still on pending_approval
  [`${OmsOrderStatus.pending_approval}|admin_approve|admin`]:
    OmsOrderStatus.processing,

  // Cancel
  [`${OmsOrderStatus.waiting_for_confirmation}|cancel|client`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.waiting_for_confirmation}|cancel|admin`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.confirmed_waiting_for_admin_approval}|cancel|client`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.confirmed_waiting_for_admin_approval}|cancel|admin`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.pending_approval}|cancel|client`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.pending_approval}|cancel|admin`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.draft}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.processing}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.pending}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.ready_to_ship}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.allocated}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.picking}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.packing}|cancel|admin`]: OmsOrderStatus.cancelled,
  // Out for Delivery (raw shipped / out_for_delivery) — admin only
  [`${OmsOrderStatus.shipped}|cancel|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.out_for_delivery}|cancel|admin`]: OmsOrderStatus.cancelled,

  // Reject (admin only, pre-fulfillment)
  [`${OmsOrderStatus.confirmed_waiting_for_admin_approval}|reject|admin`]:
    OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.pending_approval}|reject|admin`]: OmsOrderStatus.cancelled,
  [`${OmsOrderStatus.waiting_for_confirmation}|reject|admin`]:
    OmsOrderStatus.cancelled,

  // Delivery
  [`${OmsOrderStatus.shipped}|mark_delivered|admin`]: OmsOrderStatus.delivered,
  [`${OmsOrderStatus.out_for_delivery}|mark_delivered|admin`]:
    OmsOrderStatus.delivered,

  // Delivery revert (dedicated action + reason required at call site)
  [`${OmsOrderStatus.delivered}|delivery_revert|admin`]: OmsOrderStatus.shipped,

  // Failed delivery
  [`${OmsOrderStatus.shipped}|failed_delivery|admin`]:
    OmsOrderStatus.failed_delivery,
  [`${OmsOrderStatus.out_for_delivery}|failed_delivery|admin`]:
    OmsOrderStatus.failed_delivery,
  [`${OmsOrderStatus.ready_to_ship}|failed_delivery|admin`]:
    OmsOrderStatus.failed_delivery,

  // Full return after warehouse receive/complete
  [`${OmsOrderStatus.delivered}|mark_returned|system`]: OmsOrderStatus.returned,
  [`${OmsOrderStatus.delivered}|mark_returned|admin`]: OmsOrderStatus.returned,
  [`${OmsOrderStatus.shipped}|mark_returned|system`]: OmsOrderStatus.returned,
  [`${OmsOrderStatus.shipped}|mark_returned|admin`]: OmsOrderStatus.returned,
  [`${OmsOrderStatus.out_for_delivery}|mark_returned|system`]: OmsOrderStatus.returned,
  [`${OmsOrderStatus.out_for_delivery}|mark_returned|admin`]: OmsOrderStatus.returned,
};

export function assertOmsTransition(
  from: OmsOrderStatus,
  action: OmsTransitionAction,
  actor: OmsTransitionActor,
): OmsOrderStatus {
  const key = `${from}|${action}|${actor}` as TransitionKey;
  const next = ALLOWED[key];
  if (!next) {
    throw new InvalidStateException(
      `OMS transition not allowed: ${from} —[${action}/${actor}]→`,
    );
  }
  return next;
}

export function resolveOmsActorRole(role: string | undefined | null): OmsTransitionActor {
  if (role === 'client_admin' || role === 'client_staff') return 'client';
  return 'admin';
}

/** Only exit from cancelled. Next status is dynamic (pre-cancel snapshot). */
export function assertOmsCancelRevert(
  from: OmsOrderStatus,
  actor: OmsTransitionActor,
): void {
  if (from !== OmsOrderStatus.cancelled) {
    throw new InvalidStateException(
      `OMS transition not allowed: ${from} —[cancel_revert/${actor}]→`,
    );
  }
}
