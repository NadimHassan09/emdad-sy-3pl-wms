import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';

import { BackupsApi, type BackupHealthSeverity } from '../../api/backups';
import { BackupHealthAuditPanel } from '../../components/backups/BackupHealthAuditPanel';
import { Button } from '../../components/Button';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupBytes, formatBackupTimestamp } from '../../lib/backup-display';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupHealthStatus,
  localizedGoogleDriveSyncStatus,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { useToast } from '../../components/ToastProvider';

function healthStatusClass(status: BackupHealthSeverity): string {
  switch (status) {
    case 'healthy':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'critical':
      return 'border-rose-300 bg-rose-50 text-rose-900';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
}

function alertClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'border-rose-200 bg-rose-50 text-rose-900'
    : 'border-amber-200 bg-amber-50 text-amber-900';
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

export function BackupHealthPage() {
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
  const drive = health?.driveStatus;
  const driveKey = drive ? deriveDriveHealthKey(drive) : 'disabled';

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className={PANEL_TITLE_CLASS}>
            {t(['Backup health dashboard', 'لوحة صحة النسخ الاحتياطي'])}
          </h2>
          {isSuperAdmin ? (
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
          ) : null}
        </div>
        {healthQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : health ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">
                  {t(['Last successful backup', 'آخر نسخة ناجحة'])}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatBackupTimestamp(health.lastSuccessfulBackupAt)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">
                  {t(['Last failed backup', 'آخر نسخة فاشلة'])}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatBackupTimestamp(health.lastFailedBackupAt)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{t(['Backup count', 'عدد النسخ'])}</p>
                <p className="mt-1 text-2xl font-semibold">{health.backupCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{t(['Storage used', 'التخزين المستخدم'])}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatBackupBytes(health.storageUsedBytes)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">
                  {t(['Next scheduled backup', 'النسخة المجدولة القادمة'])}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatBackupTimestamp(health.nextScheduledBackupAt)}
                </p>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-800">
              {t(['Metrics', 'المقاييس'])}
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">
                  {t(['Hours since success', 'ساعات منذ النجاح'])}
                </dt>
                <dd className="font-semibold">
                  {formatHours(health.metrics.hoursSinceLastSuccessfulBackup)}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">
                  {t(['Hours since failure', 'ساعات منذ الفشل'])}
                </dt>
                <dd className="font-semibold">
                  {formatHours(health.metrics.hoursSinceLastFailedBackup)}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">
                  {t(['Oldest backup age', 'عمر أقدم نسخة'])}
                </dt>
                <dd className="font-semibold">
                  {formatHours(health.metrics.oldestBackupAgeHours)}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <dt className="text-xs text-slate-500">
                  {t(['Recent failure count', 'إخفاقات حديثة'])}
                </dt>
                <dd className="font-semibold">{health.metrics.recentFailureCount}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </section>

      {drive ? (
        <section className={PANEL_CARD_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={PANEL_TITLE_CLASS}>
                {t(['Google Drive DR status', 'حالة Google Drive للتعافي'])}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t([
                  'Off-site backup sync health. Manage connection under Settings → Backups → Google Drive.',
                  'صحة مزامنة النسخ خارج الموقع. إدارة الاتصال من الإعدادات → النسخ → Google Drive.',
                ])}
              </p>
            </div>
            <Link
              to="/settings/backups/google-drive"
              className="text-sm font-medium text-sky-700 hover:text-sky-900"
            >
              {t(['Open Google Drive settings', 'فتح إعدادات Google Drive'])}
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`rounded-xl border-2 p-4 ${healthStatusClass(driveKey === 'healthy' || driveKey === 'idle' ? 'healthy' : driveKey === 'pending' ? 'warning' : driveKey === 'disabled' ? 'healthy' : 'critical')}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t(['Drive sync', 'مزامنة Drive'])}
              </p>
              <p className="mt-1 text-lg font-bold">
                {localizedGoogleDriveSyncStatus(driveKey, t)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs text-slate-500">{t(['Configured', 'مُعدّ'])}</dt>
              <dd className="font-semibold">{drive.configured ? t(['Yes', 'نعم']) : t(['No', 'لا'])}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs text-slate-500">{t(['Connected', 'متصل'])}</dt>
              <dd className="font-semibold">{drive.connected ? t(['Yes', 'نعم']) : t(['No', 'لا'])}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs text-slate-500">{t(['Last sync', 'آخر مزامنة'])}</dt>
              <dd className="font-semibold">{formatBackupTimestamp(drive.lastSyncedAt)}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs text-slate-500">{t(['Pending syncs', 'مزامنات معلّقة'])}</dt>
              <dd className="font-semibold">{drive.pendingSyncCount}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs text-slate-500">{t(['Failed syncs', 'مزامنات فاشلة'])}</dt>
              <dd className="font-semibold">{drive.failedSyncCount}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <dt className="text-xs text-slate-500">
                {t(['Hours since last sync', 'ساعات منذ آخر مزامنة'])}
              </dt>
              <dd className="font-semibold">{formatHours(drive.hoursSinceLastSync)}</dd>
            </div>
          </div>
        </section>
      ) : null}

      {health && health.alerts.length > 0 ? (
        <section className={PANEL_CARD_CLASS}>
          <h2 className={PANEL_TITLE_CLASS}>{t(['Active alerts', 'تنبيهات نشطة'])}</h2>
          <ul className="mt-3 space-y-2">
            {health.alerts.map((alert) => (
              <li
                key={`${alert.code}-${alert.severity}`}
                className={`rounded-lg border px-4 py-3 text-sm ${alertClass(alert.severity)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium">{alert.code}</span>
                  <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold uppercase">
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-1">{alert.message}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : health ? (
        <section className={PANEL_CARD_CLASS}>
          <p className="text-sm text-slate-500">
            {t(['No active alerts.', 'لا توجد تنبيهات نشطة.'])}
          </p>
        </section>
      ) : null}

      <BackupHealthAuditPanel />
    </div>
  );
}
