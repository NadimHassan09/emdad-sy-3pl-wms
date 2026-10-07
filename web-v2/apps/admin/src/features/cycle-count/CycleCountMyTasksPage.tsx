import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { CycleCountApi, type BlindCycleCountTaskListItem } from '@/api/cycle-count'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { canExecuteCycleCount } from '@/lib/rbac'
import { CycleCountStatusBadge } from './cycle-count-ui'

export function CycleCountMyTasksPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const { user } = useAuth()
  const canExecute = canExecuteCycleCount(user)
  const { warehouseId: wid } = useDefaultWarehouseId()

  const tasks = useQuery({
    queryKey: QK.cycleCount.myTasks(wid ?? ''),
    queryFn: () => CycleCountApi.listMyTasks(wid || undefined),
    enabled: !!wid && canExecute,
  })

  const columns = useMemo<ColumnDef<BlindCycleCountTaskListItem>[]>(
    () => [
      { id: 'wh', header: t('Warehouse', 'المستودع'), cell: ({ row }) => row.original.warehouse.code },
      { id: 'st', header: t('Status', 'الحالة'), cell: ({ row }) => <CycleCountStatusBadge status={row.original.status} isArabic={isArabic} /> },
      {
        id: 'prog',
        header: t('Progress', 'التقدم'),
        cell: ({ row }) => {
          const done = row.original.progress.totalLines - row.original.progress.pending
          return (
            <span className="font-mono text-sm">
              {done}/{row.original.progress.totalLines}
            </span>
          )
        },
      },
      {
        id: 'pending',
        header: t('Pending', 'متبقي'),
        cell: ({ row }) => (
          <span className={`font-mono text-sm ${row.original.progress.pending > 0 ? 'font-semibold' : ''}`}>
            {row.original.progress.pending}
          </span>
        ),
      },
      { id: 'scope', header: t('Scope', 'النطاق'), cell: ({ row }) => <span className="text-sm capitalize">{row.original.assignmentScope}</span> },
    ],
    [isArabic, t],
  )

  if (!canExecute) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('My cycle counts', 'مهام الجرد')}
          description={t(
            'Blind count execution requires a linked worker profile.',
            'تنفيذ الجرد الأعمى يتطلب ملف عامل مرتبط.',
          )}
          actions={
            <Button type="button" variant="ghost" onClick={() => navigate('/cycle-count')}>
              {t('Dashboard', 'لوحة الجرد')}
            </Button>
          }
        />
        <Alert>
          <AlertTitle>{t('Worker profile required', 'يتطلب ملف عامل')}</AlertTitle>
          <AlertDescription>
            {t(
              'Ask a warehouse manager to link your user account to a worker record.',
              'اطلب من مدير المستودع ربط حسابك بسجل عامل.',
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('My cycle counts', 'مهام الجرد')}
        description={t('Assigned count sessions — tap to execute.', 'جلسات الجرد المكلفة — اضغط للتنفيذ.')}
        actions={
          <Button type="button" variant="ghost" onClick={() => navigate('/cycle-count')}>
            {t('Dashboard', 'لوحة الجرد')}
          </Button>
        }
      />
      <DataTable<BlindCycleCountTaskListItem>
        columns={columns}
        data={tasks.data ?? []}
        getRowId={(r) => r.id}
        loading={tasks.isLoading}
        onRowClick={(row) => navigate(`/cycle-count/${row.id}/execute`)}
        empty={t('No count tasks assigned.', 'لا مهام جرد مكلفة.')}
      />
    </div>
  )
}
