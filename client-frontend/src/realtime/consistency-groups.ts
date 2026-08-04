import type { QueryClient } from '@tanstack/react-query';

/**
 * Consistency Group helper — Client Portal dashboard + operational access.
 * Architecture §7: one synchronizer updates the full sibling query set.
 */
export function invalidateClientDashboardConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['client', 'dashboard'] });
  void qc.invalidateQueries({ queryKey: ['client', 'billing'] });
}

export function invalidateClientReturnsConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['client', 'returns'] });
  void qc.invalidateQueries({ queryKey: ['client', 'oms-returns'] });
  void qc.invalidateQueries({ queryKey: ['client', 'dashboard', 'returns'] });
}

export function invalidateClientCodConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['client', 'cod-report'] });
  void qc.invalidateQueries({ queryKey: ['client', 'dashboard', 'cod-pending'] });
  void qc.invalidateQueries({ queryKey: ['client', 'dashboard', 'cod-collected'] });
  void qc.invalidateQueries({ queryKey: ['client', 'dashboard', 'cod-remitted'] });
}

export function invalidateClientBillingConsistencyGroup(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ['client', 'billing'] });
  void qc.invalidateQueries({ queryKey: ['client', 'dashboard', 'invoices-obligation'] });
  invalidateClientDashboardConsistencyGroup(qc);
}
