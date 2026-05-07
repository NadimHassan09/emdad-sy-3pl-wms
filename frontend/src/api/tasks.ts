import { PageResult, api } from './client';

export type ResolveTaskResolution =
  | 'resume'
  | 'cancel_remaining'
  | 'approve_partial'
  | 'fork_new_task';

export interface WarehouseTaskListItem {
  id: string;
  taskType: string;
  status: string;
  /** Server-computed frontier flag for workflow ordering. */
  is_current_runnable?: boolean;
  /** Null when runnable; stable code when blocked (ordering or skills). */
  runnability_blocked_reason?: string | null;
  workflowInstance?: {
    id: string;
    referenceType: string;
    referenceId: string;
    warehouseId: string;
  };
  assignments?: Array<{ worker?: { id: string; displayName: string } }>;
}

export interface TaskMutationEnvelope {
  task: unknown;
  workflowInstance: Record<string, unknown> | null;
  assignments?: unknown[];
  orderSummary?: unknown;
}

export const TasksApi = {
  async list(filters: Record<string, string | undefined>) {
    const { data } = await api.get<PageResult<WarehouseTaskListItem>>('/tasks', {
      params: filters,
    });
    return data;
  },

  async get(id: string) {
    const { data } = await api.get<WarehouseTaskListItem & Record<string, unknown>>(`/tasks/${id}`);
    return data;
  },

  assign(id: string, workerId: string) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/assign`, { workerId }).then((r) => r.data);
  },

  start(id: string, workerId?: string) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/start`, { workerId }).then((r) => r.data);
  },

  complete(id: string, body: unknown) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/complete`, body).then((r) => r.data);
  },

  cancel(id: string, reason?: string) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/cancel`, { reason }).then((r) => r.data);
  },

  patchProgress(id: string, execution_state_patch: Record<string, unknown>) {
    return api
      .put<TaskMutationEnvelope>(`/tasks/${id}/progress`, { execution_state_patch })
      .then((r) => r.data);
  },

  leaseAcquire(id: string, body?: { minutes?: number }) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/lease`, body ?? {}).then((r) => r.data);
  },

  leaseRelease(id: string) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/lease/release`, {}).then((r) => r.data);
  },

  async getPathOrder(id: string): Promise<{ orderedIds: string[]; source: string }> {
    const { data } = await api.get<{ orderedIds: string[]; source: string }>(`/tasks/${id}/path-order`);
    return data;
  },

  skip(id: string, body: { skip_target: 'qc' | 'pack'; reason: string }) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/skip`, body).then((r) => r.data);
  },

  retry(id: string, body?: { reason?: string }) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/retry`, body ?? {}).then((r) => r.data);
  },

  resolve(
    id: string,
    body: { resolution: ResolveTaskResolution; reason: string; fork_hint?: string },
  ) {
    return api.post<TaskMutationEnvelope>(`/tasks/${id}/resolve`, body).then((r) => r.data);
  },
};
