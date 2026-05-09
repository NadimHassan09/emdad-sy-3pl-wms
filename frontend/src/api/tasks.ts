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
    companyId?: string;
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

function companyHeaders(companyIdOverride?: string) {
  return companyIdOverride ? { headers: { 'X-Company-Id': companyIdOverride } } : undefined;
}

export const TasksApi = {
  async list(filters: Record<string, string | undefined>, companyIdOverride?: string) {
    const { data } = await api.get<PageResult<WarehouseTaskListItem>>('/tasks', {
      params: filters,
      ...(companyHeaders(companyIdOverride) ?? {}),
    });
    return data;
  },

  async get(id: string, companyIdOverride?: string) {
    const { data } = await api.get<WarehouseTaskListItem & Record<string, unknown>>(
      `/tasks/${id}`,
      companyHeaders(companyIdOverride),
    );
    return data;
  },

  assign(id: string, workerId: string, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/assign`, { workerId }, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  start(id: string, workerId?: string, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/start`, { workerId }, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  complete(id: string, body: unknown, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/complete`, body, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  cancel(id: string, reason?: string, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/cancel`, { reason }, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  patchProgress(id: string, execution_state_patch: Record<string, unknown>, companyIdOverride?: string) {
    return api
      .put<TaskMutationEnvelope>(
        `/tasks/${id}/progress`,
        { execution_state_patch },
        companyHeaders(companyIdOverride),
      )
      .then((r) => r.data);
  },

  leaseAcquire(id: string, body?: { minutes?: number }, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/lease`, body ?? {}, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  leaseRelease(id: string, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/lease/release`, {}, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  async getPathOrder(id: string, companyIdOverride?: string): Promise<{ orderedIds: string[]; source: string }> {
    const { data } = await api.get<{ orderedIds: string[]; source: string }>(
      `/tasks/${id}/path-order`,
      companyHeaders(companyIdOverride),
    );
    return data;
  },

  skip(id: string, body: { skip_target: 'qc' | 'pack'; reason: string }, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/skip`, body, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  retry(id: string, body?: { reason?: string }, companyIdOverride?: string) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/retry`, body ?? {}, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },

  resolve(
    id: string,
    body: { resolution: ResolveTaskResolution; reason: string; fork_hint?: string },
    companyIdOverride?: string,
  ) {
    return api
      .post<TaskMutationEnvelope>(`/tasks/${id}/resolve`, body, companyHeaders(companyIdOverride))
      .then((r) => r.data);
  },
};
