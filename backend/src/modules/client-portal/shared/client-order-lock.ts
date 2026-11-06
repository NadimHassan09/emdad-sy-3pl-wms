import { ForbiddenException } from '@nestjs/common';

/**
 * Inbound / outbound orders submitted by a client sit in `draft` or `pending_approval`
 * until the warehouse approves them. Only then may the client still edit or remove them.
 */
export const CLIENT_EDITABLE_WMS_STATUSES: ReadonlySet<string> = new Set(['draft', 'pending_approval']);

export function isClientEditableWmsStatus(status: string): boolean {
  return CLIENT_EDITABLE_WMS_STATUSES.has(status);
}

export function assertClientMayChangeWmsOrder(status: string): void {
  if (!isClientEditableWmsStatus(status)) {
    throw new ForbiddenException(
      `This order is ${status.replace(/_/g, ' ')} and was already approved by the warehouse. Ask the warehouse to change it.`,
    );
  }
}
