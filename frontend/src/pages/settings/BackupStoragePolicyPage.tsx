import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { SectionContainer } from '@ds';

import {
  BackupsApi,
  type BackupStoragePolicyValue,
  type GoogleDriveAdminStatus,
} from '../../api/backups';
import { Button } from '../../components/Button';
import { SelectField } from '../../components/SelectField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupBytes, formatBackupTimestamp } from '../../lib/backup-display';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupStoragePolicyLabel,
  localizedBackupStoragePolicyOptions,
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

export function BackupStoragePolicyPage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled();
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();

  const [policyDraft, setPolicyDraft] = useState<BackupStoragePolicyValue>('local_only');

  const policyQuery = useQuery({
    queryKey: QK.backups.storagePolicy,
    queryFn: () => BackupsApi.getStoragePolicy(),
    enabled: canRead,
  });

  const healthQuery = useQuery({
    queryKey: QK.backups.health,
    queryFn: () => BackupsApi.getHealth(),
    enabled: canRead,
    refetchInterval: 60_000,
  });

  const driveQuery = useQuery({
    queryKey: QK.backups.googleDrive,
    queryFn: () => BackupsApi.getGoogleDriveStatus(),
    enabled: canRead && gdriveUiEnabled,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (policyQuery.data) {
      setPolicyDraft(policyQuery.data.defaultPolicy);
    }
  }, [policyQuery.data]);

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

  const policyOptions = useMemo(() => localizedBackupStoragePolicyOptions(t), [t]);
  const policyDirty =
    policyQuery.data != null && policyDraft !== policyQuery.data.defaultPolicy;
  const syncStatusKey = useMemo(() => deriveSyncStatus(driveQuery.data), [driveQuery.data]);
  const drive = driveQuery.data;

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  return (
    <div className="space-y-4">
      <SectionContainer
        title={t(['Global storage policy', 'سياسة التخزين العامة'])}
        description={t([
          'Default routing for new manual and scheduled backups when no per-schedule override is set.',
          'التوجيه الافتراضي للنسخ اليدوية والمجدولة عند عدم وجود تجاوز لكل جدول.',
        ])}
      >
        {policyQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : policyQuery.data ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem]">
              <SelectField
                label={t(['Default policy', 'السياسة الافتراضية'])}
                value={policyDraft}
                onChange={(event) =>
                  setPolicyDraft(event.target.value as BackupStoragePolicyValue)
                }
                options={policyOptions.map((o) => ({ value: o.value, label: o.label }))}
                disabled={!canMutate}
              />
            </div>
            {canMutate ? (
              <Button
                variant="brand"
                loading={policyMutation.isPending}
                disabled={!policyDirty}
                onClick={() => policyMutation.mutate(policyDraft)}
              >
                {t(['Save policy', 'حفظ السياسة'])}
              </Button>
            ) : null}
            <p className="text-xs text-text-muted">
              {t(['Effective', 'الفعّالة'])}:{' '}
              {localizedBackupStoragePolicyLabel(policyQuery.data.effectiveDefaultPolicy, t)}
              {gdriveUiEnabled &&
              !drive?.gdriveEnabled &&
              policyQuery.data.effectiveDefaultPolicy !== 'local_only'
                ? ` (${t(['falls back to local only', 'ترجع إلى محلي فقط'])})`
                : ''}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-text-muted">
          {t([
            'Per-schedule overrides are configured on the Scheduled Backups page.',
            'تُعدّ تجاوزات كل جدول في صفحة النسخ المجدول.',
          ])}{' '}
          <Link to="/settings/backups/schedules" className="font-medium text-text-link hover:underline">
            {t(['Open schedules', 'فتح الجداول'])}
          </Link>
        </p>
      </SectionContainer>

      <SectionContainer title={t(['Storage usage', 'استخدام التخزين'])}>
        {healthQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : healthQuery.data ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <dt className="text-xs text-text-muted">{t(['Local storage used', 'التخزين المحلي المستخدم'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-text-strong">
                {formatBackupBytes(healthQuery.data.storageUsedBytes)}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-4">
              <dt className="text-xs text-text-muted">{t(['Completed backups', 'النسخ المكتملة'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-text-strong">{healthQuery.data.backupCount}</dd>
            </div>
            <div className="rounded-lg border border-border p-4">
              <dt className="text-xs text-text-muted">
                {t(['Pending local deletions', 'حذف محلي معلّق'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-text-strong">
                {healthQuery.data.retentionStatus.pendingDeletionCount}
              </dd>
            </div>
          </dl>
        ) : null}
      </SectionContainer>

      {gdriveUiEnabled ? (
        <SectionContainer
          title={t(['Google Drive sync status', 'حالة مزامنة Google Drive'])}
          description={t([
            'Off-site sync health for backups routed to Google Drive.',
            'صحة المزامنة خارج الموقع للنسخ الموجّهة إلى Google Drive.',
          ])}
          actions={
            <Link
              to="/settings/backups/google-drive"
              className="text-sm font-medium text-text-link hover:underline"
            >
              {t(['Manage connection', 'إدارة الاتصال'])}
            </Link>
          }
        >
          {driveQuery.isLoading ? (
            <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
          ) : drive ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div
                className={`rounded-xl border-2 p-4 ${
                  drive.connected
                    ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
                    : 'border-border bg-surface-card-muted text-text-body'
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {t(['Connection', 'الاتصال'])}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {drive.connected ? t(['Connected', 'متصل']) : t(['Not connected', 'غير متصل'])}
                </p>
              </div>
              <div className={`rounded-xl border-2 p-4 ${syncStatusCardClass(syncStatusKey)}`}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {t(['Sync status', 'حالة المزامنة'])}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {localizedGoogleDriveSyncStatus(syncStatusKey, t)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t(['Pending syncs', 'مزامنات معلّقة'])}
                </p>
                <p className="mt-1 text-lg font-semibold text-text-strong">{drive.pendingSyncCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t(['Failed syncs', 'مزامنات فاشلة'])}
                </p>
                <p className="mt-1 text-lg font-semibold text-text-strong">{drive.failedSyncCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-card p-4 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {t(['Last sync', 'آخر مزامنة'])}
                </p>
                <p className="mt-1 text-lg font-semibold text-text-strong">
                  {formatBackupTimestamp(drive.lastSyncedAt)}
                </p>
              </div>
            </div>
          ) : driveQuery.isError ? (
            <p className="text-sm text-status-danger-fg">{driveQuery.error.message}</p>
          ) : null}
        </SectionContainer>
      ) : null}
    </div>
  );
}
