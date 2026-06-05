import type { QueryClient } from '@tanstack/react-query';

import type { WarehouseTaskListItem } from '../api/tasks';
import type { WorkflowTimelineResponse } from '../api/workflows';
import type { PageResult } from '../api/client';
import { QK } from '../constants/query-keys';

type TaskPayload = {
  taskId?: string;
  warehouseId?: string | null;
  task?: WarehouseTaskListItem & Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
  workflowInstanceId?: string;
};

function patchTaskLists(qc: QueryClient, task: WarehouseTaskListItem): void {
  qc.setQueriesData<PageResult<WarehouseTaskListItem>>({ queryKey: QK.tasks.all }, (prev) => {
    if (!prev?.items) return prev;
    const idx = prev.items.findIndex((t) => t.id === task.id);
    if (idx < 0) {
      return { ...prev, items: [task, ...prev.items], total: prev.total + 1 };
    }
    const next = [...prev.items];
    next[idx] = { ...next[idx], ...task };
    return { ...prev, items: next };
  });
}

function patchTaskDetail(qc: QueryClient, task: WarehouseTaskListItem & Record<string, unknown>): void {
  qc.setQueryData(QK.tasks.detail(task.id), (prev) =>
    prev ? { ...(prev as Record<string, unknown>), ...task } : task,
  );
}

function patchWorkflowTimeline(qc: QueryClient, payload: TaskPayload): void {
  const task = payload.task;
  if (!task || !payload.referenceId) return;

  const refId = payload.referenceId;
  const refType = payload.referenceType as 'inbound_order' | 'outbound_order' | undefined;

  const patchTimeline = (prev: WorkflowTimelineResponse | undefined) => {
    if (!prev?.tasks) return prev;
    const idx = prev.tasks.findIndex((t) => t.id === task.id);
    if (idx < 0) {
      return {
        ...prev,
        tasks: [...prev.tasks, task],
      };
    }
    const nextTasks = [...prev.tasks];
    nextTasks[idx] = { ...nextTasks[idx], ...task };
    return { ...prev, tasks: nextTasks };
  };

  qc.setQueryData(QK.workflows.workflowTimelineByRef(refId), patchTimeline);
  if (refType) {
    qc.setQueryData(QK.workflows.timeline(refType, refId), patchTimeline);
  }
}

/** Patch cycle-count my-tasks when a count status changes (replaces 30s poll). */
export function patchCycleCountMyTasksStatus(
  qc: QueryClient,
  countId: string,
  status: string,
  warehouseId?: string,
): void {
  if (warehouseId) {
    qc.setQueryData<Array<{ id: string; status: string }>>(
      QK.cycleCount.myTasks(warehouseId),
      (prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((c) => c.id === countId);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status };
        return next;
      },
    );
  }
  qc.setQueriesData<Array<{ id: string; status: string }>>(
    { queryKey: ['cycle-count', 'my-tasks'] },
    (prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((c) => c.id === countId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], status };
      return next;
    },
  );
}

export function patchTaskUpdated(qc: QueryClient, payload: TaskPayload): void {
  if (!payload.task) return;
  const task = payload.task;
  patchTaskLists(qc, task);
  patchTaskDetail(qc, task);
  patchWorkflowTimeline(qc, payload);
}
