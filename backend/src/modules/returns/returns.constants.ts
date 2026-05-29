import { ReturnOrderStatus } from '@prisma/client';

export const RETURN_CONFIRMABLE: ReturnOrderStatus[] = [ReturnOrderStatus.draft];

export const RETURN_RECEIVABLE: ReturnOrderStatus[] = [
  ReturnOrderStatus.confirmed,
  ReturnOrderStatus.receiving,
];

export const RETURN_COMPLETABLE: ReturnOrderStatus[] = [
  ReturnOrderStatus.receiving,
];

export const RETURN_TERMINAL: ReturnOrderStatus[] = [
  ReturnOrderStatus.completed,
  ReturnOrderStatus.cancelled,
];

export const RETURN_ACTIVE_FOR_QUOTA: ReturnOrderStatus[] = [
  ReturnOrderStatus.draft,
  ReturnOrderStatus.confirmed,
  ReturnOrderStatus.receiving,
  ReturnOrderStatus.completed,
];

export function isReturnConfirmable(status: ReturnOrderStatus): boolean {
  return RETURN_CONFIRMABLE.includes(status);
}

export function isReturnReceivable(status: ReturnOrderStatus): boolean {
  return RETURN_RECEIVABLE.includes(status);
}

export function isReturnCompletable(status: ReturnOrderStatus): boolean {
  return RETURN_COMPLETABLE.includes(status);
}

export function isReturnTerminal(status: ReturnOrderStatus): boolean {
  return RETURN_TERMINAL.includes(status);
}
