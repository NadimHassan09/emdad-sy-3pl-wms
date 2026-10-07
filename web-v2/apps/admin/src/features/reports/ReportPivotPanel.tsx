import { useMemo, useState } from 'react'
import { cn } from '@emdad/ui'
import {
  defaultPivotGroupKey,
  groupReportRows,
  numericColumnIds,
} from '@/lib/reports/pivot-helpers'
import type { ReportColumnDef, ReportDefinition, ReportFilterValues, ReportRow } from '@/lib/reports/types'

type Props = {
  report: ReportDefinition
  rows: ReportRow[]
  filters: ReportFilterValues
  columns: ReportColumnDef[]
  isArabic: boolean
}

export function ReportPivotPanel({ report, rows, filters, columns, isArabic }: Props) {
  const defaultKey =
    filters.groupBy || report.groupByOptions?.[0]?.value || defaultPivotGroupKey(columns)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const measureKeys = numericColumnIds(columns)
  const groups = useMemo(
    () => groupReportRows(rows, defaultKey, measureKeys),
    [rows, defaultKey, measureKeys],
  )

  const groupLabel =
    report.groupByOptions?.find((o) => o.value === defaultKey)?.label ??
    columns.find((c) => c.id === defaultKey)?.header ??
    defaultKey

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/30 px-4 py-3 text-sm">
        {isArabic ? `تجميع حسب: ${groupLabel}` : `Grouped by: ${groupLabel}`}
        <span className="ms-2 text-muted-foreground">· {groups.length} groups</span>
      </div>
      <div className="max-h-128 overflow-auto">
        {groups.map((g) => {
          const open = expanded.has(g.key)
          return (
            <div key={g.key} className="border-b last:border-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-muted/40"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(g.key)) next.delete(g.key)
                    else next.add(g.key)
                    return next
                  })
                }
              >
                <span className="text-sm font-semibold">{g.label}</span>
                <span className="text-sm text-muted-foreground">
                  {g.rows.length} {isArabic ? 'صف' : 'rows'}
                  {measureKeys[0] != null && <> · Σ {Math.round(g.subtotal[measureKeys[0]!] ?? 0)}</>}
                </span>
              </button>
              {open && (
                <div className="overflow-x-auto bg-muted/20 px-2 pb-2">
                  <table className="w-full min-w-160 text-sm">
                    <thead>
                      <tr className="text-muted-foreground">
                        {columns.slice(0, 6).map((c) => (
                          <th key={c.id} className="sticky top-0 bg-muted/40 px-2 py-2 text-start font-medium">
                            {isArabic ? c.headerAr : c.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.slice(0, 50).map((row, i) => (
                        <tr key={String(row.id ?? i)} className={cn('border-t hover:bg-background/80')}>
                          {columns.slice(0, 6).map((c) => (
                            <td key={c.id} className="px-2 py-2">
                              {c.cell(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
