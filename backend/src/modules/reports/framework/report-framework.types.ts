import { UserRole } from '@prisma/client';

import type { ReportExportColumn } from '../reports-export.util';

export type ReportFilterKey =
  | 'warehouse'
  | 'client'
  | 'status'
  | 'sku'
  | 'dateRange'
  | 'groupBy';

export type ReportDefinitionConfig = {
  id: string;
  title: string;
  filterKeys: ReportFilterKey[];
  exportColumns: ReportExportColumn[];
  /** Roles allowed to run/export this report. */
  allowedRoles: readonly UserRole[];
  requiresWarehouse: boolean;
  supportsKpis: boolean;
  supportsAggregate: boolean;
  exportFileName: string;
};

export type ReportRunPayload = {
  items: Record<string, string | number | boolean | null | undefined>[];
  total: number;
  limit: number;
  offset: number;
  truncated: boolean;
};

export type CachedReportResult<T> = T & { cached: boolean };
