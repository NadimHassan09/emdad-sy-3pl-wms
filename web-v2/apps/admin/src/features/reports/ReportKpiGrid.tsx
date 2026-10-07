import { Card, CardContent } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import type { WarehouseKpi } from '@/lib/reports/types'

type Props = {
  kpis: WarehouseKpi[]
  isArabic?: boolean
  loading?: boolean
}

export function ReportKpiGrid({ kpis, isArabic = false, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="px-4 py-0 pt-4 pb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!kpis.length) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.id}>
          <CardContent className="px-4 py-0 pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{isArabic ? kpi.labelAr : kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
            {(kpi.hint || kpi.hintAr) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {isArabic ? (kpi.hintAr ?? kpi.hint) : (kpi.hint ?? kpi.hintAr)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
