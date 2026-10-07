import { useMemo } from 'react'
import { BarSeriesChart, DonutChart, LineSeriesChart, CHART_COLORS } from '@emdad/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { buildReportChartData, buildTimelineChartData } from '@/lib/reports/chart-data'
import type { ReportChartKind, ReportDefinition, ReportRow } from '@/lib/reports/types'

type Props = {
  report: ReportDefinition
  rows: ReportRow[]
  isArabic: boolean
  chartKind?: ReportChartKind
}

export function ReportChartPanel({ report, rows, isArabic, chartKind = 'bar' }: Props) {
  const labelKey = report.chartLabelKey ?? report.columns[0]?.id ?? 'id'
  const valueKey = report.chartValueKey ?? 'quantity'

  const chart = useMemo(() => {
    if (labelKey === 'date' || labelKey === 'created') {
      return buildTimelineChartData(rows, labelKey, valueKey, report.title)
    }
    return buildReportChartData(rows, labelKey, valueKey, report.title)
  }, [rows, labelKey, valueKey, report.title])

  const seriesKey = 'value'
  const chartRows = useMemo(
    () =>
      chart.bars.map((b, i) => ({
        label: b.label.length > 18 ? `${b.label.slice(0, 16)}…` : b.label,
        fullLabel: b.label,
        [seriesKey]: b.value,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [chart.bars],
  )

  const distributionTitle = isArabic ? 'توزيع تشغيلي' : 'Operational distribution'
  const trendTitle = isArabic ? 'اتجاه النشاط' : 'Activity trend'
  const noData = isArabic ? 'لا توجد بيانات' : 'No data'
  const insufficient = isArabic ? 'بيانات غير كافية للرسم' : 'Insufficient points for trend'

  if (chartKind === 'pie') {
    const donutData = chart.bars.map((b, i) => ({
      key: `s${i}`,
      label: b.label,
      value: b.value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    const total = donutData.reduce((a, d) => a + d.value, 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{distributionTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <DonutChart
            data={donutData}
            size={200}
            centerValue={total > 0 ? total.toLocaleString() : '—'}
            centerLabel={isArabic ? 'الإجمالي' : 'Total'}
          />
        </CardContent>
      </Card>
    )
  }

  if (chartKind === 'line') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{trendTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {chart.lines.length < 2 ? (
            <p className="text-sm text-muted-foreground">{insufficient}</p>
          ) : (
            <LineSeriesChart
              data={chartRows}
              xKey="label"
              series={[{ key: seriesKey, label: report.title }]}
              height={280}
              legend={false}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{distributionTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {chart.bars.length === 0 ? (
            <p className="text-sm text-muted-foreground">{noData}</p>
          ) : (
            <BarSeriesChart
              data={chartRows}
              xKey="label"
              series={[{ key: seriesKey, label: report.title }]}
              height={280}
              legend={false}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{trendTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {chart.lines.length < 2 ? (
            <p className="text-sm text-muted-foreground">{insufficient}</p>
          ) : (
            <LineSeriesChart
              data={chartRows}
              xKey="label"
              series={[{ key: seriesKey, label: report.title }]}
              height={280}
              legend={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
