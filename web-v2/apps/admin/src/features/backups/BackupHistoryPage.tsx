import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, Navigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { DataTable, FilterBar, ResetFiltersButton, SearchInput, StatusBadge } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent } from '@emdad/ui/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { AuditLogsApi } from '@/api/audit-logs'
import {
  BackupsApi,
  type BackupDetail,
  type BackupJobStatus,
  type BackupSummary,
  type CreateBackupInput,
  type ListBackupsParams,
} from '@/api/backups'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useBackupAdminAccess } from '@/hooks/useBackupAdminAccess'
import { useBackupRunningStatusPoll } from '@/hooks/useBackupRunningStatusPoll'
import { useCachedState } from '@/hooks/useCachedState'
import { useFilters } from '@/hooks/useFilters'
import { formatAuditActionLabel, formatAuditTimestamp } from '@/lib/audit-log-display'
import { isBackupAuditAction } from '@/lib/backup-audit-actions'
import {
  backupCreatedByLabel,
  backupJobStatusTone,
  backupTypeTone,
  formatBackupBytes,
  formatBackupStorage,
  formatBackupTimestamp,
  formatGdriveSyncStatus,
  gdriveSyncTone,
  isBackupDownloadable,
  shouldShowBackupProgress,
} from '@/lib/backup-display'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'
import { defaultHomePath } from '@/lib/rbac'
import {
  localizedBackupHealthStatus,
  localizedBackupStatusFilterOptions,
  localizedBackupStatusLabel,
  localizedBackupStoragePolicyLabel,
  localizedBackupTypeFilterOptions,
  localizedBackupTypeLabel,
} from '@/lib/settings-backup-labels'
import { BackupsLayout } from './BackupsLayout'
import { formatRelativeFuture, formatRelativePast, healthStatusDotClass } from './backups-ui'
import { useBackupOperationContext } from './BackupOperationContext'
import { BackupDetailModal } from './components/BackupDetailModal'
import { BackupFactoryResetModal } from './components/BackupFactoryResetModal'
import { BackupRestoreModal } from './components/BackupRestoreModal'
import { BackupUploadModal } from './components/BackupUploadModal'
import { CreateBackupModal } from './components/CreateBackupModal'

type BackupHistoryFilters = {
  search: string
  type: string
  status: string
}

