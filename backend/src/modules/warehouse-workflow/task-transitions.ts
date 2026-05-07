import {
  WarehouseTaskStatus,
} from '@prisma/client';

const terminal: WarehouseTaskStatus[] = ['completed', 'cancelled'];

/** Strict allowed transitions (excluding cancel from terminal states). */
export function canTransitionTask(from: WarehouseTaskStatus, to: WarehouseTaskStatus): boolean {
  if (from === to) return false;
  if (terminal.includes(from) && to !== 'cancelled') return false;

  const edges: Record<WarehouseTaskStatus, WarehouseTaskStatus[]> = {
    pending: ['assigned', 'in_progress', 'cancelled'],
    assigned: ['pending', 'in_progress', 'cancelled'],
    in_progress: ['completed', 'blocked', 'cancelled', 'failed', 'retry_pending'],
    blocked: ['in_progress', 'cancelled'],
    retry_pending: ['in_progress', 'cancelled', 'failed'],
    failed: ['pending', 'assigned', 'in_progress', 'cancelled'],
    cancelled: [],
    completed: [],
  };

  return edges[from]?.includes(to) ?? false;
}
