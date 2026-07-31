import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { SectionContainer } from '@ds';

import {
  BackupsApi,
  type BackupJobType,
  type GoogleDriveAdminStatus,
} from '../../api/backups';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupTimestamp } from '../../lib/backup-display';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupStoragePolicyLabel,
  localizedBackupTypeLabel,
  localizedGoogleDriveSyncStatus,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';

type DriveSyncStatusKey = 'disabled' | 'not_connected' | 'failed' | 'pending' | 'healthy' | 'idle';

function deriveSyncStatus(status: GoogleDriveAdminStatus | undefined): DriveSyncStatusKey {
  if (!status) return 'not_connected';
  if (!status.gdriveEnabled) return 'disabled';
  if (!status.connected) return 'not_connected';
  if (status.failedSyncCount > 0) return 'failed';
  if (status.pendingSyncCount > 0) return 'pending';
  if (status.lastSyncedAt) return 'healthy';
  return 'idle';
}

function connectionCardClass(connected: boolean): string {
  return connected
    ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
    : 'border-border bg-surface-card-muted text-text-body';
}

function syncStatusCardClass(key: DriveSyncStatusKey): string {
  switch (key) {
    case 'healthy':
      return 'border-status-success-border bg-status-success-bg text-status-success-fg';
    case 'pending':
      return 'border-status-warning-border bg-status-warning-bg text-status-warning-fg';
    case 'failed':
      return 'border-status-danger-border bg-status-danger-bg text-status-danger-fg';
    case 'disabled':
      return 'border-border bg-surface-sunken text-text-muted';
    default:
      return 'border-border bg-surface-card text-text-body';
  }
}