export function BackupHistoryPage() {
  const { user } = useAuth()
  const { canRead, canMutate } = useBackupAdminAccess()
  const isSuperAdmin = user?.role === 'super_admin'
  const queryClient = useQueryClient()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const typeOptions = useMemo(() => localizedBackupTypeFilterOptions(t), [isArabic])
  const statusOptions = useMemo(() => localizedBackupStatusFilterOptions(t), [isArabic])

  const [page, setPage] = useCachedState('backup-history-page', 1)
  const [pageSize, setPageSize] = useCachedState('backup-history-page-size', 20)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailSeed, setDetailSeed] = useState<BackupSummary | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [factoryResetModalOpen, setFactoryResetModalOpen] = useState(false)
  const [activeCreateJobId, setActiveCreateJobId] = useState<string | null>(null)
  const handledCreateTerminalRef = useRef<string | null>(null)
  const lastCreateRequestRef = useRef(0)
  const lastUploadRequestRef = useRef(0)
  const lastRestoreRequestRef = useRef(0)
  const lastFactoryResetRequestRef = useRef(0)

  const {
    createBackupRequestId,
    setCreateBackupBusy,
    uploadBackupRequestId,
    restoreBackupRequestId,
    factoryResetRequestId,
  } = useBackupOperationContext()

  const initialFilters = useMemo<BackupHistoryFilters>(() => ({ search: '', type: '', status: '' }), [])
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initialFilters)

  const listParams = useMemo<ListBackupsParams>(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: appliedFilters.search.trim() || undefined,
      type: (appliedFilters.type as ListBackupsParams['type']) || undefined,
      status: (appliedFilters.status as BackupJobStatus) || undefined,
    }),
    [appliedFilters, page, pageSize],
  )

  const healthQuery = useQuery({
    queryKey: QK.backups.health,
    queryFn: () => BackupsApi.getHealth(),
    enabled: canRead,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const auditActivityQuery = useQuery({
    queryKey: QK.backups.auditRecent,
    queryFn: async () => {
      const result = await AuditLogsApi.list({ limit: 50, offset: 0, sort_by: 'created_at', sort_dir: 'desc' })
      return result.items.filter((row) => isBackupAuditAction(row.action)).slice(0, 8)
    },
    enabled: canRead && isSuperAdmin,
    staleTime: 30_000,
  })

  const listQuery = useQuery({
    queryKey: QK.backups.list({ mode: 'server', ...listParams }),
    queryFn: () => BackupsApi.list(listParams),
    enabled: canRead,
    placeholderData: (prev) => prev,
  })

  const createStatusQuery = useQuery({
    queryKey: QK.backups.status(activeCreateJobId ?? 'none'),
    queryFn: () => BackupsApi.status(activeCreateJobId!),
    enabled: !!activeCreateJobId,
    refetchInterval: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: (body: CreateBackupInput) => BackupsApi.create(body),
    onSuccess: (result) => {
      setCreateModalOpen(false)
      handledCreateTerminalRef.current = null
      setActiveCreateJobId(result.jobId)
      toast.success(t('Backup started', 'بدأ النسخ الاحتياطي'))
      void queryClient.invalidateQueries({ queryKey: QK.backups.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  useEffect(() => {
    const status = createStatusQuery.data?.status
    if (!activeCreateJobId || !status) return
    if (status !== 'completed' && status !== 'failed') return
    if (handledCreateTerminalRef.current === activeCreateJobId) return
    handledCreateTerminalRef.current = activeCreateJobId
    if (status === 'completed') {
      toast.success(t('Backup completed successfully', 'اكتمل النسخ الاحتياطي بنجاح'))
      void queryClient.invalidateQueries({ queryKey: QK.backups.all })
      void queryClient.invalidateQueries({ queryKey: QK.backups.health })
      const timer = window.setTimeout(() => setActiveCreateJobId(null), 4_000)
      return () => window.clearTimeout(timer)
    }
    toast.error(createStatusQuery.data?.errorMessage ?? t('Backup failed', 'فشل النسخ الاحتياطي'))
    void queryClient.invalidateQueries({ queryKey: QK.backups.all })
    return undefined
  }, [activeCreateJobId, createStatusQuery.data, queryClient, isArabic])

  const baseRows = listQuery.data?.items ?? []
  const { mergedRows, isPolling } = useBackupRunningStatusPoll(baseRows)
  const total = listQuery.data?.total ?? 0

  const detailQuery = useQuery({
    queryKey: QK.backups.detail(detailId ?? ''),
    queryFn: () => BackupsApi.getById(detailId!),
    enabled: !!detailId,
  })

  const openDetails = useCallback((row: BackupSummary) => {
    setDetailId(row.id)
    setDetailSeed(row)
  }, [])

  const closeDetails = useCallback(() => {
    setDetailId(null)
    setDetailSeed(null)
  }, [])

  const handleDownload = useCallback(
    async (row: BackupSummary) => {
      if (!isSuperAdmin) return
      setDownloadingId(row.id)
      try {
        await BackupsApi.download(row.id, row.label ? `${row.label}.dump` : null)
        toast.success(t('Download started', 'بدأ التنزيل'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('Download failed', 'فشل التنزيل'))
      } finally {
        setDownloadingId(null)
      }
    },
    [isSuperAdmin, isArabic],
  )

  const columns = useMemo<ColumnDef<BackupSummary>[]>(() => {
    const cols: ColumnDef<BackupSummary>[] = [
      {
        id: 'created',
        header: t('Created at', 'تاريخ الإنشاء'),
        accessorFn: (row) => formatBackupTimestamp(row.createdAt),
        meta: { priority: 1 },
      },
      {
        id: 'type',
        header: t('Type', 'النوع'),
        cell: ({ row }) => (
          <StatusBadge tone={backupTypeTone(row.original.type)}>
            {localizedBackupTypeLabel(row.original.type, t)}
          </StatusBadge>
        ),
        meta: { priority: 1 },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <span className="inline-flex flex-col gap-1">
            <StatusBadge tone={backupJobStatusTone(row.original.status)}>
              {localizedBackupStatusLabel(row.original.status, t)}
            </StatusBadge>
            {shouldShowBackupProgress(row.original) ? (
              <span className="text-xs text-muted-foreground">{row.original.progressPercent}%</span>
            ) : null}
          </span>
        ),
        meta: { priority: 1 },
      },
      {
        id: 'size',
        header: t('Size', 'الحجم'),
        accessorFn: (row) => formatBackupBytes(row.bytesWritten),
        meta: { priority: 2, align: 'end' },
      },
      {
        id: 'createdBy',
        header: t('Created by', 'أنشأه'),
        accessorFn: (row) => backupCreatedByLabel(row),
        meta: { priority: 2 },
      },
      {
        id: 'storage',
        header: t('Storage', 'التخزين'),
        accessorFn: (row) =>
          row.storagePolicy
            ? localizedBackupStoragePolicyLabel(row.storagePolicy, t)
            : formatBackupStorage(row.manifest),
        meta: { priority: 3 },
      },
    ]

    if (isBackupGdriveUiEnabled()) {
      cols.push({
        id: 'driveSync',
        header: t('Drive sync', 'مزامنة Drive'),
        cell: ({ row }) => {
          const label = formatGdriveSyncStatus(row.original.gdriveSyncStatus, row.original.storagePolicy)
          if (label === 'N/A' || label === '—') return <span className="text-sm text-muted-foreground">{label}</span>
          return <StatusBadge tone={gdriveSyncTone(row.original.gdriveSyncStatus)}>{label}</StatusBadge>
        },
        meta: { priority: 3 },
      })
    }

    cols.push({
      id: 'download',
      header: t('Actions', 'إجراءات'),
      cell: ({ row }) =>
        isSuperAdmin && isBackupDownloadable(row.original) ? (
          <Button
            size="sm"
            disabled={downloadingId === row.original.id}
            onClick={(e) => {
              e.stopPropagation()
              void handleDownload(row.original)
            }}
          >
            {downloadingId === row.original.id ? t('Downloading…', 'جارٍ التنزيل…') : t('Download', 'تنزيل')}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      meta: { priority: 1, cardAction: true },
    })

    return cols
  }, [downloadingId, handleDownload, isSuperAdmin, isArabic])

  const health = healthQuery.data
  const disk = health?.diskStorage
  const storageTotalBytes = disk?.totalBytes ?? 0
  const storageAvailableBytes = disk?.availableBytes ?? 0
  const occupiedBytes = Math.max(0, storageTotalBytes - storageAvailableBytes)
  const storageOccupiedPct =
    storageTotalBytes > 0 ? Math.min(100, Math.round((occupiedBytes / storageTotalBytes) * 1000) / 10) : 0

  const createStatus = createStatusQuery.data
  const showCreateProgress =
    !!activeCreateJobId && createStatus && (createStatus.status === 'pending' || createStatus.status === 'running')

  useEffect(() => {
    setCreateBackupBusy(Boolean(showCreateProgress))
    return () => setCreateBackupBusy(false)
  }, [setCreateBackupBusy, showCreateProgress])

  useEffect(() => {
    if (createBackupRequestId <= 0) return
    if (createBackupRequestId === lastCreateRequestRef.current) return
    lastCreateRequestRef.current = createBackupRequestId
    if (!canMutate || showCreateProgress) return
    setCreateModalOpen(true)
  }, [canMutate, createBackupRequestId, showCreateProgress])

  useEffect(() => {
    if (uploadBackupRequestId <= 0) return
    if (uploadBackupRequestId === lastUploadRequestRef.current) return
    lastUploadRequestRef.current = uploadBackupRequestId
    if (!canMutate) return
    setUploadModalOpen(true)
  }, [canMutate, uploadBackupRequestId])

  useEffect(() => {
    if (restoreBackupRequestId <= 0) return
    if (restoreBackupRequestId === lastRestoreRequestRef.current) return
    lastRestoreRequestRef.current = restoreBackupRequestId
    if (!canMutate) return
    setRestoreModalOpen(true)
  }, [canMutate, restoreBackupRequestId])

  useEffect(() => {
    if (factoryResetRequestId <= 0) return
    if (factoryResetRequestId === lastFactoryResetRequestRef.current) return
    lastFactoryResetRequestRef.current = factoryResetRequestId
    if (!canMutate) return
    setFactoryResetModalOpen(true)
  }, [canMutate, factoryResetRequestId])

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />
  }

  const detailRow: BackupDetail | null = detailQuery.data ?? (detailSeed as BackupDetail | null)

  return (
    <BackupsLayout>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-muted-foreground">{t('Backup health', 'صحة النسخ الاحتياطي')}</p>
            {health ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-block size-2.5 rounded-full ${healthStatusDotClass(health.healthStatus)}`} />
                  <span className="text-lg font-semibold">{localizedBackupHealthStatus(health.healthStatus, t)}</span>
                </div>
                <Link to="/backups/health" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                  {t('View health details', 'عرض تفاصيل الصحة')}
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('Last successful backup', 'آخر نسخة ناجحة')}</p>
            <p className="mt-1 text-sm font-semibold">{formatBackupTimestamp(health?.lastSuccessfulBackupAt ?? null)}</p>
            <p className="text-xs text-muted-foreground">
              {formatRelativePast(health?.lastSuccessfulBackupAt ?? null, isArabic)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('Next scheduled backup', 'النسخة المجدولة القادمة')}</p>
            <p className="mt-1 text-sm font-semibold">{formatBackupTimestamp(health?.nextScheduledBackupAt ?? null)}</p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeFuture(health?.nextScheduledBackupAt ?? null, isArabic)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('Storage used', 'التخزين المستخدم')}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {disk ? formatBackupBytes(occupiedBytes) : '—'}{' '}
              <span className="font-normal text-muted-foreground">
                {t('of', 'من')} {disk ? formatBackupBytes(storageTotalBytes) : '—'} ({storageOccupiedPct}%)
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <FilterBar>
        <SearchInput
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
          placeholder={t('ID, label, email…', 'المعرّف، التسمية، البريد…')}
          className="sm:max-w-xs"
        />
        <Select value={draftFilters.type || '__all__'} onValueChange={(v) => setDraft({ type: v === '__all__' ? '' : v })}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('Type', 'النوع')} />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || '__all__'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={draftFilters.status || '__all__'}
          onValueChange={(v) => setDraft({ status: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('Status', 'الحالة')} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || '__all__'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={listQuery.isFetching}
          onClick={() => {
            applyFilters()
            setPage(1)
          }}
        >
          {t('Apply', 'تطبيق')}
        </Button>
        <ResetFiltersButton
          label={t('Reset', 'إعادة ضبط')}
          disabled={listQuery.isFetching}
          onClick={() => {
            resetFilters()
            setPage(1)
          }}
        />
      </FilterBar>

      {showCreateProgress ? (
        <Alert>
          <AlertTitle>
            {t('Creating backup…', 'جارٍ إنشاء النسخة…')} {createStatus?.progressPercent ?? 0}%
          </AlertTitle>
          <AlertDescription>{activeCreateJobId}</AlertDescription>
        </Alert>
      ) : null}

      {isPolling ? (
        <p className="text-xs text-muted-foreground">
          {t('Live status polling active for running jobs.', 'تحديث مباشر لحالة المهام الجارية.')}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            columns={columns}
            data={mergedRows}
            getRowId={(row) => row.id}
            loading={listQuery.isLoading}
            empty={t('No backup jobs match your filters.', 'لا توجد مهام نسخ مطابقة.')}
            onRowClick={openDetails}
            pagination={{
              page,
              pageSize,
              total,
              pageSizeOptions: [10, 20, 50],
              onPageChange: setPage,
              onPageSizeChange: (size) => {
                setPageSize(size)
                setPage(1)
              },
            }}
          />
        </div>
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold">{t('Backup activity (latest)', 'نشاط النسخ (الأحدث)')}</h3>
            {isSuperAdmin ? (
              auditActivityQuery.isLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
              ) : auditActivityQuery.data && auditActivityQuery.data.length > 0 ? (
                <ul className="mt-3 divide-y">
                  {auditActivityQuery.data.map((row) => (
                    <li key={row.id} className="py-3 first:pt-0">
                      <p className="text-sm font-medium">{formatAuditActionLabel(row.action)}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.actorEmail}</p>
                      <time className="text-xs text-muted-foreground" dateTime={row.createdAt}>
                        {formatAuditTimestamp(row.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('No backup audit events yet.', 'لا توجد أحداث تدقيق بعد.')}
                </p>
              )
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('Audit activity is available to super administrators only.', 'نشاط التدقيق لمدير النظام فقط.')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <BackupDetailModal
        open={!!detailId}
        onClose={closeDetails}
        row={detailRow}
        loading={detailQuery.isLoading && !detailSeed}
      />

      {canMutate ? (
        <>
          <CreateBackupModal
            open={createModalOpen}
            loading={createMutation.isPending}
            onClose={() => {
              if (!createMutation.isPending) setCreateModalOpen(false)
            }}
            onSubmit={(body) => createMutation.mutate(body)}
          />
          <BackupUploadModal
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: QK.backups.all })
              toast.success(t('Backup uploaded', 'تم رفع النسخة'))
            }}
          />
          <BackupRestoreModal open={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} />
          <BackupFactoryResetModal open={factoryResetModalOpen} onClose={() => setFactoryResetModalOpen(false)} />
        </>
      ) : null}
    </BackupsLayout>
  )
}
