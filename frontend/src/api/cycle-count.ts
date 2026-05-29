import { api } from './client';

export type CycleCountStatus =
  | 'scheduled'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'cancelled';

export type CycleCountLineStatus = 'pending' | 'counted' | 'skipped';

export type CycleCountSource = 'scheduled' | 'manual';

export type VarianceReasonCode =
  | 'damaged'
  | 'lost'
  | 'misplaced'
  | 'theft_suspected'
  | 'counting_mistake'
  | 'operational_correction'
  | 'unknown';

export type CycleCountVarianceStatus = 'pending_review' | 'approved' | 'rejected' | 'posted';

export interface CycleCountListItem {
  id: string;
  companyId: string;
  warehouseId: string;
  status: CycleCountStatus;
  source: CycleCountSource;
  snapshotAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  company: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
  assignedWorker: { id: string; displayName: string } | null;
  schedule?: { id: string; intervalDays: number } | null;
  _count: { lines: number };
}

export interface CycleCountLine {
  id: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  expectedQuantity: string;
  actualQuantity: string | null;
  discrepancyQuantity: string | null;
  status: CycleCountLineStatus;
  assignedWorkerId: string | null;
  countedAt: string | null;
  countNotes: string | null;
  product: { id: string; sku: string; name: string; barcode: string | null; uom: string };
  location: { id: string; name: string; fullPath: string; barcode: string };
  lot: { id: string; lotNumber: string } | null;
  assignedWorker: { id: string; displayName: string } | null;
  counter: { id: string; fullName: string } | null;
}

export interface CycleCountDetail {
  id: string;
  companyId: string;
  warehouseId: string;
  status: CycleCountStatus;
  source: CycleCountSource;
  blindCount: boolean;
  snapshotAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  company: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
  schedule: { id: string; intervalDays: number } | null;
  assignedWorker: { id: string; displayName: string } | null;
  creator: { id: string; fullName: string };
  lines: CycleCountLine[];
  variancesDetected?: number;
}

export interface CycleCountSchedule {
  id: string;
  companyId: string;
  warehouseId: string;
  intervalDays: number;
  enabled: boolean;
  includeZeroOnHand: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  company: { id: string; name: string };
  warehouse: { id: string; code: string; name: string };
}

export interface CycleCountProductHistoryRow {
  id: string;
  companyId: string;
  warehouseId: string;
  productId: string;
  lastCountedAt: string;
  nextDueAt: string | null;
  completionCount: number;
  product: { id: string; sku: string; name: string };
}

export interface CycleCountVariance {
  id: string;
  cycleCountId: string;
  status: CycleCountVarianceStatus;
  reasonCode: VarianceReasonCode | null;
  reviewNotes: string | null;
  expectedQuantity: string;
  actualQuantity: string;
  discrepancyQuantity: string;
  product: { id: string; sku: string; name: string; uom: string };
  location: { id: string; name: string; fullPath: string; barcode: string };
  lot: { id: string; lotNumber: string } | null;
  reviewer: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  stockAdjustment: { id: string; status: string; approvedAt: string | null } | null;
}

export interface BlindCycleCountTaskListItem {
  id: string;
  warehouse: { id: string; code: string; name: string };
  status: CycleCountStatus;
  snapshotAt: string | null;
  startedAt: string | null;
  progress: { totalLines: number; pending: number };
  assignmentScope: 'session' | 'line' | 'pool';
}

export interface BlindCycleCountLocationLine {
  lineId: string;
  status: CycleCountLineStatus;
  location: { id: string; name: string; fullPath: string; barcode: string };
  lot: { id: string; lotNumber: string } | null;
  actualQuantity?: string | null;
  countedAt?: string | null;
  countNotes?: string | null;
}

export interface BlindCycleCountProductGroup {
  productId: string;
  sku: string;
  name: string;
  barcode: string | null;
  uom: string;
  locations: BlindCycleCountLocationLine[];
  pendingCount: number;
  completedCount: number;
}

export interface BlindCycleCountTask {
  id: string;
  companyId: string;
  warehouseId: string;
  status: CycleCountStatus;
  blindCount: boolean;
  snapshotAt: string | null;
  startedAt: string | null;
  warehouse: { id: string; code: string; name: string };
  progress: { totalLines: number; pending: number; counted: number; skipped: number };
  products: BlindCycleCountProductGroup[];
}

export interface ListCycleCountsQuery {
  companyId?: string;
  warehouseId?: string;
  status?: CycleCountStatus;
  limit?: number;
  offset?: number;
}

export interface ListProductHistoryQuery {
  warehouseId: string;
  companyId?: string;
  productId?: string;
  limit?: number;
  offset?: number;
}

