import type { Response } from 'express';

import { rowsToCsv } from '../../modules/oms/oms-orders-csv.util';
import {
  buildExcelBuffer,
  sanitizeExcelText,
  type ExcelExportColumn,
  type ExcelSummaryStat,
} from './excel-export.util';

/** Default cap for list exports (rows beyond this are dropped and flagged via X-Export-Truncated). */
export const EXPORT_MAX_ROWS = 10_000;

export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type TabularExportFormat = (typeof EXPORT_FORMATS)[number];

export function parseExportFormat(value: unknown): TabularExportFormat {
  return String(value ?? 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
}

export type TabularExportInput = {
  format: TabularExportFormat;
  /** File name without extension and date stamp, e.g. `inventory-stock`. */
  baseName: string;
  sheetName: string;
  title: string;
  columns: ExcelExportColumn[];
  rows: Array<Record<string, unknown>>;
  summary?: ExcelSummaryStat[];
  truncated?: boolean;
};

export type TabularExportResult = {
  filename: string;
  contentType: string;
  body: Buffer | string;
  rowCount: number;
  truncated: boolean;
};

function csvCell(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  // Same formula-injection guard as the Excel export.
  return sanitizeExcelText(value);
}

/** Builds a branded Excel workbook or a UTF-8 (BOM) CSV from the same columns/rows. */
export async function buildTabularExport(input: TabularExportInput): Promise<TabularExportResult> {
  const stamp = new Date().toISOString().slice(0, 10);
  const truncated = Boolean(input.truncated);
  if (input.format === 'csv') {
    const body = rowsToCsv(
      input.columns.map((c) => c.header),
      input.rows.map((row) => input.columns.map((c) => csvCell(row[c.key]))),
    );
    return {
      filename: `${input.baseName}-${stamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body,
      rowCount: input.rows.length,
      truncated,
    };
  }
  const summary = [...(input.summary ?? [])];
  if (truncated) {
    summary.push({
      label: 'Note',
      value: `Export limited to the first ${input.rows.length} rows — narrow the filters for the rest.`,
    });
  }
  const body = await buildExcelBuffer({
    sheetName: input.sheetName,
    title: input.title,
    columns: input.columns,
    rows: input.rows,
    summary,
  });
  return {
    filename: `${input.baseName}-${stamp}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body,
    rowCount: input.rows.length,
    truncated,
  };
}

export function sendTabularExport(res: Response, result: TabularExportResult) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('X-Export-Row-Count', String(result.rowCount));
  res.setHeader('X-Export-Truncated', result.truncated ? 'true' : 'false');
  return res.send(result.body);
}
