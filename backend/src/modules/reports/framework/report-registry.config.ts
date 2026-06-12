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
] as const;

export function getReportDefinition(reportId: string): ReportDefinitionConfig | undefined {
  return REPORT_REGISTRY.find((r) => r.id === reportId);
}

export function listReportIds(): string[] {
  return REPORT_REGISTRY.map((r) => r.id);
}
