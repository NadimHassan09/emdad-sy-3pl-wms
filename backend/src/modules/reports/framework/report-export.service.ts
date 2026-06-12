import { Injectable } from '@nestjs/common';

import type { RunReportQueryDto } from '../dto/run-report-query.dto';
import {
  reportRowsToCsv,
  reportRowsToXls,
  type ReportExportColumn,
  type ReportExportRow,
} from '../reports-export.util';
import { ReportsPolicyConfig } from '../reports-policy.config';
import type { ReportRunPayload } from './report-framework.types';
import { getReportDefinition } from './report-registry.config';

export type ReportExportResult = {
  format: 'csv' | 'xls';
  rowCount: number;
  truncated: boolean;
  body: string;
  filename: string;
};

@Injectable()
export class ReportExportService {
  constructor(private readonly policy: ReportsPolicyConfig) {}

  async buildExport(
    reportId: string,
    query: RunReportQueryDto,
    format: 'csv' | 'xls',
    fetchPage: (offset: number, limit: number) => Promise<ReportRunPayload>,
  ): Promise<ReportExportResult> {
    const def = getReportDefinition(reportId);
    const columns: ReportExportColumn[] = def?.exportColumns ?? [];
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = def?.exportFileName ?? reportId;

    const rows: ReportExportRow[] = [];
    let offset = 0;
    const pageSize = 500;
    let total = 0;
    let truncated = false;

    while (rows.length < this.policy.exportMaxRows) {
      const page = await fetchPage(
        offset,
        Math.min(pageSize, this.policy.exportMaxRows - rows.length),
      );
      total = page.total;
      rows.push(...page.items);
      offset += page.items.length;
      if (page.items.length === 0 || rows.length >= total) break;
      if (rows.length >= this.policy.exportMaxRows) {
        truncated = total > this.policy.exportMaxRows;
        break;
      }
    }

    const body =
      format === 'xls' ? reportRowsToXls(columns, rows) : reportRowsToCsv(columns, rows);

    return {
      format,
      rowCount: rows.length,
      truncated,
      body,
      filename: format === 'xls' ? `${baseName}-${stamp}.xls` : `${baseName}-${stamp}.csv`,
    };
  }
}
