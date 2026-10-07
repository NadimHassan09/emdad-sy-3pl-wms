import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { StatusBadge, Widget, WidgetLink } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { toast } from 'sonner'
import { BackupsApi, type BackupHealthSeverity } from '@/api/backups'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useBackupAdminAccess } from '@/hooks/useBackupAdminAccess'
import { formatBackupBytes, formatBackupTimestamp } from '@/lib/backup-display'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'
import { defaultHomePath } from '@/lib/rbac'
import { localizedBackupHealthStatus, localizedGoogleDriveSyncStatus } from '@/lib/settings-backup-labels'
import { BackupsLayout } from './BackupsLayout'
import { healthStatusSurfaceClass } from './backups-ui'
import { BackupHealthAuditPanel } from './components/BackupHealthAuditPanel'

function formatHours(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)} h`
}

function deriveDriveHealthKey(
  drive: NonNullable<Awaited<ReturnType<typeof BackupsApi.getHealth>>['driveStatus']>,
): 'disabled' | 'not_connected' | 'failed' | 'pending' | 'healthy' | 'idle' {
  if (!drive.enabled) return 'disabled'
  if (!drive.configured || !drive.connected) return 'not_connected'
  if (drive.failedSyncCount > 0) return 'failed'
  if (drive.pendingSyncCount > 0) return 'pending'
  if (drive.lastSyncedAt) return 'healthy'
  return 'idle'
}

function driveHealthSeverity(key: ReturnType<typeof deriveDriveHealthKey>): BackupHealthSeverity {
  if (key === 'healthy' || key === 'idle') return 'healthy'
  if (key === 'pending' || key === 'disabled') return 'warning'
  return 'critical'
}

const GDRIVE_ALERT_CODES = new Set([
  'gdrive_not_configured',
  'gdrive_not_connected',
  'gdrive_sync_failures',
  'gdrive_pending_sync',
  'gdrive_stale_sync',
])

export function BackupHealthPage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled()
  const { user } = useAuth()
  const { canRead } = useBackupAdminAccess()
  const isSuperAdmin = user?.role === 'super_admin'
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()

  const healthQuery = useQuery({
    queryKey: QK.backups.health,
    queryFn: () => BackupsApi.getHealth(),
    enabled: canRead,
    refetchInterval: 60_000,
  })

  const evaluateMutation = useMutation({
    mutationFn: () => BackupsApi.evaluateHealthAlerts(),
    onSuccess: (result) => {
      toast.success(
        t(
          `Alert evaluation complete — status: ${result.healthStatus}`,
          `اكتمل تقييم التنبيهات — الحالة: ${result.healthStatus}`,
        ),
      )
      void queryClient.invalidateQueries({ queryKey: QK.backups.health })
      void queryClient.invalidateQueries({ queryKey: QK.backups.auditRecent })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />
  }

  const health = healthQuery.data
  const drive = gdriveUiEnabled ? health?.driveStatus : undefined
  const driveKey = drive ? deriveDriveHealthKey(drive) : 'disabled'
  const visibleAlerts =
    health?.alerts.filter((alert) => gdriveUiEnabled || !GDRIVE_ALERT_CODES.has(alert.code)) ?? []

  return (
    <BackupsLayout>
      <Widget
        title={t('Backup health dashboard', 'لوحة صحة النسخ الاحتياطي')}
        action={
          isSuperAdmin ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={evaluateMutation.isPending}
              onClick={() => evaluateMutation.mutate()}
              data-testid="evaluate-health-alerts-btn"
            >
              {evaluateMutation.isPending
                ? t('Evaluating…', 'جارٍ التقييم…')
                : t('Evaluate alerts now', 'تقييم التنبيهات الآن')}
            </Button>
          ) : undefined
        }
      >
        {healthQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
        ) : health ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className={`rounded-xl p-4 ${healthStatusSurfaceClass(health.healthStatus)}`}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {t('Health status', 'حالة الصحة')}
                </p>
                <p className="mt-1 text-2xl font-bold capitalize">
                  {localizedBackupHealthStatus(health.healthStatus, t)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{t('Last successful backup', 'آخر نسخة ناجحة')}</p>
                <p className="mt-1 font-semibold">{formatBackupTimestamp(health.lastSuccessfulBackupAt)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{t('Next scheduled backup', 'النسخة المجدولة القادمة')}</p>
                <p className="mt-1 font-semibold">{formatBackupTimestamp(health.nextScheduledBackupAt)}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{t('Backup count', 'عدد النسخ')}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{health.backupCount}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{t('Storage used', 'التخزين المستخدم')}</p>
                <p className="mt-1 text-2xl font-semibold">{formatBackupBytes(health.storageUsedBytes)}</p>
              </div>
            </div>
            <h3 className="mt-6 text-sm font-semibold">{t('Metrics', 'المقاييس')}</h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{t('Hours since success', 'ساعات منذ النجاح')}</dt>
                <dd className="font-semibold">{formatHours(health.metrics.hoursSinceLastSuccessfulBackup)}</dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{t('Recent failure count', 'إخفاقات حديثة')}</dt>
                <dd className="font-semibold">{health.metrics.recentFailureCount}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </Widget>

      {drive ? (
        <Widget
          title={t('Google Drive DR status', 'حالة Google Drive للتعافي')}
          action={<WidgetLink to="/backups/google-drive">{t('Open Google Drive settings', 'فتح إعدادات Google Drive')}</WidgetLink>}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`rounded-xl p-4 ${healthStatusSurfaceClass(driveHealthSeverity(driveKey))}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">{t('Drive sync', 'مزامنة Drive')}</p>
              <p className="mt-1 text-lg font-bold">{localizedGoogleDriveSyncStatus(driveKey, t)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t('Pending syncs', 'مزامنات معلّقة')}</dt>
              <dd className="font-semibold">{drive.pendingSyncCount}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t('Failed syncs', 'مزامنات فاشلة')}</dt>
              <dd className="font-semibold">{drive.failedSyncCount}</dd>
            </div>
          </div>
        </Widget>
      ) : null}

      {health && visibleAlerts.length > 0 ? (
        <Widget title={t('Active alerts', 'تنبيهات نشطة')}>
          <ul className="space-y-2">
            {visibleAlerts.map((alert) => (
              <li key={`${alert.code}-${alert.severity}`}>
                <Alert variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                  <AlertTitle className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{alert.code}</span>
                    <StatusBadge tone={alert.severity === 'critical' ? 'danger' : 'warning'}>
                      {alert.severity}
                    </StatusBadge>
                  </AlertTitle>
                  <AlertDescription>{alert.message}</AlertDescription>
                </Alert>
              </li>
            ))}
          </ul>
        </Widget>
      ) : health ? (
        <p className="text-sm text-muted-foreground">{t('No active alerts.', 'لا توجد تنبيهات نشطة.')}</p>
      ) : null}

      <BackupHealthAuditPanel />
    </BackupsLayout>
  )
}
