import { api } from './client';

export interface WorkerRow {
  id: string;
  displayName: string;
  status: string;
  roles: Array<{ role: string }>;
  /** Present for task-assignable rows (system `wh_operator` user linked via `user_id`). */
  user?: { id: string; email: string; fullName: string; role: string } | null;
}

export interface WorkerLoadRow {
  workerId: string;
  displayName: string;
  inProgressCount: number;
  assignedPendingCount: number;
  loadScore: number;
}

export type WorkerListParams = {
  warehouseId?: string;
  /** Client tenant for the task/order context (required when session has no active tenant). */
  companyId?: string;
};

export const WorkersApi = {
  async list(params?: WorkerListParams) {
    const query: Record<string, string> = {};
    if (params?.warehouseId) query.warehouseId = params.warehouseId;
    if (params?.companyId) query.companyId = params.companyId;
    const { data } = await api.get<WorkerRow[]>('/workers', {
      params: Object.keys(query).length ? query : undefined,
    });
    return data;
  },

  async listUnlinked() {
    const { data } = await api.get<WorkerRow[]>('/workers/unlinked');
    return data;
  },

  async listLoad(params?: WorkerListParams) {
    const query: Record<string, string> = {};
    if (params?.warehouseId) query.warehouseId = params.warehouseId;
    if (params?.companyId) query.companyId = params.companyId;
    const { data } = await api.get<WorkerLoadRow[]>('/workers/load', {
      params: Object.keys(query).length ? query : undefined,
    });
    return data;
  },

  async create(body: { displayName: string; warehouseId?: string; roles: string[] }) {
    const { data } = await api.post<WorkerRow>('/workers', body);
    return data;
  },
};
