import { useEffect, useMemo, useState } from 'react'
import { useUiPreferences } from '@emdad/core'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { buildInitialReportFilters, useReportFramework } from '@/lib/reports/framework'
import type { ReportCatalogId } from '@/lib/reports/report-catalog'
import type { ReportChartKind } from '@/lib/reports/types'
import { reportTr } from './report-i18n'
import { ReportChartPanel } from './ReportChartPanel'
import { ReportFiltersPanel } from './ReportFiltersPanel'
import { ReportKpiGrid } from './ReportKpiGrid'
import { ReportPageTemplate } from './ReportPageTemplate'
import { ReportPivotPanel } from './ReportPivotPanel'
import { ReportPreviewTable } from './ReportPreviewTable'

type Props = {
  reportId: ReportCatalogId
}

export function ReportWorkspace({ reportId }: Props) {
  const { isArabic } = useUiPreferences()
  const tr = (label: string) => reportTr(label, isArabic)
  const { user } = useAuth()
  const { warehouseId, warehouses, isLoading: warehouseLoading } = useDefaultWarehouseId()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [chartKind, setChartKind] = useState<ReportChartKind>('bar')

  const fw = useReportFramework({
    reportId,
    defaultWarehouseId: warehouseId,
    userRole: user?.role,
    isArabic,
  })

  const { report, serverData } = fw

  useEffect(() => {
    fw.applyPatch(buildInitialReportFilters(reportId))
    fw.setViewMode(report.defaultView)
    setChartKind(report.defaultChartKind ?? 'bar')
    fw.setHasGenerated(false)
    fw.setGenerationError(null)
    fw.setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when report changes
  }, [reportId, report.defaultView, report.defaultChartKind])

  useEffect(() => {
    if (warehouseId && !fw.draftFilters.warehouseId) {
      fw.setDraft({ warehouseId })
    }
  }, [warehouseId, fw.draftFilters.warehouseId, fw.setDraft])

  useEffect(() => {
    if (serverData.error) {
      fw.setGenerationError(serverData.error)
    }
  }, [serverData.error, fw.setGenerationError])

  const showDateRange = report.filterKeys.includes('dateRange')
  const showGroupBy = report.filterKeys.includes('groupBy') && report.groupByOptions?.length

  const chartRows = useMemo(() => {
    if (!fw.appliedFilters.groupBy.trim()) return serverData.rows
    const labelKey = report.chartLabelKey ?? 'group'
    const valueKey = report.chartValueKey ?? 'total'
    return serverData.rows.map((row) => ({
      ...row,
      [labelKey]: row.group ?? row[labelKey],
      [valueKey]: row.total ?? row[valueKey],
    }))
  }, [serverData.rows, fw.appliedFilters.groupBy, report.chartLabelKey, report.chartValueKey])

  const handleGenerate = () => {
    const result = fw.generate()
    if (!result.ok) {
      toast.error(result.error ?? tr('Select a warehouse or configure a default warehouse.'))
      return
    }
    toast.success(tr('Loading report from server…'))
  }

  const handleExport = async (format: 'csv' | 'xls') => {
    const result = await fw.exportReport(format)
    if (result.ok) {
      toast.success(isArabic ? `تم التصدير (${format.toUpperCase()})` : `Export complete (${format.toUpperCase()})`)
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  if (!fw.permitted) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{tr('Not permitted')}</AlertTitle>
        <AlertDescription>{tr('Your role is not permitted to view this report.')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <ReportPageTemplate
      title={isArabic ? report.titleAr : report.title}
      description={isArabic ? report.descriptionAr : report.description}
      labels={{
        filters: tr('Filters'),
        list: tr('List'),
        graph: tr('Graph'),
        pivot: tr('Pivot'),
        groupBy: tr('Group by'),
        bar: tr('Bar'),
        line: tr('Line'),
        pie: tr('Pie'),
        exportCsv: tr('Export CSV'),
        exportExcel: tr('Export Excel'),
        generate: tr('Generate'),
        serverSideTitle: tr('Server-side reporting'),
        serverSideDescription: tr('Paginated preview and export — no bulk client fetch.'),
      }}
      filtersOpen={filtersOpen}
      onToggleFilters={() => setFiltersOpen((o) => !o)}
      supportedViews={report.supportedViews}
      viewMode={fw.viewMode}
      onViewModeChange={fw.setViewMode}
      chartKind={chartKind}
      onChartKindChange={setChartKind}
      showChartKind={fw.viewMode === 'graph'}
      groupByControl={
        showGroupBy ? (
          <>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{tr('Group by')}</span>
              <Select
                value={fw.draftFilters.groupBy || '__none'}
                onValueChange={(v) => fw.setDraft({ groupBy: v === '__none' ? '' : v })}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{tr('None')}</SelectItem>
                  {report.groupByOptions!.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {isArabic ? o.labelAr : o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : undefined
      }
      onExportCsv={() => void handleExport('csv')}
      onExportExcel={() => void handleExport('xls')}
      onGenerate={handleGenerate}
      exportDisabled={!fw.hasGenerated || !!fw.exporting}
      generateLoading={serverData.isLoading || warehouseLoading}
      exportingCsv={fw.exporting === 'csv'}
      exportingExcel={fw.exporting === 'xls'}
      dateRangeFields={
        showDateRange ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{tr('Date from')}</Label>
              <Input
                type="date"
                value={fw.draftFilters.dateFrom}
                onChange={(e) => fw.setDraft({ dateFrom: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('Date to')}</Label>
              <Input
                type="date"
                value={fw.draftFilters.dateTo}
                onChange={(e) => fw.setDraft({ dateTo: e.target.value })}
              />
            </div>
          </div>
        ) : undefined
      }
      filtersPanel={
        <ReportFiltersPanel
          report={report}
          draft={fw.draftFilters}
          onChange={(patch) => fw.setDraft(patch)}
          onApply={handleGenerate}
          onReset={() => {
            fw.reset()
            fw.applyPatch(buildInitialReportFilters(reportId))
          }}
          loading={serverData.isLoading}
          isArabic={isArabic}
          warehouses={warehouses}
        />
      }
      kpiSection={
        report.loadsWarehouseKpis ? (
          <ReportKpiGrid
            kpis={serverData.kpis.map((k) => ({
              ...k,
              labelAr: k.label,
              hintAr: k.hint,
            }))}
            isArabic={isArabic}
            loading={serverData.kpisLoading && !fw.hasGenerated}
          />
        ) : undefined
      }
      workspaceTitle={tr('Report workspace')}
      generationError={fw.generationError}
      cached={serverData.cached && fw.hasGenerated}
      cachedLabel={tr('Served from server cache.')}
    >
      {fw.viewMode === 'table' && (
        <ReportPreviewTable
          reportId={reportId}
          columns={report.columns}
          rows={serverData.rows}
          loading={serverData.isLoading}
          empty={
            fw.hasGenerated
              ? tr('No rows match the current filters.')
              : tr('Generate a report to preview results.')
          }
          isArabic={isArabic}
          serverPagination={
            fw.hasGenerated
              ? {
                  total: serverData.total,
                  page: fw.page,
                  pageSize: fw.pageSize,
                  onPageChange: fw.setPage,
                  onPageSizeChange: (size) => {
                    fw.setPageSize(size)
                    fw.setPage(1)
                  },
                  pageSizeOptions: [25, 50, 100, 200],
                }
              : undefined
          }
        />
      )}

      {fw.viewMode === 'graph' && report.supportedViews.includes('graph') &&
        (fw.hasGenerated ? (
          chartRows.length > 0 ? (
            <ReportChartPanel report={report} rows={chartRows} isArabic={isArabic} chartKind={chartKind} />
          ) : (
            <Alert>
              <AlertDescription>{tr('No rows match the current filters.')}</AlertDescription>
            </Alert>
          )
        ) : (
          <Alert>
            <AlertDescription>{tr('Generate a report to preview results.')}</AlertDescription>
          </Alert>
        ))}

      {fw.viewMode === 'pivot' && report.supportedViews.includes('pivot') &&
        (fw.hasGenerated ? (
          chartRows.length > 0 ? (
            <ReportPivotPanel
              report={report}
              rows={chartRows}
              filters={fw.appliedFilters}
              columns={report.columns}
              isArabic={isArabic}
            />
          ) : (
            <Alert>
              <AlertDescription>{tr('No rows match the current filters.')}</AlertDescription>
            </Alert>
          )
        ) : (
          <Alert>
            <AlertDescription>{tr('Generate a report to preview results.')}</AlertDescription>
          </Alert>
        ))}
    </ReportPageTemplate>
  )
}
