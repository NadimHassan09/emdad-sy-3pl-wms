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

export const WorkersApi = {
  async list(warehouseId?: string) {
    const { data } = await api.get<WorkerRow[]>('/workers', {
      params: warehouseId ? { warehouseId } : undefined,
    });
    return data;
  },

  async listLoad(warehouseId?: string) {
    const { data } = await api.get<WorkerLoadRow[]>('/workers/load', {
      params: warehouseId ? { warehouseId } : undefined,
    });
    return data;
  },

  async create(body: { displayName: string; warehouseId?: string; roles: string[] }) {
    const { data } = await api.post<WorkerRow>('/workers', body);
    return data;
  },

  async get(id: string) {
    const { data } = await api.get<WorkerRow & { openTaskCount?: number }>(`/workers/${id}`);
    return data;
  },
};
