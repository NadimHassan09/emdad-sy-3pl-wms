import { OmsOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';

/**
 * OMS order hard-delete rules.
 * Only cancelled orders may be deleted; all other statuses stay for audit.
 */

export function isOmsOrderDeletable(
  status: OmsOrderStatus | string | null | undefined,
): boolean {
  return status === OmsOrderStatus.cancelled || status === 'cancelled';
}

export function omsOrderDeleteBlockedMessage(
  status: OmsOrderStatus | string | null | undefined,
): string {
  if (status === OmsOrderStatus.completed || status === 'completed') {
    return (
      'Completed OMS orders cannot be deleted. ' +
      'They must remain available for audit and traceability.'
    );
  }
  const label = typeof status === 'string' && status.trim() ? status : String(status ?? 'unknown');
  return (
    `Only cancelled OMS orders can be deleted. ` +
    `This order is "${label}" and must stay available for operational history.`
  );
}

export function assertOmsOrderDeletable(
  status: OmsOrderStatus | string | null | undefined,
): void {
  if (!isOmsOrderDeletable(status)) {
    throw new InvalidStateException(omsOrderDeleteBlockedMessage(status));
  }
}
