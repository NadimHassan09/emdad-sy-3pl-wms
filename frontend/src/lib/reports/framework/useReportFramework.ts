import { useCallback, useMemo, useState } from 'react';

import { useFilters } from '../../../hooks/useFilters';
import { useReportServerData } from '../../../hooks/useReportServerData';
import { getReportById } from '../registry';
import type { ReportFilterValues, ReportViewMode } from '../types';
import {
  buildInitialReportFilters,
  filtersToExportParams,
  validateReportGeneration,
} from './report-filters';
import { exportReportDownload, type ReportExportFormat } from './report-export';
import { canViewReport } from './report-permissions';

type Options = {
  reportId: string;
  defaultWarehouseId: string;
  userRole?: string;
  isArabic?: boolean;
};

export function useReportFramework({
  reportId,
  defaultWarehouseId,
  userRole,
}: Options) {
  const report = useMemo(() => getReportById(reportId)!, [reportId]);
  const initialFilters = useMemo(() => buildInitialReportFilters(reportId), [reportId]);
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters, applyPatch } =
    useFilters<ReportFilterValues>(initialFilters);

  const [hasGenerated, setHasGenerated] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ReportViewMode>(report.defaultView);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);

  const permitted = canViewReport(userRole, reportId);
  const effectiveWarehouseId = appliedFilters.warehouseId.trim() || defaultWarehouseId;

  const serverData = useReportServerData({
    reportId,
    filters: appliedFilters,
    warehouseId: effectiveWarehouseId,
    enabled: hasGenerated && !!effectiveWarehouseId && permitted,
    viewMode,
    page,
    pageSize,
    loadsKpis: report.loadsWarehouseKpis,
  });

  const exportParams = useMemo(
    () => filtersToExportParams(appliedFilters, effectiveWarehouseId),
    [appliedFilters, effectiveWarehouseId],
  );

  const generate = useCallback(() => {
    const wid = draftFilters.warehouseId.trim() || defaultWarehouseId;
    const err = validateReportGeneration(wid);
    if (err) {
      setGenerationError(err);
      return { ok: false as const, error: err };
    }
    setGenerationError(null);
    setDraft({ warehouseId: wid });
    applyFilters();
    setPage(1);
    setHasGenerated(true);
    return { ok: true as const };
  }, [applyFilters, defaultWarehouseId, draftFilters.warehouseId, setDraft]);

  const reset = useCallback(() => {
    resetFilters();
    setHasGenerated(false);
    setGenerationError(null);
    setPage(1);
  }, [resetFilters]);

  const exportReport = useCallback(
    async (format: ReportExportFormat) => {
      if (!hasGenerated || !effectiveWarehouseId) return { ok: false as const };
      setExporting(format);
      try {
        await exportReportDownload(reportId, exportParams, format);
        return { ok: true as const };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Export failed';
        return { ok: false as const, error: message };
      } finally {
        setExporting(null);
      }
    },
    [effectiveWarehouseId, exportParams, hasGenerated, reportId],
  );

  return {
    report,
    permitted,
    draftFilters,
    appliedFilters,
    setDraft,
    applyPatch,
    hasGenerated,
    setHasGenerated,
    generationError,
    setGenerationError,
    viewMode,
    setViewMode,
    page,
    setPage,
    pageSize,
    setPageSize,
    exporting,
    effectiveWarehouseId,
    serverData,
    exportParams,
    generate,
    reset,
    exportReport,
  };
}
