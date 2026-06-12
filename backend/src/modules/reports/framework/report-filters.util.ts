import { BadRequestException } from '@nestjs/common';

import type { RunReportQueryDto } from '../dto/run-report-query.dto';
import type { ReportDefinitionConfig } from './report-framework.types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validateReportFilters(
  def: ReportDefinitionConfig,
  query: RunReportQueryDto,
): void {
  if (def.requiresWarehouse && !query.warehouseId?.trim()) {
    throw new BadRequestException('warehouseId is required for this report.');
  }

  if (def.filterKeys.includes('dateRange')) {
    if (query.dateFrom && !DAY.test(query.dateFrom)) {
      throw new BadRequestException('dateFrom must be YYYY-MM-DD.');
    }
    if (query.dateTo && !DAY.test(query.dateTo)) {
      throw new BadRequestException('dateTo must be YYYY-MM-DD.');
    }
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new BadRequestException('dateFrom must be on or before dateTo.');
    }
  }

  if (!def.filterKeys.includes('status') && query.status?.trim()) {
    throw new BadRequestException('status filter is not supported for this report.');
  }

  if (!def.filterKeys.includes('sku') && query.sku?.trim()) {
    throw new BadRequestException('sku filter is not supported for this report.');
  }
}

export function normalizeReportQuery(query: RunReportQueryDto): RunReportQueryDto {
  return {
    ...query,
    warehouseId: query.warehouseId?.trim() || undefined,
    companyId: query.companyId?.trim() || undefined,
    status: query.status?.trim() || undefined,
    sku: query.sku?.trim() || undefined,
    dateFrom: query.dateFrom?.trim() || undefined,
    dateTo: query.dateTo?.trim() || undefined,
    groupBy: query.groupBy?.trim() || undefined,
  };
}
