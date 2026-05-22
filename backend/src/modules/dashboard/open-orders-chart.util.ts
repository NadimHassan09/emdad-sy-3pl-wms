import {
  WarehouseTaskStatus,
  WarehouseTaskType,
  type WorkflowReferenceType,
} from '@prisma/client';

import {
  computeRunnableTaskIds,
  type TaskRunnableShape,
} from '../warehouse-workflow/task-runnable.util';

export type ChartSlice = { key: string; label: string; count: number };

export type OpenOrdersChartResult = {
  stages: ChartSlice[];
  inProgress: number;
  notInProgress: number;
};

const TERMINAL: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.completed,
  WarehouseTaskStatus.cancelled,
];

function isTerminal(status: WarehouseTaskStatus): boolean {
  return TERMINAL.includes(status);
}

function taskGroups(referenceType: WorkflowReferenceType): WarehouseTaskType[][] {
  return referenceType === 'inbound_order'
    ? [[WarehouseTaskType.receiving], [WarehouseTaskType.putaway, WarehouseTaskType.putaway_quarantine]]
    : [[WarehouseTaskType.pick], [WarehouseTaskType.pack], [WarehouseTaskType.dispatch]];
}

/** Index of the workflow stage group that currently has open work, or -1 if none / not started. */
export function activeFrontierGroupIndex(
  tasks: TaskRunnableShape[],
  referenceType: WorkflowReferenceType,
): number {
  const groups = taskGroups(referenceType);
  for (let i = 0; i < groups.length; i++) {
    const subset = tasks.filter((t) => groups[i]!.includes(t.taskType));
    if (subset.length === 0) continue;
    if (!subset.every((t) => isTerminal(t.status))) return i;
  }
  return -1;
}

/**
 * Order is in progress when its current runnable task has been started
 * (assigned, in_progress, blocked, or retry_pending — not pending-only).
 */
export function isOpenOrderTaskInProgress(
  tasks: TaskRunnableShape[],
  referenceType: WorkflowReferenceType,
): boolean {
  if (tasks.length === 0) return false;

  const runnableIds = computeRunnableTaskIds(tasks, referenceType);
  const runnable = tasks.filter((t) => runnableIds.has(t.id));
  if (runnable.length > 0) {
    return runnable.some((t) => t.status !== WarehouseTaskStatus.pending);
  }

  return tasks.some(
    (t) =>
      !isTerminal(t.status) &&
      t.status !== WarehouseTaskStatus.pending &&
      t.status !== WarehouseTaskStatus.failed,
  );
}

type InboundBucket = 'new' | 'receive' | 'putaway';
type OutboundBucket = 'picking' | 'packing' | 'shipping';

function inboundBucket(hasWorkflow: boolean, groupIndex: number): InboundBucket {
  if (!hasWorkflow || groupIndex < 0) return 'new';
  if (groupIndex === 0) return 'receive';
  return 'putaway';
}

function outboundBucket(hasWorkflow: boolean, groupIndex: number): OutboundBucket {
  if (!hasWorkflow || groupIndex < 0) return 'picking';
  if (groupIndex === 0) return 'picking';
  if (groupIndex === 1) return 'packing';
  return 'shipping';
}

export function buildInboundOpenOrdersChart(
  orders: Array<{ id: string }>,
  workflowByOrderId: Map<string, string>,
  tasksByInstanceId: Map<string, TaskRunnableShape[]>,
): OpenOrdersChartResult {
  const counts: Record<InboundBucket, number> = { new: 0, receive: 0, putaway: 0 };
  let inProgress = 0;
  let notInProgress = 0;

  for (const order of orders) {
    const instanceId = workflowByOrderId.get(order.id);
    const hasWorkflow = Boolean(instanceId);
    const tasks = instanceId ? (tasksByInstanceId.get(instanceId) ?? []) : [];
    const groupIndex = hasWorkflow ? activeFrontierGroupIndex(tasks, 'inbound_order') : -1;
    const bucket = inboundBucket(hasWorkflow, groupIndex);
    counts[bucket] += 1;

    if (isOpenOrderTaskInProgress(tasks, 'inbound_order')) {
      inProgress += 1;
    } else {
      notInProgress += 1;
    }
  }

  return {
    stages: [
      { key: 'new', label: 'New', count: counts.new },
      { key: 'receive', label: 'Receive', count: counts.receive },
      { key: 'putaway', label: 'Putaway', count: counts.putaway },
    ],
    inProgress,
    notInProgress,
  };
}

export function buildOutboundOpenOrdersChart(
  orders: Array<{ id: string }>,
  workflowByOrderId: Map<string, string>,
  tasksByInstanceId: Map<string, TaskRunnableShape[]>,
): OpenOrdersChartResult {
  const counts: Record<OutboundBucket, number> = { picking: 0, packing: 0, shipping: 0 };
  let inProgress = 0;
  let notInProgress = 0;

  for (const order of orders) {
    const instanceId = workflowByOrderId.get(order.id);
    const hasWorkflow = Boolean(instanceId);
    const tasks = instanceId ? (tasksByInstanceId.get(instanceId) ?? []) : [];
    const groupIndex = hasWorkflow ? activeFrontierGroupIndex(tasks, 'outbound_order') : -1;
    const bucket = outboundBucket(hasWorkflow, groupIndex);
    counts[bucket] += 1;

    if (isOpenOrderTaskInProgress(tasks, 'outbound_order')) {
      inProgress += 1;
    } else {
      notInProgress += 1;
    }
  }

  return {
    stages: [
      { key: 'picking', label: 'Picking', count: counts.picking },
      { key: 'packing', label: 'Packing', count: counts.packing },
      { key: 'shipping', label: 'Shipping', count: counts.shipping },
    ],
    inProgress,
    notInProgress,
  };
}
