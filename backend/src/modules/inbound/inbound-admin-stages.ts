import { InboundOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';

/**
 * Admin Mode staged execution for inbound orders.
 *
 * Status reuse:
 * - Waiting for Approval  → draft | pending_approval
 * - Waiting for Receiving → in_progress (after Approve; open receiving task)
 * - After receiving       → in_progress | partially_received (open putaway task)
 * - Putaway complete      → completed
 *
 * Approve side-effect contract:
 * - MAY: plan validation, status → in_progress, bootstrap receiving task, realtime
 * - MUST NOT: post receive quantities, complete putaway, move stock to final locations
 */

export type InboundAdminStageAction =
  | 'approve'
  | 'complete_receiving'
  | 'complete_putaway';

export type InboundOpenTaskHint = 'receiving' | 'putaway' | null;

const INBOUND_CONFIRMABLE: InboundOrderStatus[] = [
  InboundOrderStatus.draft,
  InboundOrderStatus.pending_approval,
];

export function isInboundAdminConfirmable(status: InboundOrderStatus | string): boolean {
  return INBOUND_CONFIRMABLE.includes(status as InboundOrderStatus);
}

export function nextInboundAdminAction(
  status: InboundOrderStatus | string,
  openTask: InboundOpenTaskHint = null,
): InboundAdminStageAction | null {
  if (isInboundAdminConfirmable(status)) return 'approve';
  if (
    status === InboundOrderStatus.in_progress ||
    status === 'in_progress' ||
    status === InboundOrderStatus.partially_received ||
    status === 'partially_received'
  ) {
    if (openTask === 'receiving') return 'complete_receiving';
    if (openTask === 'putaway') return 'complete_putaway';
    // Unknown open task — UI should resolve via timeline; default receiving if unspecified.
    return openTask === null ? 'complete_receiving' : null;
  }
  return null;
}

export function assertInboundAdminStageAction(
  status: InboundOrderStatus | string,
  action: InboundAdminStageAction,
): void {
  if (action === 'approve') {
    if (!isInboundAdminConfirmable(status)) {
      throw new InvalidStateException(
        `Approve is only valid while waiting for approval (current: ${status}).`,
      );
    }
    return;
  }

  const active =
    status === InboundOrderStatus.in_progress ||
    status === 'in_progress' ||
    status === InboundOrderStatus.partially_received ||
    status === 'partially_received';

  if (action === 'complete_receiving') {
    if (!active) {
      throw new InvalidStateException(
        `Mark Receiving Complete requires an active inbound order (current: ${status}).`,
      );
    }
    return;
  }

  if (action === 'complete_putaway') {
    if (!active) {
      throw new InvalidStateException(
        `Mark Putaway Complete requires an active inbound order (current: ${status}).`,
      );
    }
    return;
  }

  throw new InvalidStateException(`Inbound admin action ${action} is not valid for status ${status}.`);
}
