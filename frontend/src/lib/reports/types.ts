import type { ReactNode } from 'react';

import type { ReportCatalogId } from './report-catalog';

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
  serverSide?: boolean;
  loadsWarehouseKpis?: boolean;
};
