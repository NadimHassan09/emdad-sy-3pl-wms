import { getReportById } from './registry';
import { loadWarehouseKpis } from './warehouse-analysis';
import type { ReportFilterValues, ReportGenerateResult, ReportRow, ReportRunContext } from './types';

export async function generateReport(
  reportId: string,
  filters: ReportFilterValues,
  ctx: ReportRunContext,
): Promise<ReportGenerateResult> {
  const def = getReportById(reportId);
  if (!def) return { rows: [], error: 'Unknown report type.' };
  if (!ctx.defaultWarehouseId) {
    return { rows: [], error: 'Warehouse not configured. Set a default warehouse first.' };
  }
  try {
    const rows = await def.run(filters, ctx);
    const result: ReportGenerateResult = { rows };
    if (def.loadsWarehouseKpis) {
      try {
        result.kpis = await loadWarehouseKpis(filters, ctx);
      } catch (kpiErr) {
        result.kpiError =
          kpiErr instanceof Error ? kpiErr.message : 'Failed to load KPI summary.';
      }
    }
    return result;
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : 'Report generation failed.',
    };
  }
}

export function sortReportRows(
  rows: ReportRow[],
  columnId: string,
  direction: 'asc' | 'desc',
  reportId: string,
): ReportRow[] {
  const def = getReportById(reportId);
  const col = def?.columns.find((c) => c.id === columnId);
  if (!col?.sortValue) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = col.sortValue!(a);
    const bv = col.sortValue!(b);
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
}
