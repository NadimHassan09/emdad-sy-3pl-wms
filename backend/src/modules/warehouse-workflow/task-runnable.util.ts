import { WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';

/** Minimal task row for DAG frontier — callers may use `select` without full `WarehouseTask`. */
export type TaskRunnableShape = {
  id: string;
  taskType: WarehouseTaskType;
  status: WarehouseTaskStatus;
};

/** Stable codes for list/detail and 403 payloads (Part IV). */
export const RUNN_BLOCKED_NOT_ON_FRONT = 'NOT_ON_WORKFLOW_FRONT' as const;
export const RUNN_BLOCKED_SKILL_GAP = 'WORKER_MISSING_REQUIRED_SKILLS' as const;
export const RUNN_BLOCKED_ASSIGNMENT_REQUIRED = 'ASSIGNMENT_REQUIRED_FOR_SKILLS' as const;

export type RunnabilityBlockedReason =
  | typeof RUNN_BLOCKED_NOT_ON_FRONT
  | typeof RUNN_BLOCKED_SKILL_GAP
  | typeof RUNN_BLOCKED_ASSIGNMENT_REQUIRED
  | null;

const terminal: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.completed,
  WarehouseTaskStatus.cancelled,
];

function isTerminal(s: WarehouseTaskStatus): boolean {
  return terminal.includes(s);
}

function isActionable(s: WarehouseTaskStatus): boolean {
  return (
    s === WarehouseTaskStatus.pending ||
    s === WarehouseTaskStatus.assigned ||
    s === WarehouseTaskStatus.in_progress
  );
}

/**
 * Returns task ids that are allowed to be executed next (strict workflow order).
 */
export function computeRunnableTaskIds(tasks: TaskRunnableShape[], referenceType: string): Set<string> {
  const groups: WarehouseTaskType[][] =
    referenceType === 'inbound_order'
      ? [
          [WarehouseTaskType.receiving],
          [WarehouseTaskType.putaway, WarehouseTaskType.putaway_quarantine],
        ]
      : [
          [WarehouseTaskType.pick],
          [WarehouseTaskType.pack],
          [WarehouseTaskType.dispatch],
        ];

  const run = new Set<string>();

  for (const g of groups) {
    const subset = tasks.filter((t) => g.includes(t.taskType));
    if (subset.length === 0) {
      continue;
    }
    const done = subset.every((t) => isTerminal(t.status));
    if (!done) {
      for (const t of subset) {
        if (isActionable(t.status)) {
          run.add(t.id);
        }
      }
      break;
    }
  }

  return run;
}

/** When the task is not on the DAG frontier — `null` if it is runnable from order alone. */
export function getFrontierBlockedReason(
  taskId: string,
  tasks: TaskRunnableShape[],
  referenceType: string,
): typeof RUNN_BLOCKED_NOT_ON_FRONT | null {
  if (computeRunnableTaskIds(tasks, referenceType).has(taskId)) return null;
  return RUNN_BLOCKED_NOT_ON_FRONT;
}
