import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Navigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { DataTable, StatusBadge } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { toast } from 'sonner'
import { BackupsApi, type BackupSchedule, type CreateBackupScheduleInput } from '@/api/backups'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useBackupAdminAccess } from '@/hooks/useBackupAdminAccess'
import { formatBackupTimestamp } from '@/lib/backup-display'
import {
  formatScheduleFrequency,
  formatScheduleTime,
  getNextBackupScheduleRun,
} from '@/lib/backup-schedule-display'
import { localizedScheduleStoragePolicyLabel } from '@/lib/settings-backup-labels'
import { defaultHomePath } from '@/lib/rbac'
import { BackupsLayout } from './BackupsLayout'
import { useBackupOperationContext } from './BackupOperationContext'
import { BackupScheduleModal } from './components/BackupScheduleModal'

export function BackupSchedulesPage() {
  const { user } = useAuth()
  const { canRead, canMutate } = useBackupAdminAccess()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const { createScheduleRequestId } = useBackupOperationContext()
  const lastCreateScheduleRequestRef = useRef(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BackupSchedule | null>(null)

  const schedulesQuery = useQuery({
    queryKey: QK.backups.schedules,
    queryFn: () => BackupsApi.listSchedules(),
    enabled: canRead,
  })

  const saveMutation = useMutation({
    mutationFn: (body: CreateBackupScheduleInput & { id?: string }) =>
      body.id ? BackupsApi.updateSchedule(body.id, body) : BackupsApi.createSchedule(body),
    onSuccess: () => {
      setModalOpen(false)
      setEditing(null)
      toast.success(t('Schedule saved', 'تم حفظ الجدولة'))
      void queryClient.invalidateQueries({ queryKey: QK.backups.schedules })
      void queryClient.invalidateQueries({ queryKey: QK.backups.health })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => BackupsApi.updateSchedule(id, { enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK.backups.schedules })
      void queryClient.invalidateQueries({ queryKey: QK.backups.health })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  useEffect(() => {
    if (createScheduleRequestId <= 0) return
    if (createScheduleRequestId === lastCreateScheduleRequestRef.current) return
    lastCreateScheduleRequestRef.current = createScheduleRequestId
    if (!canMutate) return
    setEditing(null)
    setModalOpen(true)
  }, [canMutate, createScheduleRequestId])

  const rows = useMemo(() => {
    const now = new Date()
    return (schedulesQuery.data?.items ?? []).map((row) => {
      const nextRun = getNextBackupScheduleRun(row, now)
      return {
        ...row,
        nextRunLabel: nextRun ? formatBackupTimestamp(nextRun.toISOString()) : '—',
      }
    })
  }, [schedulesQuery.data])

  const columns = useMemo<ColumnDef<(typeof rows)[number]>[]>(() => {
    const cols: ColumnDef<(typeof rows)[number]>[] = [
      {
        id: 'frequency',
        header: t('Frequency', 'التكرار'),
        accessorFn: (row) => formatScheduleFrequency(row.frequency),
        meta: { priority: 1 },
      },
      {
        id: 'time',
        header: t('Time', 'الوقت'),
        accessorFn: (row) => formatScheduleTime(row.hour, row.minute),
        meta: { priority: 1 },
      },
      {
        id: 'retention',
        header: t('Retention days', 'أيام الاحتفاظ'),
        accessorFn: (row) => String(row.retentionDays),
        meta: { priority: 2 },
      },
      {
        id: 'policy',
        header: t('Storage policy', 'سياسة التخزين'),
        accessorFn: (row) => localizedScheduleStoragePolicyLabel(row.storagePolicy, t),
        meta: { priority: 2 },
      },
      {
        id: 'enabled',
        header: t('Enabled', 'مفعّل'),
        cell: ({ row }) => (
          <StatusBadge tone={row.original.enabled ? 'success' : 'neutral'}>
            {row.original.enabled ? t('Yes', 'نعم') : t('No', 'لا')}
          </StatusBadge>
        ),
        meta: { priority: 1 },
      },
      {
        id: 'lastRun',
        header: t('Last run', 'آخر تشغيل'),
        accessorFn: (row) => formatBackupTimestamp(row.lastRunAt),
        meta: { priority: 3 },
      },
      {
        id: 'nextRun',
        header: t('Next run', 'التشغيل القادم'),
        accessorFn: (row) => row.nextRunLabel,
        meta: { priority: 2 },
      },
    ]

    if (canMutate) {
      cols.push({
        id: 'actions',
        header: t('Actions', 'إجراءات'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(row.original)
                setModalOpen(true)
              }}
            >
              {t('Edit', 'تعديل')}
            </Button>
            <Button
              type="button"
              variant={row.original.enabled ? 'destructive' : 'default'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                toggleMutation.mutate({ id: row.original.id, enabled: !row.original.enabled })
              }}
              disabled={toggleMutation.isPending}
            >
              {row.original.enabled ? t('Disable', 'تعطيل') : t('Enable', 'تفعيل')}
            </Button>
          </div>
        ),
        meta: { priority: 1, cardAction: true },
      })
    }

    return cols
  }, [canMutate, isArabic, toggleMutation.isPending])

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />
  }

  return (
    <BackupsLayout>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        loading={schedulesQuery.isLoading}
        empty={t('No schedules configured yet.', 'لا توجد جداول بعد.')}
      />

      {canMutate ? (
        <BackupScheduleModal
          open={modalOpen}
          schedule={editing}
          loading={saveMutation.isPending}
          onClose={() => {
            if (!saveMutation.isPending) {
              setModalOpen(false)
              setEditing(null)
            }
          }}
          onSubmit={(body) => {
            if (editing) saveMutation.mutate({ ...body, id: editing.id })
            else saveMutation.mutate(body)
          }}
        />
      ) : null}
    </BackupsLayout>
  )
}