export function BackupGoogleDrivePage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled();
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const driveQuery = useQuery({
    queryKey: QK.backups.googleDrive,
    queryFn: () => BackupsApi.getGoogleDriveStatus(),
    enabled: canRead && gdriveUiEnabled,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (searchParams.get('drive') !== 'connected') return;
    toast.success(
      t(['Google Drive connected successfully.', 'تم ربط Google Drive بنجاح.']),
    );
    const next = new URLSearchParams(searchParams);
    next.delete('drive');
    setSearchParams(next, { replace: true });
    void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive });
  }, [queryClient, searchParams, setSearchParams, t, toast]);

  const connectMutation = useMutation({
    mutationFn: () => BackupsApi.getGoogleDriveAuthUrl(),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: () => BackupsApi.testGoogleDriveConnection(),
    onSuccess: (result) => {
      if (result.ok === false || result.connected === false) {
        toast.error(result.message ?? t(['Connection test failed.', 'فشل اختبار الاتصال.']));
        return;
      }
      toast.success(
        t([
          `Connection OK${result.folderName ? `: ${result.folderName}` : ''}`,
          `الاتصال سليم${result.folderName ? `: ${result.folderName}` : ''}`,
        ]),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => BackupsApi.disconnectGoogleDrive(),
    onSuccess: (result) => {
      setDisconnectOpen(false);
      toast.success(
        result.disconnected
          ? t(['Google Drive disconnected.', 'تم فصل Google Drive.'])
          : t(['Google Drive was not connected.', 'Google Drive غير متصل.']),
      );
      void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => BackupsApi.syncToDrive(jobId),
    onMutate: (jobId) => setRetryingJobId(jobId),
    onSettled: () => setRetryingJobId(null),
    onSuccess: (result) => {
      if (result.gdriveSyncStatus === 'synced') {
        toast.success(t(['Backup synced to Google Drive.', 'تمت مزامنة النسخة إلى Google Drive.']));
      } else if (result.gdriveSyncStatus === 'failed') {
        toast.error(
          result.gdriveSyncError ??
            t(['Drive sync failed. See details below.', 'فشلت مزامنة Drive. راجع التفاصيل أدناه.']),
        );
      } else {
        toast.success(t(['Drive sync started.', 'بدأت مزامنة Drive.']));
      }
      void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncStatusKey = useMemo(() => deriveSyncStatus(driveQuery.data), [driveQuery.data]);

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  if (!gdriveUiEnabled) {
    return <Navigate to="/settings/backups" replace />;
  }

  const drive = driveQuery.data;
  const canConnect = drive?.gdriveConfigured && !drive.connected;
  const canDisconnect = drive?.connected;
  const canTest = drive?.connected;

  return (
    <div className="space-y-4">
      <SectionContainer
        title="Google Drive"
        description={t([
          'Connect encrypted backup storage to Google Drive. OAuth credentials are stored encrypted at rest.',
          'ربط التخزين الاحتياطي المشفّر بـ Google Drive. تُخزَّن بيانات OAuth مشفّرة.',
        ])}
        actions={
          canMutate ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="brand"
                loading={connectMutation.isPending}
                disabled={!canConnect}
                onClick={() => connectMutation.mutate()}
              >
                {t(['Connect Drive', 'ربط Drive'])}
              </Button>
              <Button
                variant="secondary"
                loading={testMutation.isPending}
                disabled={!canTest}
                onClick={() => testMutation.mutate()}
              >
                {t(['Test connection', 'اختبار الاتصال'])}
              </Button>
              <Button
                variant="danger"
                disabled={!canDisconnect}
                onClick={() => setDisconnectOpen(true)}
              >
                {t(['Disconnect Drive', 'فصل Drive'])}
              </Button>
            </div>
          ) : undefined
        }
      >
        {driveQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drive ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className={`rounded-xl border-2 p-4 ${connectionCardClass(drive.connected)}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t(['Connection status', 'حالة الاتصال'])}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {drive.connected
                  ? t(['Connected', 'متصل'])
                  : t(['Not connected', 'غير متصل'])}
              </p>
              {drive.connectedBy ? (
                <p className="mt-2 text-xs opacity-80">
                  {drive.connectedBy.fullName || drive.connectedBy.email}
                  {drive.connectedAt ? ` · ${formatBackupTimestamp(drive.connectedAt)}` : ''}
                </p>
              ) : null}
            </div>

            <div className={`rounded-xl border-2 p-4 ${syncStatusCardClass(syncStatusKey)}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t(['Sync status', 'حالة المزامنة'])}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {localizedGoogleDriveSyncStatus(syncStatusKey, t)}
              </p>
              {drive.pendingSyncCount > 0 || drive.failedSyncCount > 0 ? (
                <p className="mt-2 text-xs opacity-80">
                  {drive.pendingSyncCount > 0
                    ? t([
                        `${drive.pendingSyncCount} pending`,
                        `${drive.pendingSyncCount} قيد الانتظار`,
                      ])
                    : null}
                  {drive.pendingSyncCount > 0 && drive.failedSyncCount > 0 ? ' · ' : null}
                  {drive.failedSyncCount > 0
                    ? t([
                        `${drive.failedSyncCount} failed`,
                        `${drive.failedSyncCount} فاشلة`,
                      ])
                    : null}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-surface-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Last sync', 'آخر مزامنة'])}
              </p>
              <p className="mt-1 text-lg font-semibold text-text-strong">
                {formatBackupTimestamp(drive.lastSyncedAt)}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-card p-4 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Root folder', 'المجلد الجذري'])}
              </p>
              <p className="mt-1 font-semibold text-text-strong">{drive.rootFolderName}</p>
              {drive.folderId ? (
                <p className="mt-1 break-all font-mono text-xs text-text-muted">
                  {drive.folderId}
                </p>
              ) : (
                <p className="mt-1 text-sm text-text-muted">
                  {t(['Connect Drive to create the root folder.', 'اربط Drive لإنشاء المجلد الجذري.'])}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Integration', 'التكامل'])}
              </p>
              <p className="mt-1 text-sm text-text-body">
                {drive.gdriveConfigured
                  ? t(['OAuth configured', 'OAuth مُعدّ'])
                  : t(['OAuth not configured', 'OAuth غير مُعدّ'])}
              </p>
              {!drive.gdriveEnabled ? (
                <p className="mt-1 text-xs text-status-warning-fg">
                  {t([
                    'BACKUP_GDRIVE_ENABLED is false — Drive sync is disabled at runtime.',
                    'BACKUP_GDRIVE_ENABLED=false — مزامنة Drive معطّلة وقت التشغيل.',
                  ])}
                </p>
              ) : null}
            </div>
          </div>
        ) : driveQuery.isError ? (
          <p className="text-sm text-status-danger-fg">{driveQuery.error.message}</p>
        ) : null}
      </SectionContainer>

      <SectionContainer
        title={t(['Storage policy', 'سياسة التخزين'])}
        description={t([
          'Configure global and per-schedule backup storage routing on the Storage Policy page.',
          'اضبط توجيه التخزين العام ولكل جدول في صفحة سياسة التخزين.',
        ])}
      >
        <Link
          to="/settings/backups/storage-policy"
          className="inline-block text-sm font-medium text-text-link hover:underline"
        >
          {t(['Open storage policy', 'فتح سياسة التخزين'])}
        </Link>
      </SectionContainer>

      <SectionContainer title={t(['Backup sync failures', 'فشل مزامنة النسخ'])}>
        {driveQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drive && drive.syncFailures.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2">{t(['Backup', 'النسخة'])}</th>
                  <th className="px-3 py-2">{t(['Type', 'النوع'])}</th>
                  <th className="px-3 py-2">{t(['Completed', 'الإكمال'])}</th>
                  <th className="px-3 py-2">{t(['Policy', 'السياسة'])}</th>
                  <th className="px-3 py-2">{t(['Attempts', 'المحاولات'])}</th>
                  <th className="px-3 py-2">{t(['Error', 'الخطأ'])}</th>
                  <th className="px-3 py-2">{t(['Next retry', 'المحاولة التالية'])}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {drive.syncFailures.map((row) => (
                  <tr key={row.id} className="align-top text-text-body">
                    <td className="px-3 py-3 font-mono text-xs">{row.id.slice(0, 8)}…</td>
                    <td className="px-3 py-3">
                      {localizedBackupTypeLabel(row.type as BackupJobType, t)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatBackupTimestamp(row.completedAt)}
                    </td>
                    <td className="px-3 py-3">
                      {localizedBackupStoragePolicyLabel(row.storagePolicy, t)}
                    </td>
                    <td className="px-3 py-3">{row.gdriveSyncAttempts}</td>
                    <td className="max-w-xs px-3 py-3 text-xs text-status-danger-fg">
                      {row.gdriveSyncError ?? '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">
                      {formatBackupTimestamp(row.gdriveNextRetryAt)}
                    </td>
                    <td className="px-3 py-3">
                      {canMutate ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={retryingJobId === row.id && retryMutation.isPending}
                          onClick={() => retryMutation.mutate(row.id)}
                        >
                          {t(['Retry sync', 'إعادة المزامنة'])}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {t(['No failed Drive sync jobs.', 'لا توجد مهام مزامنة Drive فاشلة.'])}
          </p>
        )}
      </SectionContainer>

      {canMutate ? (
        <ConfirmModal
          open={disconnectOpen}
          title={t(['Disconnect Google Drive?', 'فصل Google Drive؟'])}
          confirmLabel={t(['Disconnect', 'فصل'])}
          cancelLabel={t(['Cancel', 'إلغاء'])}
          danger
          loading={disconnectMutation.isPending}
          onConfirm={() => disconnectMutation.mutate()}
          onClose={() => setDisconnectOpen(false)}
        >
          {t([
            'Encrypted OAuth credentials will be removed. Existing Drive backups are not deleted.',
            'ستُزال بيانات OAuth المشفّرة. لن تُحذف النسخ الموجودة على Drive.',
          ])}
        </ConfirmModal>
      ) : null}
    </div>
  );
}
