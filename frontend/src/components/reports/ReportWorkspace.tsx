import { useEffect, useMemo, useState } from 'react';

import { Alert, Button, cn } from '@ds';

import { ReportsApi } from '../../api/reports';
import { FILTER_PRIMARY_BUTTON_CLASS, PANEL_CARD_CLASS } from '../FilterPanel';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import { useFilters } from '../../hooks/useFilters';
import { useReportServerData } from '../../hooks/useReportServerData';
import { defaultReportDateRange } from '../../lib/reports/format';
import { getReportById } from '../../lib/reports/registry';
import type { ReportCatalogId } from '../../lib/reports/report-catalog';
import {
  EMPTY_REPORT_FILTERS,
  type ReportChartKind,
  type ReportFilterValues,
  type ReportViewMode,
} from '../../lib/reports/types';
import { ReportChartPanel } from './ReportChartPanel';
import { ReportFiltersPanel } from './ReportFiltersPanel';
import { ReportKpiGrid } from './ReportKpiGrid';
import { ReportPivotPanel } from './ReportPivotPanel';
import { ReportPreviewTable } from './ReportPreviewTable';

function t(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Date from': 'من تاريخ',
    'Date to': 'إلى تاريخ',
    Generate: 'إنشاء',
    'Export CSV': 'تصدير CSV',
    'Export Excel': 'تصدير Excel',
    List: 'قائمة',
    Graph: 'رسم',
    Pivot: 'محوري',
    'Group by': 'تجميع حسب',
    Bar: 'أعمدة',
    Line: 'خط',
    Pie: 'دائري',
    Filters: 'فلاتر',
    'Report workspace': 'مساحة التقرير',
    'Generate a report to preview results.': 'أنشئ تقريراً لمعاينة النتائج.',
    'No rows match filters.': 'لا توجد صفوف مطابقة.',
    'Server-side reporting': 'تقارير من الخادم',
    'Paginated preview and export — no bulk client fetch.': 'معاينة مقسمة وتصدير من الخادم — بدون تحميل ضخم في المتصفح.',
    'No rows match the current filters.': 'لا توجد صفوف مطابقة للفلاتر الحالية.',
    'Select a warehouse or configure a default warehouse.': 'اختر مستودعاً أو عيّن مستودعاً افتراضياً.',
    'Exporting…': 'جارٍ التصدير…',
  };
  return ar[label] ?? label;
}

function initialFiltersForReport(reportId: string): ReportFilterValues {
  const { dateFrom, dateTo } = defaultReportDateRange();
  const base = { ...EMPTY_REPORT_FILTERS, dateFrom, dateTo };
  const def = getReportById(reportId);
  if (!def?.filterKeys.includes('dateRange')) {
    return { ...base, dateFrom: '', dateTo: '' };
  }
  const groupBy = def.groupByOptions?.[0]?.value ?? '';
  return { ...base, groupBy };
}

type Props = {
  reportId: ReportCatalogId;
  isArabic?: boolean;
};

