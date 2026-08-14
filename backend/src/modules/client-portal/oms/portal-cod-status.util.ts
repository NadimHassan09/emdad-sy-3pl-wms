import { CodRecordStatus } from '@prisma/client';

/**
 * Map CodRecord status → portal COD labels.
 * Kept as a pure export for unit tests (mirrors client-oms-orders.service).
 */
export function portalCodStatusFromRecord(status: CodRecordStatus): string {
  switch (status) {
    case CodRecordStatus.available:
      return 'collected';
    case CodRecordStatus.paid_out:
      return 'remitted';
    case CodRecordStatus.returned:
      return 'returned';
    case CodRecordStatus.pending:
    default:
      return 'pending';
  }
}
