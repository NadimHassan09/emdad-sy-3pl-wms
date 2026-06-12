import { ReportsApi } from '../../../api/reports';
import type { ReportApiParams } from './types';

export type ReportExportFormat = 'csv' | 'xls';

export async function exportReportDownload(
  reportId: string,
  params: ReportApiParams,
  format: ReportExportFormat = 'csv',
): Promise<void> {
  await ReportsApi.exportDownload(reportId, { ...params, format });
}
