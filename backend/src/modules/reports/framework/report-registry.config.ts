import { UserRole } from '@prisma/client';

import type { ReportExportColumn } from '../reports-export.util';
import type { ReportDefinitionConfig } from './report-framework.types';

const ADMIN_REPORT_ROLES = [
  UserRole.super_admin,
  UserRole.wh_manager,
  UserRole.finance,
] as const;

const INVENTORY_COLUMNS: ReportExportColumn[] = [
  { id: 'sku', header: 'SKU' },
  { id: 'product', header: 'Product' },
  { id: 'client', header: 'Client' },
  { id: 'location', header: 'Location' },
  { id: 'lot', header: 'Lot' },
  { id: 'expiry', header: 'Expiry' },
  { id: 'onHand', header: 'On hand' },
  { id: 'reserved', header: 'Reserved' },
  { id: 'available', header: 'Available' },
  { id: 'stockStatus', header: 'Status' },
  { id: 'uom', header: 'UoM' },
  { id: 'warehouse', header: 'Warehouse' },
];

const MOVES_COLUMNS: ReportExportColumn[] = [
  { id: 'date', header: 'Date' },
  { id: 'product', header: 'Product' },
  { id: 'sku', header: 'SKU' },
  { id: 'client', header: 'Client' },
  { id: 'movement', header: 'Movement' },
  { id: 'status', header: 'Status' },
  { id: 'quantity', header: 'Qty' },
  { id: 'reference', header: 'Reference' },
  { id: 'operator', header: 'Operator' },
  { id: 'lot', header: 'Lot' },
  { id: 'fromLocation', header: 'From' },
  { id: 'toLocation', header: 'To' },
];

const WAREHOUSE_COLUMNS: ReportExportColumn[] = [
  { id: 'week', header: 'Week' },
  { id: 'inboundCount', header: 'Inbound' },
  { id: 'outboundCount', header: 'Outbound' },
  { id: 'totalCount', header: 'Total' },
];

const BILLING_REVENUE_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'invoiceCount', header: 'Invoices' },
  { id: 'revenue', header: 'Revenue' },
];

const BILLING_OUTSTANDING_COLUMNS: ReportExportColumn[] = [
  { id: 'invoiceNumber', header: 'Invoice #' },
  { id: 'client', header: 'Client' },
  { id: 'status', header: 'Status' },
  { id: 'amount', header: 'Amount' },
  { id: 'issuedAt', header: 'Issued' },
];

const BILLING_EXPIRING_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'daysRemaining', header: 'Days remaining' },
  { id: 'cycleEnd', header: 'Cycle end' },
];

const BILLING_SUSPENDED_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'suspendedSince', header: 'Suspended since' },
];

const BILLING_CAPACITY_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'allocatedVolumeCbm', header: 'Allocated CBM' },
  { id: 'allocatedWeightKg', header: 'Allocated kg' },
];

const WORKER_PRODUCTIVITY_COLUMNS: ReportExportColumn[] = [
  { id: 'worker', header: 'Worker' },
  { id: 'completedTasks', header: 'Completed tasks' },
  { id: 'taskTypes', header: 'Task types' },
  { id: 'avgCycleHours', header: 'Avg cycle (h)' },
  { id: 'pickPackCount', header: 'Pick/pack count' },
];

const ORDER_CYCLE_TIME_COLUMNS: ReportExportColumn[] = [
  { id: 'orderType', header: 'Order type' },
  { id: 'orderNumber', header: 'Order #' },
  { id: 'client', header: 'Client' },
  { id: 'status', header: 'Status' },
  { id: 'cycleHours', header: 'Cycle (h)' },
  { id: 'milestoneStart', header: 'Start' },
  { id: 'milestoneEnd', header: 'End' },
];

const INBOUND_ACCURACY_COLUMNS: ReportExportColumn[] = [
  { id: 'orderNumber', header: 'Order #' },
  { id: 'client', header: 'Client' },
  { id: 'status', header: 'Status' },
  { id: 'lineCount', header: 'Lines' },
  { id: 'discrepancyLines', header: 'Discrepancies' },
  { id: 'accuracyPercent', header: 'Accuracy %' },
  { id: 'receivedVsExpected', header: 'Received/expected' },
];

const OUTBOUND_FILL_RATE_COLUMNS: ReportExportColumn[] = [
  { id: 'orderNumber', header: 'Order #' },
  { id: 'client', header: 'Client' },
  { id: 'status', header: 'Status' },
  { id: 'requestedQty', header: 'Requested' },
  { id: 'pickedQty', header: 'Picked' },
  { id: 'fillRatePercent', header: 'Fill rate %' },
  { id: 'shortShip', header: 'Short ship' },
];

const SLA_COMPLIANCE_COLUMNS: ReportExportColumn[] = [
  { id: 'taskType', header: 'Task type' },
  { id: 'totalTasks', header: 'Total tasks' },
  { id: 'onTimeTasks', header: 'On time' },
  { id: 'breachedTasks', header: 'Breached' },
  { id: 'escalatedTasks', header: 'Escalated' },
  { id: 'compliancePercent', header: 'Compliance %' },
];

const STOCK_AGING_COLUMNS: ReportExportColumn[] = [
  { id: 'sku', header: 'SKU' },
  { id: 'product', header: 'Product' },
  { id: 'client', header: 'Client' },
  { id: 'location', header: 'Location' },
  { id: 'lastMovement', header: 'Last movement' },
  { id: 'daysSinceMovement', header: 'Days since movement' },
  { id: 'agingBucket', header: 'Aging bucket' },
  { id: 'onHand', header: 'On hand' },
  { id: 'stagnant', header: 'Stagnant' },
];

