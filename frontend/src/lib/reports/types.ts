import type { ReactNode } from 'react';

import type { ReportCatalogId } from './report-catalog';

/** @deprecated Legacy nav grouping — prefer `REPORT_CATALOG` routes. */
export type ReportCategory = 'inventory' | 'orders' | 'operations' | 'clients';

/** @deprecated Used only by legacy ReportCategoryNav. */
export const REPORT_CATEGORY_META: Record<ReportCategory, { label: string; labelAr: string }> = {
  inventory: { label: 'Inventory', labelAr: 'المخزون' },
  orders: { label: 'Orders', labelAr: 'الطلبات' },
  operations: { label: 'Operations', labelAr: 'التشغيل' },
  clients: { label: 'Clients', labelAr: 'العملاء' },
};

export type ReportViewMode = 'table' | 'graph' | 'pivot';
export type ReportChartKind = 'bar' | 'line' | 'pie';

export type ReportRow = Record<string, string | number | boolean | null | undefined> & {
  id?: string;
};

export type ReportFilterValues = {
  warehouseId: string;
  companyId: string;
  status: string;
  sku: string;
  dateFrom: string;
  dateTo: string;
  taskType: string;
  groupBy: string;
  employeeId: string;
};

export const EMPTY_REPORT_FILTERS: ReportFilterValues = {
  warehouseId: '',
  companyId: '',
  status: '',
  sku: '',
  dateFrom: '',
  dateTo: '',
  taskType: '',
  groupBy: '',
  employeeId: '',
};

export type ReportFilterKey =
  | 'warehouse'
  | 'client'
  | 'status'
  | 'sku'
  | 'dateRange'
  | 'taskType'
  | 'groupBy'
  | 'employee';

export type ReportColumnDef = {
  id: string;
  header: string;
  headerAr: string;
  cell: (row: ReportRow) => ReactNode;
  csv: (row: ReportRow) => string;
  sortValue?: (row: ReportRow) => string | number;
  sortable?: boolean;
  className?: string;
  width?: string;
};

export type GroupByOption = { value: string; label: string; labelAr: string };
export type StatusOption = { value: string; label: string; labelAr: string };

export type ReportRunContext = { defaultWarehouseId: string };

export type WarehouseKpi = {
  id: string;
  label: string;
  labelAr: string;
  value: string;
  hint?: string;
  hintAr?: string;
};

export type ReportDefinition = {
  id: ReportCatalogId;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  columns: ReportColumnDef[];
  filterKeys: ReportFilterKey[];
  statusOptions?: StatusOption[];
  groupByOptions?: GroupByOption[];
  defaultView: ReportViewMode;
  supportedViews: ReportViewMode[];
  defaultChartKind?: ReportChartKind;
  chartLabelKey?: string;
  chartValueKey?: string;
  exportFileName: string;
  usesClientAggregation?: boolean;
  missingBackendNotes?: string[];
  loadsWarehouseKpis?: boolean;
  /** @deprecated Legacy category nav only. */
  category?: ReportCategory;
  run: (filters: ReportFilterValues, ctx: ReportRunContext) => Promise<ReportRow[]>;
};

export type ReportGenerateResult = {
  rows: ReportRow[];
  kpis?: WarehouseKpi[];
  kpiError?: string;
  error?: string;
};
