import { useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { getReportIdFromPath } from '@/lib/reports/report-paths'
import { reportTr } from './report-i18n'
import { ReportsNav } from './ReportsNav'
import { ReportWorkspace } from './ReportWorkspace'

export function ReportPage() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const tr = (label: string) => reportTr(label, isArabic)
  const { warehouseId } = useDefaultWarehouseId()
  const reportId = getReportIdFromPath(pathname)

  if (!reportId) {
    return (
      <div className="space-y-4">
        <PageHeader title={tr('Reporting Center')} />
        <Alert variant="destructive">
          <AlertTitle>{tr('Report not found')}</AlertTitle>
          <AlertDescription>{tr('Unknown report path.')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr('Reporting Center')}
        description={
          isArabic
            ? 'معاينة وتصدير التقارير من الخادم مع فلاتر المستودع والعميل.'
            : 'Server-side report preview and export with warehouse and client filters.'
        }
      />

      {!warehouseId && (
        <Alert>
          <AlertTitle>{tr('Warehouse not configured')}</AlertTitle>
          <AlertDescription>
            Set VITE_DEFAULT_WAREHOUSE_ID or ensure an active warehouse exists.
          </AlertDescription>
        </Alert>
      )}

      <ReportsNav />

      <ReportWorkspace key={reportId} reportId={reportId} />
    </div>
  )
}
