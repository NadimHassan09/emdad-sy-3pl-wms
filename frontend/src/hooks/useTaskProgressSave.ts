import { useMutation, useQueryClient } from '@tanstack/react-query';

import { TasksApi, type TaskMutationEnvelope } from '../api/tasks';
import { useToast } from '../components/ToastProvider';
import { applyTaskMutationEnvelope } from '../lib/task-mutation-cache';

type Ctx = {
  taskId: string;
  warehouseId?: string;
  outboundOrderId?: string;
  inboundOrderId?: string;
  companyIdOverride?: string;
};

function orderRef(ctx: Ctx): {
  referenceId?: string;
  referenceType?: 'inbound_order' | 'outbound_order';
} {
  if (ctx.outboundOrderId) {
    return { referenceId: ctx.outboundOrderId, referenceType: 'outbound_order' };
  }
  if (ctx.inboundOrderId) {
    return { referenceId: ctx.inboundOrderId, referenceType: 'inbound_order' };
  }
  return {};
}

/**
 * Save task execution draft to the server and refresh cached task / order / workflow data.
 */
export function useTaskProgressSave(ctx: Ctx) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = orderRef(ctx);

  const handleSuccess = (env: TaskMutationEnvelope, message = 'Progress saved') => {
    applyTaskMutationEnvelope(qc, {
      taskId: ctx.taskId,
      envelope: env,
      warehouseId: ctx.warehouseId,
      ...ref,
    });
    toast.success(message);
  };

  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      TasksApi.patchProgress(ctx.taskId, patch, ctx.companyIdOverride),
    onSuccess: (env) => handleSuccess(env),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Call after a one-off patchProgress (e.g. pick complete) outside useTaskProgressSave. */
export function useTaskMutationCacheRefresh(ctx: Ctx) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = orderRef(ctx);

  return {
    refreshFromEnvelope: (env: TaskMutationEnvelope) => {
      applyTaskMutationEnvelope(qc, {
        taskId: ctx.taskId,
        envelope: env,
        warehouseId: ctx.warehouseId,
        ...ref,
      });
    },
    showError: (e: Error) => toast.error(e.message),
  };
}
