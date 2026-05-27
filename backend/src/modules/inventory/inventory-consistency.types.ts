export type InventoryConsistencySeverity = 'critical' | 'warning' | 'info';

export type InventoryConsistencyCode =
  | 'NEGATIVE_ON_HAND'
  | 'NEGATIVE_RESERVED'
  | 'NEGATIVE_AVAILABLE'
  | 'RESERVED_EXCEEDS_ON_HAND'
  | 'AVAILABLE_FORMULA_MISMATCH'
  | 'STOCK_RESERVATION_TABLE_DRIFT'
  | 'TASK_RESERVATION_STOCK_DRIFT'
  | 'OUTBOUND_PICKED_EXCEEDS_REQUESTED'
  | 'OUTBOUND_NEGATIVE_PICKED'
  | 'OUTBOUND_ALLOCATED_PICKED_MISMATCH'
  | 'OUTBOUND_PICKED_WITHOUT_RESERVATION'
  | 'CONCURRENT_ACTIVE_PICKS'
  | 'STALE_PICK_RESERVATION_SNAPSHOT';

export interface InventoryConsistencyFinding {
  code: InventoryConsistencyCode;
  severity: InventoryConsistencySeverity;
  message: string;
  companyId?: string;
  productId?: string;
  locationId?: string;
  lotId?: string | null;
  warehouseId?: string;
  outboundOrderId?: string;
  outboundOrderLineId?: string;
  workflowInstanceId?: string;
  taskId?: string;
  details?: Record<string, unknown>;
}

export interface InventoryConsistencyReport {
  generatedAt: string;
  scope: { companyId?: string; warehouseId?: string };
  summary: {
    critical: number;
    warning: number;
    info: number;
    stockRowsChecked: number;
    outboundLinesChecked: number;
    pickTasksChecked: number;
  };
  findings: InventoryConsistencyFinding[];
  healthy: boolean;
}
