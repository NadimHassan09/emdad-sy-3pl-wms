import type { QueryClient } from '@tanstack/react-query';

import { QK } from '../constants/query-keys';

/** Admin Consistency Group helpers (Architecture §7). */
export function invalidateAdminOmsConsistencyGroup(qc: QueryClient, orderId?: string): void {
  void qc.invalidateQueries({ queryKey: QK.omsOrders });
  if (orderId) {
    void qc.invalidateQueries({ queryKey: [...QK.omsOrders, orderId] });
  }
  void qc.invalidateQueries({ queryKey: QK.omsDashboard });
  void qc.invalidateQueries({ queryKey: QK.outboundOrders });
  void qc.invalidateQueries({ queryKey: QK.dashboardOverview });
}

export function invalidateAdminClientsConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: QK.companies });
  void qc.invalidateQueries({ queryKey: QK.dashboardOverview });
  void qc.invalidateQueries({ queryKey: QK.billing.all });
  void qc.invalidateQueries({ queryKey: QK.billing.dashboardSummary });
  void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
}

export function invalidateAdminCodConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['oms-cod-records'] });
  void qc.invalidateQueries({ queryKey: QK.omsDashboard });
}

export function invalidateAdminOmsReturnsConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['oms-returns'] });
  void qc.invalidateQueries({ queryKey: QK.omsDashboard });
  void qc.invalidateQueries({ queryKey: QK.returns.all });
}

export function invalidateAdminDocumentsConsistencyGroup(
  qc: QueryClient,
  payload?: { referenceType?: string; referenceId?: string },
): void {
  void qc.invalidateQueries({ queryKey: QK.contracts });
  void qc.invalidateQueries({ queryKey: QK.contractsGrn });
  void qc.invalidateQueries({ queryKey: QK.contractsDn });
  void qc.invalidateQueries({ queryKey: QK.contractsFinalContract });
  if (payload?.referenceType && payload?.referenceId) {
    void qc.invalidateQueries({
      queryKey: ['documents', payload.referenceType, payload.referenceId],
    });
  } else {
    void qc.invalidateQueries({ queryKey: ['documents'] });
  }
}

export function invalidateAdminFormsConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: QK.forms.all });
}

export function invalidateAdminBillingInvoicesPlansGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: QK.billing.all });
  void qc.invalidateQueries({ queryKey: QK.billing.invoices });
  void qc.invalidateQueries({ queryKey: QK.billing.plans });
  void qc.invalidateQueries({ queryKey: QK.billing.capacity });
  void qc.invalidateQueries({ queryKey: QK.billing.dashboardSummary });
  void qc.invalidateQueries({ queryKey: QK.billing.dashboardAnalytics });
  void qc.invalidateQueries({ queryKey: QK.billing.recentInvoices });
  void qc.invalidateQueries({ queryKey: QK.billing.overdueClients });
  void qc.invalidateQueries({ queryKey: QK.billing.expiringSoon });
  void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
}

export function patchAdminBackupJobProgress(
  qc: QueryClient,
  payload: {
    jobId?: string;
    status?: string;
    progressPercent?: number;
    bytesWritten?: string | number;
    errorMessage?: string | null;
  },
): void {
  if (!payload?.jobId) return;
  const { jobId } = payload;
  void qc.setQueryData(QK.backups.status(jobId), (prev: Record<string, unknown> | undefined) => ({
    ...(prev ?? { id: jobId }),
    id: jobId,
    status: payload.status ?? prev?.status,
    progressPercent: payload.progressPercent ?? prev?.progressPercent,
    bytesWritten:
      payload.bytesWritten != null ? String(payload.bytesWritten) : prev?.bytesWritten,
    errorMessage: payload.errorMessage ?? prev?.errorMessage,
  }));
  void qc.invalidateQueries({ queryKey: QK.backups.all });
  void qc.invalidateQueries({ queryKey: QK.backups.activeOperation });
  if (payload.status === 'completed' || payload.status === 'failed') {
    void qc.invalidateQueries({ queryKey: QK.backups.health });
    void qc.invalidateQueries({ queryKey: QK.backups.auditRecent });
    void qc.invalidateQueries({ queryKey: QK.backups.detail(jobId) });
  }
}
