import type { QueryClient } from '@tanstack/react-query';

import { QK } from '../constants/query-keys';

/**
 * After task/order workflow mutations — matches plan invalidation intents.
 */
export function invalidateWorkflowTasksInventory(
  qc: QueryClient,
  opts?: { referenceId?: string; referenceType?: 'inbound_order' | 'outbound_order' },
) {
  if (opts?.referenceId) {
    qc.invalidateQueries({ queryKey: QK.workflows.workflowTimelineByRef(opts.referenceId) });
  }
  qc.invalidateQueries({ queryKey: ['workflow-timeline'] });
  if (opts?.referenceType && opts?.referenceId) {
    qc.invalidateQueries({
      queryKey: QK.workflows.timeline(opts.referenceType, opts.referenceId),
    });
  }
  qc.invalidateQueries({ queryKey: QK.tasks.all });
  qc.invalidateQueries({ queryKey: QK.inventoryStock });
  qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct });
  qc.invalidateQueries({ queryKey: QK.ledger });
}
