import { ReturnOrderStatus } from '@prisma/client';

/** Max lines per return create (abuse guard). */
export const MAX_RETURN_LINES_PER_ORDER = 50;

export const RETURN_CONFIRMABLE: ReturnOrderStatus[] = [ReturnOrderStatus.draft];

export const RETURN_RECEIVABLE: ReturnOrderStatus[] = [
  ReturnOrderStatus.confirmed,
  ReturnOrderStatus.receiving,
  ReturnOrderStatus.inspecting,
];

export const RETURN_INSPECTABLE: ReturnOrderStatus[] = [
  ReturnOrderStatus.receiving,
  ReturnOrderStatus.inspecting,
];

export const RETURN_INVENTORY_APPLICABLE: ReturnOrderStatus[] = [
  ReturnOrderStatus.receiving,
  ReturnOrderStatus.inspecting,
];

export const RETURN_COMPLETABLE: ReturnOrderStatus[] = [
  ReturnOrderStatus.receiving,
  ReturnOrderStatus.inspecting,
];

export const RETURN_TERMINAL: ReturnOrderStatus[] = [
  ReturnOrderStatus.completed,
  ReturnOrderStatus.cancelled,
];

export const RETURN_ACTIVE_FOR_QUOTA: ReturnOrderStatus[] = [
  ReturnOrderStatus.draft,
  ReturnOrderStatus.confirmed,
  ReturnOrderStatus.receiving,
  ReturnOrderStatus.inspecting,
  ReturnOrderStatus.completed,
];

export function isReturnConfirmable(status: ReturnOrderStatus): boolean {
  return RETURN_CONFIRMABLE.includes(status);
}

export function isReturnReceivable(status: ReturnOrderStatus): boolean {
  return RETURN_RECEIVABLE.includes(status);
}

export function isReturnInspectable(status: ReturnOrderStatus): boolean {
  return RETURN_INSPECTABLE.includes(status);
}

export function isReturnInventoryApplicable(status: ReturnOrderStatus): boolean {
  return RETURN_INVENTORY_APPLICABLE.includes(status);
}

export function isReturnCompletable(status: ReturnOrderStatus): boolean {
  return RETURN_COMPLETABLE.includes(status);
}

export function isReturnTerminal(status: ReturnOrderStatus): boolean {
  return RETURN_TERMINAL.includes(status);
}
