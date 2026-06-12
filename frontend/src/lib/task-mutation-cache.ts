import type { QueryClient } from '@tanstack/react-query';

import type { TaskMutationEnvelope } from '../api/tasks';
import { QK } from '../constants/query-keys';

import { invalidateWorkflowTasksInventory } from './invalidate-wms-queries';

export type TaskMutationCacheOpts = {
  taskId: string;
  envelope: TaskMutationEnvelope;
  warehouseId?: string;
  referenceId?: string;
  referenceType?: 'inbound_order' | 'outbound_order';
};

/** Latest `execution_state` from a task mutation response envelope. */
export function executionStateFromTaskEnvelope(envelope: TaskMutationEnvelope): unknown {
  const task = envelope.task;
  if (!task || typeof task !== 'object') return undefined;
  const r = task as Record<string, unknown>;
  return r.executionState ?? r.execution_state;
}

/**
 * After a successful task mutation (progress, assign, start, complete, …):
 * update the React Query cache and refetch active queries so UI reflects server state.
 */
export function applyTaskMutationEnvelope(qc: QueryClient, opts: TaskMutationCacheOpts): void {
  const { taskId, envelope, warehouseId, referenceId, referenceType } = opts;

  const task = envelope.task as Record<string, unknown> | null | undefined;
  const merged =
    Array.isArray(envelope.assignments) && task && typeof task === 'object'
      ? { ...task, assignments: envelope.assignments }
      : envelope.task;

  qc.setQueryData(QK.tasks.detail(taskId), merged);

  if (envelope.workflowInstance?.id) {
    qc.setQueryData(
      QK.workflows.instance(envelope.workflowInstance.id as string),
      envelope.workflowInstance,
    );
  }

  invalidateWorkflowTasksInventory(qc, { referenceId, referenceType });
  qc.invalidateQueries({ queryKey: QK.workflows.all });
  qc.invalidateQueries({ queryKey: QK.tasks.all });

  if (warehouseId) {
    qc.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false });
    qc.invalidateQueries({ queryKey: [...QK.locationsFlatAll(false), warehouseId] });
  }

  qc.invalidateQueries({ queryKey: QK.tasks.detail(taskId) });

  if (referenceType === 'outbound_order' && referenceId) {
    qc.invalidateQueries({ queryKey: ['outbound-task', referenceId] });
    qc.invalidateQueries({ queryKey: [...QK.outboundOrders, referenceId] });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });
  }
  if (referenceType === 'inbound_order' && referenceId) {
    qc.invalidateQueries({ queryKey: [...QK.inboundOrders, referenceId] });
    qc.invalidateQueries({ queryKey: QK.inboundOrders });
  }

  void qc.refetchQueries({ queryKey: QK.tasks.detail(taskId), type: 'active' });
  if (referenceId) {
    void qc.refetchQueries({
      queryKey: QK.workflows.workflowTimelineByRef(referenceId),
      type: 'active',
    });
  }
}
