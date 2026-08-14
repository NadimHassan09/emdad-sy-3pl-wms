import { OmsReturnStatus, ReturnOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';

/**
 * Admin Mode staged execution for OMS returns (mirrors inbound stages).
 *
 * Status reuse (no new enums):
 * - Waiting for plan / approval → OmsReturnStatus.requested
 * - Waiting for receiving       → OmsReturnStatus.approved + WH receiving
 * - Waiting for putaway         → OmsReturnStatus.approved + WH receiving|inspecting (qty received)
 * - Done                        → OmsReturnStatus.completed (+ WH completed)
 *
 * Approve side-effect contract:
 * - MAY: validate plan, create WH return, confirm, startReceiving
 * - MUST NOT: receive quantities, post inventory / putaway, complete WH return
 */

export type OmsReturnAdminStageAction =
  | 'approve'
  | 'complete_receiving'
  | 'complete_putaway';

export type OmsReturnWhHint = {
  status: ReturnOrderStatus | string | null | undefined;
  hasUnreceivedQty: boolean;
  hasUnpostedQty: boolean;
};

export function nextOmsReturnAdminAction(
  omsStatus: OmsReturnStatus | string,
  wh: OmsReturnWhHint | null = null,
): OmsReturnAdminStageAction | null {
  if (omsStatus === OmsReturnStatus.requested || omsStatus === 'requested') {
    return 'approve';
  }
  if (omsStatus !== OmsReturnStatus.approved && omsStatus !== 'approved') {
    return null;
  }
  if (!wh) return 'complete_receiving';
  if (wh.hasUnreceivedQty) return 'complete_receiving';
  if (wh.hasUnpostedQty) return 'complete_putaway';
  return null;
}

export function assertOmsReturnAdminStageAction(
  omsStatus: OmsReturnStatus | string,
  action: OmsReturnAdminStageAction,
): void {
  if (action === 'approve') {
    if (omsStatus !== OmsReturnStatus.requested && omsStatus !== 'requested') {
      throw new InvalidStateException(
        `Approve is only valid while the return is requested (current: ${omsStatus}).`,
      );
    }
    return;
  }

  if (omsStatus !== OmsReturnStatus.approved && omsStatus !== 'approved') {
    throw new InvalidStateException(
      `Stage action ${action} requires an approved OMS return (current: ${omsStatus}).`,
    );
  }
}
