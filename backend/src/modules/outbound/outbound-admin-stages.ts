import { OutboundOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { isOutboundConfirmable } from './outbound-confirm-lock.util';

/**
 * Admin Mode staged execution for outbound orders.
 *
 * - Waiting for Approval → draft | pending_approval | allocated
 * - Waiting for Picking  → picking
 * - Waiting for Packing  → packing
 * - Waiting for Shipping Details → waiting_for_shipping_details
 * - Waiting for Dispatch → ready_to_ship  (Dispatch only — NOT "sent to carrier")
 * - Dispatch complete    → shipped
 *
 * Carrier Send happens while status is waiting_for_shipping_details and does NOT
 * transition to ready_to_ship. Mark Shipping Details Complete → ready_to_ship.
 */

export type OutboundAdminStageAction =
  | 'approve'
  | 'complete_picking'
  | 'complete_packing'
  | 'select_shipping_method'
  | 'complete_shipping_details'
  | 'complete_dispatch';

export type OutboundAdminNextAction = OutboundAdminStageAction | null;

export function outboundRequiresPacking(flags: {
  requiresPacking?: boolean | null;
  planRequiresPacking?: boolean | null;
}): boolean {
  return flags.requiresPacking !== false && flags.planRequiresPacking !== false;
}

/** Expected next Admin CTA for the current outbound status. */
export function nextOutboundAdminAction(
  status: OutboundOrderStatus | string,
  requiresPacking: boolean,
): OutboundAdminNextAction {
  if (isOutboundConfirmable(status as OutboundOrderStatus)) return 'approve';
  if (status === OutboundOrderStatus.picking || status === 'picking') {
    return 'complete_picking';
  }
  if (status === OutboundOrderStatus.packing || status === 'packing') {
    return requiresPacking ? 'complete_packing' : null;
  }
  if (
    status === OutboundOrderStatus.waiting_for_shipping_method ||
    status === 'waiting_for_shipping_method'
  ) {
    return 'select_shipping_method';
  }
  if (
    status === OutboundOrderStatus.waiting_for_shipping_details ||
    status === 'waiting_for_shipping_details'
  ) {
    return 'complete_shipping_details';
  }
  if (status === OutboundOrderStatus.ready_to_ship || status === 'ready_to_ship') {
    return 'complete_dispatch';
  }
  return null;
}

/**
 * Validates that `action` is allowed from `status`.
 * Throws InvalidStateException on illegal transitions (including already-completed).
 */
export function assertOutboundAdminStageAction(
  status: OutboundOrderStatus | string,
  action: OutboundAdminStageAction,
  requiresPacking: boolean,
): void {
  const expected = nextOutboundAdminAction(status, requiresPacking);

  if (action === 'approve') {
    if (!isOutboundConfirmable(status as OutboundOrderStatus)) {
      throw new InvalidStateException(
        `Approve is only valid while waiting for approval (current: ${status}).`,
      );
    }
    return;
  }

  if (action === 'complete_picking') {
    if (status !== OutboundOrderStatus.picking && status !== 'picking') {
      throw new InvalidStateException(
        `Mark Picking Complete requires status picking (current: ${status}).`,
      );
    }
    return;
  }

  if (action === 'complete_packing') {
    if (!requiresPacking) {
      throw new InvalidStateException(
        'Packing is not required for this order; packing completion is not allowed.',
      );
    }
    if (status !== OutboundOrderStatus.packing && status !== 'packing') {
      throw new InvalidStateException(
        `Mark Packing Complete requires status packing (current: ${status}).`,
      );
    }
    return;
  }

  if (action === 'select_shipping_method') {
    if (
      status !== OutboundOrderStatus.waiting_for_shipping_method &&
      status !== 'waiting_for_shipping_method'
    ) {
      throw new InvalidStateException(
        `Select Shipping Method requires status waiting_for_shipping_method (current: ${status}).`,
      );
    }
    return;
  }

  if (action === 'complete_shipping_details') {
    if (
      status !== OutboundOrderStatus.waiting_for_shipping_details &&
      status !== 'waiting_for_shipping_details'
    ) {
      throw new InvalidStateException(
        `Mark Shipping Details Complete requires status waiting_for_shipping_details (current: ${status}).`,
      );
    }
    return;
  }

  if (action === 'complete_dispatch') {
    if (status !== OutboundOrderStatus.ready_to_ship && status !== 'ready_to_ship') {
      throw new InvalidStateException(
        `Mark Dispatch Complete requires status ready_to_ship / Waiting for Dispatch (current: ${status}).`,
      );
    }
    return;
  }

  if (expected !== action) {
    throw new InvalidStateException(
      `Outbound admin action ${action} is not valid for status ${status}.`,
    );
  }
}
