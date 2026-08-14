import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { Alert, Badge, SectionContainer } from '@ds';
import { BackupHealthAuditPanel } from '../../components/backups/BackupHealthAuditPanel';
import { Button } from '../../components/Button';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupBytes, formatBackupTimestamp } from '../../lib/backup-display';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupHealthStatus,
  localizedGoogleDriveSyncStatus,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { useToast } from '../../components/ToastProvider';

import { BackupsApi, type BackupHealthSeverity } from '../../api/backups';

function healthStatusClass(status: BackupHealthSeverity): string {
  switch (status) {
    case 'healthy':
      return 'border-status-success-border bg-status-success-bg text-status-success-fg';
    case 'warning':
      return 'border-status-warning-border bg-status-warning-bg text-status-warning-fg';
    case 'critical':
      return 'border-status-danger-border bg-status-danger-bg text-status-danger-fg';
    default:
      return 'border-border bg-surface-card-muted text-text-strong';
  }
}

function alertVariant(severity: 'warning' | 'critical'): 'warning' | 'error' {
  return severity === 'critical' ? 'error' : 'warning';
}

function formatHours(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} h`;
}

function deriveDriveHealthKey(
  drive: NonNullable<Awaited<ReturnType<typeof BackupsApi.getHealth>>['driveStatus']>,
): 'disabled' | 'not_connected' | 'failed' | 'pending' | 'healthy' | 'idle' {
  if (!drive.enabled) return 'disabled';
  if (!drive.configured || !drive.connected) return 'not_connected';
  if (drive.failedSyncCount > 0) return 'failed';
  if (drive.pendingSyncCount > 0) return 'pending';
  if (drive.lastSyncedAt) return 'healthy';
  return 'idle';
}

function driveHealthSeverity(key: ReturnType<typeof deriveDriveHealthKey>): BackupHealthSeverity {
  if (key === 'healthy' || key === 'idle') return 'healthy';
  if (key === 'pending' || key === 'disabled') return 'warning';
  return 'critical';
}

const GDRIVE_ALERT_CODES = new Set([
  'gdrive_not_configured',
  'gdrive_not_connected',
  'gdrive_sync_failures',
  'gdrive_pending_sync',
  'gdrive_stale_sync',
]);

export function BackupHealthPage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled();
  const { user } = useAuth();
  const { canRead } = useBackupAdminAccess();
  const isSuperAdmin = user?.role === 'super_admin';
  const { t } = useWmsTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: QK.backups.health,
    queryFn: () => BackupsApi.getHealth(),
    enabled: canRead,
    refetchInterval: 60_000,
  });

  const evaluateMutation = useMutation({
    mutationFn: () => BackupsApi.evaluateHealthAlerts(),
    onSuccess: (result) => {
      toast.success(
        t([
          `Alert evaluation complete — status: ${result.healthStatus}`,
          `اكتمل تقييم التنبيهات — الحالة: ${result.healthStatus}`,
        ]),
      );
      void queryClient.invalidateQueries({ queryKey: QK.backups.health });
      void queryClient.invalidateQueries({ queryKey: QK.backups.auditRecent });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const health = healthQuery.data;
  const drive = gdriveUiEnabled ? health?.driveStatus : undefined;
  const driveKey = drive ? deriveDriveHealthKey(drive) : 'disabled';
  const visibleAlerts =
    health?.alerts.filter((alert) => gdriveUiEnabled || !GDRIVE_ALERT_CODES.has(alert.code)) ?? [];

  return (
    <div className="space-y-4">
      <SectionContainer
        title={t(['Backup health dashboard', 'لوحة صحة النسخ الاحتياطي'])}
        actions={
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
                ? t(['Evaluating…', 'جارٍ التقييم…'])
                : t(['Evaluate alerts now', 'تقييم التنبيهات الآن'])}
            </Button>
          ) : undefined
        }
      >
        {healthQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : health ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div
                className={`rounded-xl border-2 p-4 ${healthStatusClass(health.healthStatus)}`}
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {t(['Health status', 'حالة الصحة'])}
                </p>
                <p className="mt-1 text-2xl font-bold capitalize">
                  {localizedBackupHealthStatus(health.healthStatus, t)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs text-text-muted">
                  {t(['Last successful backup', 'آخر نسخة ناجحة'])}
                </p>
                <p className="mt-1 font-semibold text-text-strong">
                  {formatBackupTimestamp(health.lastSuccessfulBackupAt)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs text-text-muted">
                  {t(['Last failed backup', 'آخر نسخة فاشلة'])}
                </p>
                <p className="mt-1 font-semibold text-text-strong">
                  {formatBackupTimestamp(health.lastFailedBackupAt)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs text-text-muted">{t(['Backup count', 'عدد النسخ'])}</p>
                <p className="mt-1 text-2xl font-semibold text-text-strong">{health.backupCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs text-text-muted">{t(['Storage used', 'التخزين المستخدم'])}</p>
                <p className="mt-1 text-2xl font-semibold text-text-strong">
                  {formatBackupBytes(health.storageUsedBytes)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs text-text-muted">
                  {t(['Next scheduled backup', 'النسخة المجدولة القادمة'])}
                </p>
                <p className="mt-1 font-semibold text-text-strong">
                  {formatBackupTimestamp(health.nextScheduledBackupAt)}
                </p>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-text-strong">
              {t(['Metrics', 'المقاييس'])}
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <dt className="text-xs text-text-muted">
                  {t(['Hours since success', 'ساعات منذ النجاح'])}
                </dt>
                <dd className="font-semibold text-text-strong">
                  {formatHours(health.metrics.hoursSinceLastSuccessfulBackup)}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-xs text-text-muted">
                  {t(['Hours since failure', 'ساعات منذ الفشل'])}
                </dt>
                <dd className="font-semibold text-text-strong">
                  {formatHours(health.metrics.hoursSinceLastFailedBackup)}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-xs text-text-muted">
                  {t(['Oldest backup age', 'عمر أقدم نسخة'])}
                </dt>
                <dd className="font-semibold text-text-strong">
                  {formatHours(health.metrics.oldestBackupAgeHours)}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-xs text-text-muted">
                  {t(['Recent failure count', 'إخفاقات حديثة'])}
                </dt>
                <dd className="font-semibold text-text-strong">{health.metrics.recentFailureCount}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </SectionContainer>

      {drive ? (
        <SectionContainer
          title={t(['Google Drive DR status', 'حالة Google Drive للتعافي'])}
          description={t([
            'Off-site backup sync health. Manage connection under Settings → Backups → Google Drive.',
            'صحة مزامنة النسخ خارج الموقع. إدارة الاتصال من الإعدادات → النسخ → Google Drive.',
          ])}
          actions={
            <Link
              to="/backups/google-drive"
              className="text-sm font-medium text-text-link hover:underline"
            >
              {t(['Open Google Drive settings', 'فتح إعدادات Google Drive'])}
            </Link>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`rounded-xl border-2 p-4 ${healthStatusClass(driveHealthSeverity(driveKey))}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t(['Drive sync', 'مزامنة Drive'])}
              </p>
              <p className="mt-1 text-lg font-bold">
                {localizedGoogleDriveSyncStatus(driveKey, t)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-text-muted">{t(['Configured', 'مُعدّ'])}</dt>
              <dd className="font-semibold text-text-strong">{drive.configured ? t(['Yes', 'نعم']) : t(['No', 'لا'])}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-text-muted">{t(['Connected', 'متصل'])}</dt>
              <dd className="font-semibold text-text-strong">{drive.connected ? t(['Yes', 'نعم']) : t(['No', 'لا'])}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-text-muted">{t(['Last sync', 'آخر مزامنة'])}</dt>
              <dd className="font-semibold text-text-strong">{formatBackupTimestamp(drive.lastSyncedAt)}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-text-muted">{t(['Pending syncs', 'مزامنات معلّقة'])}</dt>
              <dd className="font-semibold text-text-strong">{drive.pendingSyncCount}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-text-muted">{t(['Failed syncs', 'مزامنات فاشلة'])}</dt>
              <dd className="font-semibold text-text-strong">{drive.failedSyncCount}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-text-muted">
                {t(['Hours since last sync', 'ساعات منذ آخر مزامنة'])}
              </dt>
              <dd className="font-semibold text-text-strong">{formatHours(drive.hoursSinceLastSync)}</dd>
            </div>
          </div>
        </SectionContainer>
      ) : null}

      {health && visibleAlerts.length > 0 ? (
        <SectionContainer title={t(['Active alerts', 'تنبيهات نشطة'])}>
          <ul className="space-y-2">
            {visibleAlerts.map((alert) => (
              <li key={`${alert.code}-${alert.severity}`}>
                <Alert
                  variant={alertVariant(alert.severity)}
                  compact
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium">{alert.code}</span>
                      <Badge tone={alert.severity === 'critical' ? 'danger' : 'warning'} size="xs">
                        {alert.severity}
                      </Badge>
                    </span>
                  }
                  description={alert.message}
                />
              </li>
            ))}
          </ul>
        </SectionContainer>
      ) : health ? (
        <SectionContainer>
          <p className="text-sm text-text-muted">
            {t(['No active alerts.', 'لا توجد تنبيهات نشطة.'])}
          </p>
        </SectionContainer>
      ) : null}

      <BackupHealthAuditPanel />
    </div>
  );
}