export const CycleCountApi = {
  listCounts(query: ListCycleCountsQuery = {}) {
    return api.get<CycleCountListItem[]>('/cycle-count/counts', {
      params: { limit: 100, ...query },
    }).then((r) => r.data);
  },

  getCount(id: string) {
    return api.get<CycleCountDetail>(`/cycle-count/counts/${id}`).then((r) => r.data);
  },

  createCount(body: { warehouseId: string; companyId?: string; productIds?: string[]; notes?: string; assignedWorkerId?: string }) {
    return api.post<CycleCountDetail>('/cycle-count/counts', body).then((r) => r.data);
  },

  startCount(id: string) {
    return api.post<CycleCountDetail>(`/cycle-count/counts/${id}/start`).then((r) => r.data);
  },

  submitReview(id: string) {
    return api.post<CycleCountDetail & { variancesDetected?: number }>(`/cycle-count/counts/${id}/submit-review`).then((r) => r.data);
  },

  complete(id: string) {
    return api.post<CycleCountDetail>(`/cycle-count/counts/${id}/complete`).then((r) => r.data);
  },

  cancel(id: string) {
    return api.post<CycleCountDetail>(`/cycle-count/counts/${id}/cancel`).then((r) => r.data);
  },

  assignCount(id: string, assignedWorkerId: string | null) {
    return api.patch<CycleCountDetail>(`/cycle-count/counts/${id}/assign`, { assignedWorkerId }).then((r) => r.data);
  },

  listSchedules(companyId?: string) {
    return api.get<CycleCountSchedule[]>('/cycle-count/schedules', {
      params: companyId ? { companyId } : undefined,
    }).then((r) => r.data);
  },

  listProductHistory(query: ListProductHistoryQuery) {
    return api.get<CycleCountProductHistoryRow[]>('/cycle-count/product-history', {
      params: { limit: 500, ...query },
    }).then((r) => r.data);
  },

  listVariances(params?: { companyId?: string; cycleCountId?: string; status?: CycleCountVarianceStatus }) {
    return api.get<CycleCountVariance[]>('/cycle-count/variances', { params }).then((r) => r.data);
  },

  listCountVariances(countId: string) {
    return api.get<CycleCountVariance[]>(`/cycle-count/counts/${countId}/variances`).then((r) => r.data);
  },

  reviewVariance(id: string, body: { action: 'approve' | 'reject'; reasonCode?: VarianceReasonCode; reviewNotes?: string }) {
    return api.patch<CycleCountVariance>(`/cycle-count/variances/${id}/review`, body).then((r) => r.data);
  },

  buildReconciliation(countId: string) {
    return api.post<unknown>(`/cycle-count/counts/${countId}/reconcile`).then((r) => r.data);
  },

  postReconciliation(countId: string) {
    return api.post<{ cycleCountId: string; variancesPosted: number }>(`/cycle-count/counts/${countId}/post-reconciliation`).then((r) => r.data);
  },

  listReasonCodes() {
    return api.get<{ codes: VarianceReasonCode[] }>('/cycle-count/variances/reason-codes').then((r) => r.data);
  },

  // Worker execution
  listMyTasks(warehouseId?: string) {
    return api.get<BlindCycleCountTaskListItem[]>('/cycle-count/execution/tasks', {
      params: warehouseId ? { warehouseId } : undefined,
    }).then((r) => r.data);
  },

  getExecutionTask(id: string) {
    return api.get<BlindCycleCountTask>(`/cycle-count/execution/tasks/${id}`).then((r) => r.data);
  },

  claimTask(id: string) {
    return api.get<BlindCycleCountTask>(`/cycle-count/execution/tasks/${id}`).then((r) => r.data);
  },

  async claimExecutionTask(id: string) {
    return api.post<BlindCycleCountTask>(`/cycle-count/execution/tasks/${id}/claim`).then((r) => r.data);
  },

  submitLineCount(countId: string, lineId: string, actualQuantity: string, countNotes?: string) {
    return api.post<BlindCycleCountTask>(`/cycle-count/execution/tasks/${countId}/lines/${lineId}/count`, {
      actualQuantity,
      countNotes,
    }).then((r) => r.data);
  },

  skipLine(countId: string, lineId: string, countNotes?: string) {
    return api.post<BlindCycleCountTask>(`/cycle-count/execution/tasks/${countId}/lines/${lineId}/skip`, {
      countNotes,
    }).then((r) => r.data);
  },

  finishTask(countId: string) {
    return api.post<{ id: string; status: string; message: string }>(`/cycle-count/execution/tasks/${countId}/finish`).then((r) => r.data);
  },
};