const LOT_EXPIRY_COLUMNS: ReportExportColumn[] = [
  { id: 'sku', header: 'SKU' },
  { id: 'product', header: 'Product' },
  { id: 'lot', header: 'Lot' },
  { id: 'expiry', header: 'Expiry' },
  { id: 'daysUntil', header: 'Days until expiry' },
  { id: 'agingBucket', header: 'Expiry bucket' },
  { id: 'location', header: 'Location' },
  { id: 'quantity', header: 'Quantity' },
];

const CAPACITY_UTILIZATION_COLUMNS: ReportExportColumn[] = [
  { id: 'location', header: 'Location' },
  { id: 'type', header: 'Type' },
  { id: 'skuCount', header: 'SKU count' },
  { id: 'totalQty', header: 'Total qty' },
  { id: 'utilization', header: 'Utilization' },
];

const RETURN_RATE_COLUMNS: ReportExportColumn[] = [
  { id: 'client', header: 'Client' },
  { id: 'outboundOrders', header: 'Outbound orders' },
  { id: 'returnOrders', header: 'Return orders' },
  { id: 'returnRatePercent', header: 'Return rate %' },
];

export const REPORT_REGISTRY: readonly ReportDefinitionConfig[] = [
  {
    id: 'warehouse-analysis',
    title: 'Warehouse Analysis',
    filterKeys: ['warehouse', 'client', 'dateRange'],
    exportColumns: WAREHOUSE_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: true,
    supportsAggregate: true,
    exportFileName: 'warehouse-analysis',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    filterKeys: ['warehouse', 'client', 'sku', 'status'],
    exportColumns: INVENTORY_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'inventory',
  },
  {
    id: 'product-moves',
    title: 'Product Moves',
    filterKeys: ['warehouse', 'client', 'sku', 'status', 'dateRange', 'groupBy'],
    exportColumns: MOVES_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'product-moves',
  },
  {
    id: 'billing-revenue',
    title: 'Billing Revenue',
    filterKeys: ['client'],
    exportColumns: BILLING_REVENUE_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: false,
    supportsKpis: false,
    supportsAggregate: false,
    exportFileName: 'billing-revenue',
  },
  {
    id: 'billing-outstanding',
    title: 'Outstanding Invoices',
    filterKeys: ['client'],
    exportColumns: BILLING_OUTSTANDING_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: false,
    supportsKpis: false,
    supportsAggregate: false,
    exportFileName: 'billing-outstanding',
  },
  {
    id: 'billing-expiring',
    title: 'Expiring Billing Cycles',
    filterKeys: ['client'],
    exportColumns: BILLING_EXPIRING_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: false,
    supportsKpis: false,
    supportsAggregate: false,
    exportFileName: 'billing-expiring',
  },
  {
    id: 'billing-suspended',
    title: 'Suspended Accounts',
    filterKeys: ['client'],
    exportColumns: BILLING_SUSPENDED_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: false,
    supportsKpis: false,
    supportsAggregate: false,
    exportFileName: 'billing-suspended',
  },
  {
    id: 'billing-capacity',
    title: 'Capacity Allocation',
    filterKeys: ['client'],
    exportColumns: BILLING_CAPACITY_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: false,
    supportsKpis: false,
    supportsAggregate: false,
    exportFileName: 'billing-capacity',
  },
  {
    id: 'worker-productivity',
    title: 'Worker Productivity',
    filterKeys: ['warehouse', 'client', 'dateRange', 'status'],
    exportColumns: WORKER_PRODUCTIVITY_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'worker-productivity',
  },
  {
    id: 'order-cycle-time',
    title: 'Order Cycle Time',
    filterKeys: ['warehouse', 'client', 'dateRange'],
    exportColumns: ORDER_CYCLE_TIME_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'order-cycle-time',
  },
  {
    id: 'inbound-accuracy',
    title: 'Inbound Accuracy',
    filterKeys: ['warehouse', 'client', 'dateRange'],
    exportColumns: INBOUND_ACCURACY_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'inbound-accuracy',
  },
  {
    id: 'outbound-fill-rate',
    title: 'Outbound Fill Rate',
    filterKeys: ['warehouse', 'client', 'dateRange'],
    exportColumns: OUTBOUND_FILL_RATE_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'outbound-fill-rate',
  },
  {
    id: 'sla-compliance',
    title: 'SLA Compliance',
    filterKeys: ['warehouse', 'client', 'dateRange', 'status'],
    exportColumns: SLA_COMPLIANCE_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'sla-compliance',
  },
  {
    id: 'stock-aging',
    title: 'Stock Aging',
    filterKeys: ['warehouse', 'client', 'sku', 'status'],
    exportColumns: STOCK_AGING_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'stock-aging',
  },
  {
    id: 'lot-expiry',
    title: 'Lot Expiry',
    filterKeys: ['warehouse', 'client', 'sku', 'status'],
    exportColumns: LOT_EXPIRY_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'lot-expiry',
  },
  {
    id: 'capacity-utilization',
    title: 'Capacity Utilization',
    filterKeys: ['warehouse', 'client', 'sku'],
    exportColumns: CAPACITY_UTILIZATION_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'capacity-utilization',
  },
  {
    id: 'return-rate',
    title: 'Return Rate',
    filterKeys: ['warehouse', 'client', 'dateRange'],
    exportColumns: RETURN_RATE_COLUMNS,
    allowedRoles: ADMIN_REPORT_ROLES,
    requiresWarehouse: true,
    supportsKpis: false,
    supportsAggregate: true,
    exportFileName: 'return-rate',
  },
] as const;

export function getReportDefinition(reportId: string): ReportDefinitionConfig | undefined {
  return REPORT_REGISTRY.find((r) => r.id === reportId);
}

export function listReportIds(): string[] {
  return REPORT_REGISTRY.map((r) => r.id);
}
