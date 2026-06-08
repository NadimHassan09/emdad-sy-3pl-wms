import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import {
  BackupsApi,
  type BackupJobType,
  type BackupStoragePolicyValue,
  type GoogleDriveAdminStatus,
} from '../../api/backups';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { formatBackupTimestamp } from '../../lib/backup-display';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupStoragePolicyLabel,
  localizedBackupStoragePolicyOptions,
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

function connectionBadgeClass(connected: boolean): string {
  return connected
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
    : 'border-slate-300 bg-slate-50 text-slate-700';
}

function syncStatusBadgeClass(key: DriveSyncStatusKey): string {
  switch (key) {
    case 'healthy':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'pending':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'failed':
      return 'border-rose-300 bg-rose-50 text-rose-900';
    case 'disabled':
      return 'border-slate-300 bg-slate-100 text-slate-600';
    default:
      return 'border-slate-300 bg-white text-slate-800';
  }
}

export function BackupGoogleDrivePage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [policyDraft, setPolicyDraft] = useState<BackupStoragePolicyValue>('local_only');

  const driveQuery = useQuery({
    queryKey: QK.backups.googleDrive,
    queryFn: () => BackupsApi.getGoogleDriveStatus(),
    enabled: user?.role === 'super_admin',
    refetchInterval: 30_000,
  });

  const policyQuery = useQuery({
    queryKey: QK.backups.storagePolicy,
    queryFn: () => BackupsApi.getStoragePolicy(),
    enabled: user?.role === 'super_admin',
  });

  useEffect(() => {
    if (policyQuery.data) {
      setPolicyDraft(policyQuery.data.defaultPolicy);
    }
  }, [policyQuery.data]);

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

  const policyMutation = useMutation({
    mutationFn: (defaultPolicy: BackupStoragePolicyValue) =>
      BackupsApi.updateStoragePolicy(defaultPolicy),
    onSuccess: (result) => {
      setPolicyDraft(result.defaultPolicy);
      toast.success(t(['Storage policy updated.', 'تم تحديث سياسة التخزين.']));
      void queryClient.invalidateQueries({ queryKey: QK.backups.storagePolicy });
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
  const policyOptions = useMemo(() => localizedBackupStoragePolicyOptions(t), [t]);
  const policyDirty =
    policyQuery.data != null && policyDraft !== policyQuery.data.defaultPolicy;

  if (user?.role !== 'super_admin') {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const drive = driveQuery.data;
  const canConnect = drive?.gdriveConfigured && !drive.connected;
  const canDisconnect = drive?.connected;
  const canTest = drive?.connected;

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={PANEL_TITLE_CLASS}>Google Drive</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t([
                'Connect encrypted backup storage to Google Drive. OAuth credentials are stored encrypted at rest.',
                'ربط التخزين الاحتياطي المشفّر بـ Google Drive. تُخزَّن بيانات OAuth مشفّرة.',
              ])}
            </p>
          </div>
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
        </div>

        {driveQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drive ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              className={`rounded-xl border-2 p-4 ${connectionBadgeClass(drive.connected)}`}
            >
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

            <div className={`rounded-xl border-2 p-4 ${syncStatusBadgeClass(syncStatusKey)}`}>
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

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Last sync', 'آخر مزامنة'])}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatBackupTimestamp(drive.lastSyncedAt)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Root folder', 'المجلد الجذري'])}
              </p>
              <p className="mt-1 font-semibold text-slate-900">{drive.rootFolderName}</p>
              {drive.folderId ? (
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {drive.folderId}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  {t(['Connect Drive to create the root folder.', 'اربط Drive لإنشاء المجلد الجذري.'])}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Integration', 'التكامل'])}
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {drive.gdriveConfigured
                  ? t(['OAuth configured', 'OAuth مُعدّ'])
                  : t(['OAuth not configured', 'OAuth غير مُعدّ'])}
              </p>
              {!drive.gdriveEnabled ? (
                <p className="mt-1 text-xs text-amber-700">
                  {t([
                    'BACKUP_GDRIVE_ENABLED is false — Drive sync is disabled at runtime.',
                    'BACKUP_GDRIVE_ENABLED=false — مزامنة Drive معطّلة وقت التشغيل.',
                  ])}
                </p>
              ) : null}
            </div>
          </div>
        ) : driveQuery.isError ? (
          <p className="mt-4 text-sm text-rose-600">{driveQuery.error.message}</p>
        ) : null}
      </section>

      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Storage policy', 'سياسة التخزين'])}</h2>
        <p className="text-sm text-slate-600">
          {t([
            'Default routing for new manual and scheduled backups when no per-schedule override is set.',
            'التوجيه الافتراضي للنسخ اليدوية والمجدولة عند عدم وجود تجاوز لكل جدول.',
          ])}
        </p>
        {policyQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : policyQuery.data ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem]">
              <SelectField
                label={t(['Default policy', 'السياسة الافتراضية'])}
                value={policyDraft}
                onChange={(event) =>
                  setPolicyDraft(event.target.value as BackupStoragePolicyValue)
                }
                options={policyOptions.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
            <Button
              variant="brand"
              loading={policyMutation.isPending}
              disabled={!policyDirty}
              onClick={() => policyMutation.mutate(policyDraft)}
            >
              {t(['Save policy', 'حفظ السياسة'])}
            </Button>
            <p className="text-xs text-slate-500">
              {t(['Effective', 'الفعّالة'])}:{' '}
              {localizedBackupStoragePolicyLabel(policyQuery.data.effectiveDefaultPolicy, t)}
              {!drive?.gdriveEnabled &&
              policyQuery.data.effectiveDefaultPolicy !== 'local_only'
                ? ` (${t(['falls back to local only', 'ترجع إلى محلي فقط'])})`
                : ''}
            </p>
          </div>
        ) : null}
      </section>

      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>
          {t(['Backup sync failures', 'فشل مزامنة النسخ'])}
        </h2>
        {driveQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drive && drive.syncFailures.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wide text-slate-500">
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
              <tbody className="divide-y divide-slate-100">
                {drive.syncFailures.map((row) => (
                  <tr key={row.id} className="align-top text-slate-800">
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
                    <td className="max-w-xs px-3 py-3 text-xs text-rose-700">
                      {row.gdriveSyncError ?? '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">
                      {formatBackupTimestamp(row.gdriveNextRetryAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={retryingJobId === row.id && retryMutation.isPending}
                        onClick={() => retryMutation.mutate(row.id)}
                      >
                        {t(['Retry sync', 'إعادة المزامنة'])}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {t(['No failed Drive sync jobs.', 'لا توجد مهام مزامنة Drive فاشلة.'])}
          </p>
        )}
      </section>

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
    </div>
  );
}
