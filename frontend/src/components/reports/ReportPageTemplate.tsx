import type { ReactNode } from 'react';

import { Alert, Button, cn } from '@ds';

import { FILTER_PRIMARY_BUTTON_CLASS, PANEL_CARD_CLASS } from '../FilterPanel';

type ToolbarLabels = {
  filters: string;
  list: string;
  graph: string;
  pivot: string;
  groupBy: string;
  bar: string;
  line: string;
  pie: string;
  exportCsv: string;
  exportExcel: string;
  generate: string;
  serverSideTitle: string;
  serverSideDescription: string;
};

type Props = {
  title: string;
  description: string;
  labels: ToolbarLabels;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  supportedViews: Array<'table' | 'graph' | 'pivot'>;
  viewMode: 'table' | 'graph' | 'pivot';
  onViewModeChange: (mode: 'table' | 'graph' | 'pivot') => void;
  chartKind?: 'bar' | 'line' | 'pie';
  onChartKindChange?: (kind: 'bar' | 'line' | 'pie') => void;
  showChartKind?: boolean;
  groupByControl?: ReactNode;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onGenerate: () => void;
  exportDisabled?: boolean;
  generateLoading?: boolean;
  exportingCsv?: boolean;
  exportingExcel?: boolean;
  dateRangeFields?: ReactNode;
  filtersPanel?: ReactNode;
  kpiSection?: ReactNode;
  workspaceTitle: string;
  generationError?: string | null;
  cached?: boolean;
  cachedLabel?: string;
  children: ReactNode;
};

function toolbarBtn(active: boolean) {
  return cn(
    'rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
    active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  );
}

export function ReportPageTemplate({
  title,
  description,
  labels,
  filtersOpen,
  onToggleFilters,
  supportedViews,
  viewMode,
  onViewModeChange,
  chartKind,
  onChartKindChange,
  showChartKind,
  groupByControl,
  onExportCsv,
  onExportExcel,
  onGenerate,
  exportDisabled,
  generateLoading,
  exportingCsv,
  exportingExcel,
  dateRangeFields,
  filtersPanel,
  kpiSection,
  workspaceTitle,
  generationError,
  cached,
  cachedLabel,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      {kpiSection}

      <section className={PANEL_CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={toolbarBtn(filtersOpen)} onClick={onToggleFilters}>
            {labels.filters}
          </button>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          {supportedViews.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={toolbarBtn(viewMode === mode)}
            >
              {mode === 'table' ? labels.list : mode === 'graph' ? labels.graph : labels.pivot}
            </button>
          ))}
          {showChartKind && viewMode === 'graph' && onChartKindChange ? (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
              {(['bar', 'line', 'pie'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onChartKindChange(kind)}
                  className={toolbarBtn(chartKind === kind)}
                >
                  {kind === 'bar' ? labels.bar : kind === 'line' ? labels.line : labels.pie}
                </button>
              ))}
            </>
          ) : null}
          {groupByControl}
          <span className="flex-1" />
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={exportDisabled}
            loading={exportingCsv}
            onClick={onExportCsv}
          >
            {labels.exportCsv}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={exportDisabled}
            loading={exportingExcel}
            onClick={onExportExcel}
          >
            {labels.exportExcel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className={FILTER_PRIMARY_BUTTON_CLASS}
            disabled={generateLoading}
            loading={generateLoading}
            onClick={onGenerate}
          >
            {labels.generate}
          </Button>
        </div>

        {filtersOpen && dateRangeFields ? <div className="mt-4">{dateRangeFields}</div> : null}

        <div className="mt-4">
          <Alert
            variant="info"
            compact
            title={labels.serverSideTitle}
            description={labels.serverSideDescription}
          />
        </div>
      </section>

      {filtersOpen && filtersPanel}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
          {workspaceTitle}
        </h2>
        {generationError ? (
          <Alert variant="error" compact className="mb-4" description={generationError} />
        ) : null}
        {cached && cachedLabel ? (
          <Alert variant="info" compact className="mb-4" description={cachedLabel} />
        ) : null}
        {children}
      </section>
    </div>
  );
}
