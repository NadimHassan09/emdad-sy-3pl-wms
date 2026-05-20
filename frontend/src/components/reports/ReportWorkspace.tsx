import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Alert, Button, cn } from '@ds';

import { FILTER_PRIMARY_BUTTON_CLASS, PANEL_CARD_CLASS } from '../FilterPanel';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import { useFilters } from '../../hooks/useFilters';
import { exportReportCsv } from '../../lib/reports/csv-export';
import { exportReportExcel } from '../../lib/reports/excel-export';
import { defaultReportDateRange } from '../../lib/reports/format';
import { generateReport } from '../../lib/reports/report-engine';
import { getReportById } from '../../lib/reports/registry';
import type { ReportCatalogId } from '../../lib/reports/report-catalog';
import {
  EMPTY_REPORT_FILTERS,
  type ReportChartKind,
  type ReportFilterValues,
  type ReportRow,
  type ReportViewMode,
  type WarehouseKpi,
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
    'Client aggregation': 'تجميع من الواجهة',
    'Rows capped at 2,000 per query.': 'الصفوف محدودة بـ 2000 لكل استعلام.',
    'No rows match the current filters.': 'لا توجد صفوف مطابقة للفلاتر الحالية.',
    'Select a warehouse or configure a default warehouse.': 'اختر مستودعاً أو عيّن مستودعاً افتراضياً.',
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
  const { draftFilters, setDraft, applyFilters, resetFilters, applyPatch } =
    useFilters<ReportFilterValues>(reportFiltersInitial);

  const [previewRows, setPreviewRows] = useState<ReportRow[]>([]);
  const [kpis, setKpis] = useState<WarehouseKpi[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ReportViewMode>(report.defaultView);
  const [chartKind, setChartKind] = useState<ReportChartKind>(report.defaultChartKind ?? 'bar');
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    applyPatch(initialFiltersForReport(reportId));
    setPreviewRows([]);
    setKpis([]);
    setHasGenerated(false);
    setGenerationError(null);
    setViewMode(report.defaultView);
    setChartKind(report.defaultChartKind ?? 'bar');
  }, [reportId, applyPatch, report.defaultView, report.defaultChartKind]);

  useEffect(() => {
    if (warehouseId && !draftFilters.warehouseId) {
      setDraft({ warehouseId });
    }
  }, [warehouseId, draftFilters.warehouseId, setDraft]);

  const effectiveWarehouseId = draftFilters.warehouseId.trim() || warehouseId;

  const generateMut = useMutation({
    mutationFn: async (filters: ReportFilterValues) =>
      generateReport(
        reportId,
        { ...filters, warehouseId: filters.warehouseId.trim() || warehouseId },
        { defaultWarehouseId: warehouseId },
      ),
    onSuccess: (result) => {
      if (result.error) {
        const msg = result.error;
        setGenerationError(msg);
        toast.error(msg);
        setPreviewRows([]);
        setKpis([]);
        setHasGenerated(false);
        return;
      }
      setGenerationError(result.kpiError ?? null);
      setPreviewRows(result.rows);
      setKpis(result.kpis ?? []);
      setHasGenerated(true);
      if (result.kpiError) {
        toast.error(result.kpiError);
      } else {
        const n = result.rows.length;
        toast.success(
          isArabic
            ? `تم إنشاء التقرير — ${n} صف`
            : `Report generated — ${n} row${n === 1 ? '' : 's'}`,
        );
      }
    },
    onError: (e: Error) => {
      setGenerationError(e.message);
      toast.error(e.message);
      setHasGenerated(false);
    },
  });

  const handleGenerate = () => {
    if (!effectiveWarehouseId) {
      const msg = isArabic
        ? 'اختر مستودعاً أو عيّن مستودعاً افتراضياً.'
        : 'Select a warehouse or configure a default warehouse.';
      setGenerationError(msg);
      toast.error(msg);
      return;
    }
    setGenerationError(null);
    const filters = { ...draftFilters, warehouseId: effectiveWarehouseId };
    applyFilters();
    generateMut.mutate(filters);
  };

  const handleExportCsv = () => {
    if (!hasGenerated || previewRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    exportReportCsv(report.columns, previewRows, `${report.exportFileName}-${stamp}`, isArabic);
  };

  const handleExportExcel = () => {
    if (!hasGenerated || previewRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    exportReportExcel(report.columns, previewRows, `${report.exportFileName}-${stamp}`, isArabic);
  };

  const showDateRange = report.filterKeys.includes('dateRange');
  const showGroupBy = report.filterKeys.includes('groupBy') && report.groupByOptions?.length;

  const toolbarBtn = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
      active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    );

  return (
    <div className="space-y-6">
      {report.loadsWarehouseKpis && (
        <ReportKpiGrid kpis={kpis} isArabic={isArabic} loading={generateMut.isPending && !hasGenerated} />
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
            disabled={!hasGenerated || previewRows.length === 0}
            onClick={handleExportCsv}
          >
            {tr('Export CSV')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={!hasGenerated || previewRows.length === 0}
            onClick={handleExportExcel}
          >
            {tr('Export Excel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className={FILTER_PRIMARY_BUTTON_CLASS}
            disabled={warehouseLoading || generateMut.isPending}
            loading={generateMut.isPending || warehouseLoading}
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

        {(report.usesClientAggregation || report.missingBackendNotes?.length) && (
          <div className="mt-4 space-y-2">
            {report.usesClientAggregation && (
              <Alert
                variant="info"
                compact
                title={tr('Client aggregation')}
                description={tr('Rows capped at 2,000 per query.')}
              />
            )}
            {report.missingBackendNotes?.map((note) => (
              <Alert key={note} variant="warning" compact title="API gap" description={note} />
            ))}
          </div>
        )}
      </section>

      {filtersOpen && (
        <ReportFiltersPanel
          report={report}
          draft={draftFilters}
          onChange={(patch) => setDraft(patch)}
          onApply={handleGenerate}
          onReset={() => {
            resetFilters();
            setPreviewRows([]);
            setKpis([]);
            setHasGenerated(false);
            setGenerationError(null);
          }}
          loading={generateMut.isPending}
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

        {viewMode === 'table' && (
          <ReportPreviewTable
            reportId={reportId}
            columns={report.columns}
            rows={previewRows}
            loading={generateMut.isPending}
            empty={
              hasGenerated
                ? tr('No rows match the current filters.')
                : tr('Generate a report to preview results.')
            }
            isArabic={isArabic}
          />
        )}

        {viewMode === 'graph' && report.supportedViews.includes('graph') && (
          hasGenerated ? (
            previewRows.length > 0 ? (
              <ReportChartPanel
                report={report}
                rows={previewRows}
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
            previewRows.length > 0 ? (
              <ReportPivotPanel
                report={report}
                rows={previewRows}
                filters={draftFilters}
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
