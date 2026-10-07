import type { ReactNode } from 'react'
import { cn } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Loader2 } from 'lucide-react'

type ToolbarLabels = {
  filters: string
  list: string
  graph: string
  pivot: string
  groupBy: string
  bar: string
  line: string
  pie: string
  exportCsv: string
  exportExcel: string
  generate: string
  serverSideTitle: string
  serverSideDescription: string
}

type Props = {
  title: string
  description: string
  labels: ToolbarLabels
  filtersOpen: boolean
  onToggleFilters: () => void
  supportedViews: Array<'table' | 'graph' | 'pivot'>
  viewMode: 'table' | 'graph' | 'pivot'
  onViewModeChange: (mode: 'table' | 'graph' | 'pivot') => void
  chartKind?: 'bar' | 'line' | 'pie'
  onChartKindChange?: (kind: 'bar' | 'line' | 'pie') => void
  showChartKind?: boolean
  groupByControl?: ReactNode
  onExportCsv: () => void
  onExportExcel: () => void
  onGenerate: () => void
  exportDisabled?: boolean
  generateLoading?: boolean
  exportingCsv?: boolean
  exportingExcel?: boolean
  dateRangeFields?: ReactNode
  filtersPanel?: ReactNode
  kpiSection?: ReactNode
  workspaceTitle: string
  generationError?: string | null
  cached?: boolean
  cachedLabel?: string
  children: ReactNode
}

function toolbarBtn(active: boolean) {
  return cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
  )
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

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="max-w-3xl">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toolbarBtn(filtersOpen)} onClick={onToggleFilters}>
              {labels.filters}
            </button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
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
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
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
            <Button type="button" variant="outline" size="sm" disabled={exportDisabled} onClick={onExportCsv}>
              {exportingCsv ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {labels.exportCsv}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={exportDisabled} onClick={onExportExcel}>
              {exportingExcel ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {labels.exportExcel}
            </Button>
            <Button type="button" size="sm" disabled={generateLoading} onClick={onGenerate}>
              {generateLoading ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {labels.generate}
            </Button>
          </div>

          {filtersOpen && dateRangeFields ? <div>{dateRangeFields}</div> : null}

          <Alert>
            <AlertTitle>{labels.serverSideTitle}</AlertTitle>
            <AlertDescription>{labels.serverSideDescription}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {filtersOpen && filtersPanel}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{workspaceTitle}</h2>
        {generationError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{generationError}</AlertDescription>
          </Alert>
        ) : null}
        {cached && cachedLabel ? (
          <Alert className="mb-4">
            <AlertDescription>{cachedLabel}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </section>
    </div>
  )
}