export function ReportWorkspace({ reportId, isArabic = false }: Props) {
  const toast = useToast();
  const tr = (label: string) => t(label, isArabic);
  const { warehouseId, warehouses, isLoading: warehouseLoading } = useDefaultWarehouseId();
  const report = useMemo(() => getReportById(reportId)!, [reportId]);

  const reportFiltersInitial = useMemo(() => initialFiltersForReport(reportId), [reportId]);
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters, applyPatch } =
    useFilters<ReportFilterValues>(reportFiltersInitial);

  const [hasGenerated, setHasGenerated] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ReportViewMode>(report.defaultView);
  const [chartKind, setChartKind] = useState<ReportChartKind>(report.defaultChartKind ?? 'bar');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState<'csv' | 'xls' | null>(null);

  useEffect(() => {
    applyPatch(initialFiltersForReport(reportId));
    setHasGenerated(false);
    setGenerationError(null);
    setViewMode(report.defaultView);
    setChartKind(report.defaultChartKind ?? 'bar');
    setPage(1);
  }, [reportId, applyPatch, report.defaultView, report.defaultChartKind]);

  useEffect(() => {
    if (warehouseId && !draftFilters.warehouseId) {
      setDraft({ warehouseId });
    }
  }, [warehouseId, draftFilters.warehouseId, setDraft]);

  const effectiveWarehouseId = appliedFilters.warehouseId.trim() || warehouseId;

  const serverData = useReportServerData({
    reportId,
    filters: appliedFilters,
    warehouseId: effectiveWarehouseId,
    enabled: hasGenerated && !!effectiveWarehouseId,
    viewMode,
    page,
    pageSize,
    loadsKpis: report.loadsWarehouseKpis,
  });

  useEffect(() => {
    if (serverData.error) {
      setGenerationError(serverData.error);
    }
  }, [serverData.error]);

  const handleGenerate = () => {
    const wid = draftFilters.warehouseId.trim() || warehouseId;
    if (!wid) {
      const msg = tr('Select a warehouse or configure a default warehouse.');
      setGenerationError(msg);
      toast.error(msg);
      return;
    }
    setGenerationError(null);
    setDraft({ warehouseId: wid });
    applyFilters();
    setPage(1);
    setHasGenerated(true);
    toast.success(isArabic ? 'جارٍ تحميل التقرير من الخادم…' : 'Loading report from server…');
  };

  const exportParams = useMemo(
    () => ({
      warehouseId: effectiveWarehouseId,
      companyId: appliedFilters.companyId.trim() || undefined,
      status: appliedFilters.status.trim() || undefined,
      sku: appliedFilters.sku.trim() || undefined,
      dateFrom: appliedFilters.dateFrom.trim() || undefined,
      dateTo: appliedFilters.dateTo.trim() || undefined,
    }),
    [appliedFilters, effectiveWarehouseId],
  );

  const handleExport = async (format: 'csv' | 'xls') => {
    if (!hasGenerated || !effectiveWarehouseId) return;
    setExporting(format);
    try {
      await ReportsApi.exportDownload(reportId, { ...exportParams, format });
      toast.success(
        isArabic
          ? `تم التصدير (${format.toUpperCase()})`
          : `Export complete (${format.toUpperCase()})`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const showDateRange = report.filterKeys.includes('dateRange');
  const showGroupBy = report.filterKeys.includes('groupBy') && report.groupByOptions?.length;

  const chartRows = useMemo(() => {
    if (!appliedFilters.groupBy.trim()) return serverData.rows;
    const labelKey = report.chartLabelKey ?? 'group';
    const valueKey = report.chartValueKey ?? 'total';
    return serverData.rows.map((row) => ({
      ...row,
      [labelKey]: row.group ?? row[labelKey],
      [valueKey]: row.total ?? row[valueKey],
    }));
  }, [serverData.rows, appliedFilters.groupBy, report.chartLabelKey, report.chartValueKey]);

  const toolbarBtn = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
      active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    );

  return (
    <div className="space-y-6">
      {report.loadsWarehouseKpis && (
        <ReportKpiGrid
          kpis={serverData.kpis.map((k) => ({
            ...k,
            labelAr: k.label,
            hintAr: k.hint,
          }))}
          isArabic={isArabic}
          loading={serverData.kpisLoading && !hasGenerated}
        />
      )}

      <section className={PANEL_CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isArabic ? report.titleAr : report.title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {isArabic ? report.descriptionAr : report.description}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toolbarBtn(filtersOpen)}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {tr('Filters')}
          </button>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          {report.supportedViews.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={toolbarBtn(viewMode === mode)}
            >
              {mode === 'table' ? tr('List') : mode === 'graph' ? tr('Graph') : tr('Pivot')}
            </button>
          ))}
          {viewMode === 'graph' && (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
              {(['bar', 'line', 'pie'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setChartKind(kind)}
                  className={toolbarBtn(chartKind === kind)}
                >
                  {kind === 'bar' ? tr('Bar') : kind === 'line' ? tr('Line') : tr('Pie')}
                </button>
              ))}
            </>
          )}
          {showGroupBy && (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold uppercase tracking-wide">{tr('Group by')}</span>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  value={draftFilters.groupBy}
                  onChange={(e) => setDraft({ groupBy: e.target.value })}
                >
                  <option value="">{isArabic ? 'بدون' : 'None'}</option>
                  {report.groupByOptions!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {isArabic ? o.labelAr : o.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <span className="flex-1" />
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={!hasGenerated || !!exporting}
            loading={exporting === 'csv'}
            onClick={() => void handleExport('csv')}
          >
            {tr('Export CSV')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={!hasGenerated || !!exporting}
            loading={exporting === 'xls'}
            onClick={() => void handleExport('xls')}
          >
            {tr('Export Excel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className={FILTER_PRIMARY_BUTTON_CLASS}
            disabled={warehouseLoading || serverData.isLoading}
            loading={serverData.isLoading || warehouseLoading}
            onClick={handleGenerate}
          >
            {tr('Generate')}
          </Button>
        </div>

        {filtersOpen && showDateRange && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label={tr('Date from')}
              type="date"
              value={draftFilters.dateFrom}
              onChange={(e) => setDraft({ dateFrom: e.target.value })}
            />
            <TextField
              label={tr('Date to')}
              type="date"
              value={draftFilters.dateTo}
              onChange={(e) => setDraft({ dateTo: e.target.value })}
            />
          </div>
        )}

        <div className="mt-4">
          <Alert
            variant="info"
            compact
            title={tr('Server-side reporting')}
            description={tr('Paginated preview and export — no bulk client fetch.')}
          />
        </div>
      </section>

      {filtersOpen && (
        <ReportFiltersPanel
          report={report}
          draft={draftFilters}
          onChange={(patch) => setDraft(patch)}
          onApply={handleGenerate}
          onReset={() => {
            resetFilters();
            setHasGenerated(false);
            setGenerationError(null);
            setPage(1);
          }}
          loading={serverData.isLoading}
          isArabic={isArabic}
          warehouses={warehouses}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
          {tr('Report workspace')}
        </h2>

        {generationError && (
          <Alert variant="error" compact className="mb-4" description={generationError} />
        )}

        {serverData.cached && hasGenerated && (
          <Alert
            variant="info"
            compact
            className="mb-4"
            description={isArabic ? 'نتيجة من ذاكرة التخزين المؤقت للخادم.' : 'Served from server cache.'}
          />
        )}

        {viewMode === 'table' && (
          <ReportPreviewTable
            reportId={reportId}
            columns={report.columns}
            rows={serverData.rows}
            loading={serverData.isLoading}
            empty={
              hasGenerated
                ? tr('No rows match the current filters.')
                : tr('Generate a report to preview results.')
            }
            isArabic={isArabic}
            serverPagination={
              hasGenerated
                ? {
                    total: serverData.total,
                    page,
                    pageSize,
                    onPageChange: setPage,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(1);
                    },
                    pageSizeOptions: [25, 50, 100, 200],
                  }
                : undefined
            }
          />
        )}

        {viewMode === 'graph' && report.supportedViews.includes('graph') && (
          hasGenerated ? (
            chartRows.length > 0 ? (
              <ReportChartPanel
                report={report}
                rows={chartRows}
                isArabic={isArabic}
                chartKind={chartKind}
              />
            ) : (
              <Alert variant="info" compact description={tr('No rows match the current filters.')} />
            )
          ) : (
            <Alert variant="info" compact description={tr('Generate a report to preview results.')} />
          )
        )}

        {viewMode === 'pivot' && report.supportedViews.includes('pivot') && (
          hasGenerated ? (
            chartRows.length > 0 ? (
              <ReportPivotPanel
                report={report}
                rows={chartRows}
                filters={appliedFilters}
                columns={report.columns}
                isArabic={isArabic}
              />
            ) : (
              <Alert variant="info" compact description={tr('No rows match the current filters.')} />
            )
          ) : (
            <Alert variant="info" compact description={tr('Generate a report to preview results.')} />
          )
        )}
      </section>
    </div>
  );
}
