import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, Widget } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { toast } from 'sonner'
import { BackupsApi, type BackupJobType } from '@/api/backups'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useBackupAdminAccess } from '@/hooks/useBackupAdminAccess'
import { formatBackupTimestamp } from '@/lib/backup-display'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'
import { defaultHomePath } from '@/lib/rbac'
import {
  localizedBackupStoragePolicyLabel,
  localizedBackupTypeLabel,
  localizedGoogleDriveSyncStatus,
} from '@/lib/settings-backup-labels'
import { BackupsLayout } from './BackupsLayout'
import { healthStatusSurfaceClass } from './backups-ui'

type DriveSyncStatusKey = 'disabled' | 'not_connected' | 'failed' | 'pending' | 'healthy' | 'idle'

function deriveSyncStatus(status: Awaited<ReturnType<typeof BackupsApi.getGoogleDriveStatus>> | undefined): DriveSyncStatusKey {
  if (!status) return 'not_connected'
  if (!status.gdriveEnabled) return 'disabled'
  if (!status.connected) return 'not_connected'
  if (status.failedSyncCount > 0) return 'failed'
  if (status.pendingSyncCount > 0) return 'pending'
  if (status.lastSyncedAt) return 'healthy'
  return 'idle'
}

export function BackupGoogleDrivePage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled()
  const { user } = useAuth()
  const { canRead, canMutate } = useBackupAdminAccess()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)

  const driveQuery = useQuery({
    queryKey: QK.backups.googleDrive,
    queryFn: () => BackupsApi.getGoogleDriveStatus(),
    enabled: canRead && gdriveUiEnabled,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (searchParams.get('drive') !== 'connected') return
    toast.success(t('Google Drive connected successfully.', 'تم ربط Google Drive بنجاح.'))
    const next = new URLSearchParams(searchParams)
    next.delete('drive')
    setSearchParams(next, { replace: true })
    void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive })
  }, [queryClient, searchParams, setSearchParams, isArabic])

  const connectMutation = useMutation({
    mutationFn: () => BackupsApi.getGoogleDriveAuthUrl(),
    onSuccess: ({ url }) => {
      window.location.assign(url)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: () => BackupsApi.testGoogleDriveConnection(),
    onSuccess: (result) => {
      if (result.ok === false || result.connected === false) {
        toast.error(result.message ?? t('Connection test failed.', 'فشل اختبار الاتصال.'))
        return
      }
      toast.success(
        t(
          `Connection OK${result.folderName ? `: ${result.folderName}` : ''}`,
          `الاتصال سليم${result.folderName ? `: ${result.folderName}` : ''}`,
        ),
      )
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => BackupsApi.disconnectGoogleDrive(),
    onSuccess: (result) => {
      setDisconnectOpen(false)
      toast.success(
        result.disconnected
          ? t('Google Drive disconnected.', 'تم فصل Google Drive.')
          : t('Google Drive was not connected.', 'Google Drive غير متصل.'),
      )
      void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => BackupsApi.syncToDrive(jobId),
    onMutate: (jobId) => setRetryingJobId(jobId),
    onSettled: () => setRetryingJobId(null),
    onSuccess: (result) => {
      if (result.gdriveSyncStatus === 'synced') {
        toast.success(t('Backup synced to Google Drive.', 'تمت مزامنة النسخة إلى Google Drive.'))
      } else if (result.gdriveSyncStatus === 'failed') {
        toast.error(result.gdriveSyncError ?? t('Drive sync failed.', 'فشلت مزامنة Drive.'))
      } else {
        toast.success(t('Drive sync started.', 'بدأت مزامنة Drive.'))
      }
      void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const syncStatusKey = useMemo(() => deriveSyncStatus(driveQuery.data), [driveQuery.data])

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />
  }

  if (!gdriveUiEnabled) {
    return <Navigate to="/backups" replace />
  }

  const drive = driveQuery.data
  const canConnect = drive?.gdriveConfigured && !drive.connected
  const canDisconnect = drive?.connected
  const canTest = drive?.connected

  return (
    <BackupsLayout>
      <Widget
        title="Google Drive"
        action={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="default" disabled={!canConnect || connectMutation.isPending} onClick={() => connectMutation.mutate()}>
                {t('Connect Drive', 'ربط Drive')}
              </Button>
              <Button variant="secondary" disabled={!canTest || testMutation.isPending} onClick={() => testMutation.mutate()}>
                {t('Test connection', 'اختبار الاتصال')}
              </Button>
              <Button variant="destructive" disabled={!canDisconnect} onClick={() => setDisconnectOpen(true)}>
                {t('Disconnect Drive', 'فصل Drive')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {driveQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
        ) : drive ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              className={`rounded-xl border-2 p-4 ${
                drive.connected ? healthStatusSurfaceClass('healthy') : 'border bg-muted/30'
              }`}
            >
              <p className="text-xs font-medium uppercase opacity-80">{t('Connection status', 'حالة الاتصال')}</p>
              <p className="mt-1 text-lg font-semibold">
                {drive.connected ? t('Connected', 'متصل') : t('Not connected', 'غير متصل')}
              </p>
            </div>
            <div className={`rounded-xl border-2 p-4 ${healthStatusSurfaceClass(syncStatusKey === 'healthy' || syncStatusKey === 'idle' ? 'healthy' : syncStatusKey === 'pending' ? 'warning' : 'critical')}`}>
              <p className="text-xs font-medium uppercase opacity-80">{t('Sync status', 'حالة المزامنة')}</p>
              <p className="mt-1 text-lg font-semibold">{localizedGoogleDriveSyncStatus(syncStatusKey, t)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">{t('Last sync', 'آخر مزامنة')}</p>
              <p className="mt-1 text-lg font-semibold">{formatBackupTimestamp(drive.lastSyncedAt)}</p>
            </div>
          </div>
        ) : driveQuery.isError ? (
          <p className="text-sm text-tone-danger-fg">{(driveQuery.error as Error).message}</p>
        ) : null}
      </Widget>

      <Widget title={t('Backup sync failures', 'فشل مزامنة النسخ')}>
        {drive && drive.syncFailures.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">{t('Backup', 'النسخة')}</th>
                  <th className="px-3 py-2">{t('Type', 'النوع')}</th>
                  <th className="px-3 py-2">{t('Error', 'الخطأ')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {drive.syncFailures.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3 font-mono text-xs">{row.id.slice(0, 8)}…</td>
                    <td className="px-3 py-3">{localizedBackupTypeLabel(row.type as BackupJobType, t)}</td>
                    <td className="max-w-xs px-3 py-3 text-xs text-tone-danger-fg">{row.gdriveSyncError ?? '—'}</td>
                    <td className="px-3 py-3">
                      {canMutate ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={retryingJobId === row.id && retryMutation.isPending}
                          onClick={() => retryMutation.mutate(row.id)}
                        >
                          {t('Retry sync', 'إعادة المزامنة')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('No failed Drive sync jobs.', 'لا توجد مهام مزامنة Drive فاشلة.')}</p>
        )}
      </Widget>

      {canMutate ? (
        <ConfirmDialog
          open={disconnectOpen}
          onOpenChange={setDisconnectOpen}
          intent="danger"
          title={t('Disconnect Google Drive?', 'فصل Google Drive؟')}
          description={t(
            'Encrypted OAuth credentials will be removed. Existing Drive backups are not deleted.',
            'ستُزال بيانات OAuth المشفّرة. لن تُحذف النسخ الموجودة على Drive.',
          )}
          loading={disconnectMutation.isPending}
          confirmLabel={t('Disconnect', 'فصل')}
          cancelLabel={t('Cancel', 'إلغاء')}
          onConfirm={() => disconnectMutation.mutate()}
        />
      ) : null}
    </BackupsLayout>
  )
}
