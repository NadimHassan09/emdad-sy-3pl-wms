import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import {
  BackupsApi,
  type BackupStoragePolicyValue,
  type GoogleDriveAdminStatus,
} from '../../api/backups';
import { Button } from '../../components/Button';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupBytes, formatBackupTimestamp } from '../../lib/backup-display';
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

export function BackupStoragePolicyPage() {
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
    enabled: canRead,
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
      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Global storage policy', 'سياسة التخزين العامة'])}</h2>
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
            <p className="text-xs text-slate-500">
              {t(['Effective', 'الفعّالة'])}:{' '}
              {localizedBackupStoragePolicyLabel(policyQuery.data.effectiveDefaultPolicy, t)}
              {!drive?.gdriveEnabled && policyQuery.data.effectiveDefaultPolicy !== 'local_only'
                ? ` (${t(['falls back to local only', 'ترجع إلى محلي فقط'])})`
                : ''}
            </p>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          {t([
            'Per-schedule overrides are configured on the Scheduled Backups page.',
            'تُعدّ تجاوزات كل جدول في صفحة النسخ المجدول.',
          ])}{' '}
          <Link to="/settings/backups/schedules" className="font-medium text-emerald-700 hover:underline">
            {t(['Open schedules', 'فتح الجداول'])}
          </Link>
        </p>
      </section>

      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Storage usage', 'استخدام التخزين'])}</h2>
        {healthQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : healthQuery.data ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">{t(['Local storage used', 'التخزين المحلي المستخدم'])}</dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatBackupBytes(healthQuery.data.storageUsedBytes)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">{t(['Completed backups', 'النسخ المكتملة'])}</dt>
              <dd className="mt-1 text-xl font-semibold">{healthQuery.data.backupCount}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">
                {t(['Pending local deletions', 'حذف محلي معلّق'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {healthQuery.data.retentionStatus.pendingDeletionCount}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className={PANEL_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={PANEL_TITLE_CLASS}>{t(['Google Drive sync status', 'حالة مزامنة Google Drive'])}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t([
                'Off-site sync health for backups routed to Google Drive.',
                'صحة المزامنة خارج الموقع للنسخ الموجّهة إلى Google Drive.',
              ])}
            </p>
          </div>
          <Link
            to="/settings/backups/google-drive"
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            {t(['Manage connection', 'إدارة الاتصال'])}
          </Link>
        </div>
        {driveQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drive ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`rounded-xl border-2 p-4 ${
                drive.connected
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-300 bg-slate-50 text-slate-700'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t(['Connection', 'الاتصال'])}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {drive.connected ? t(['Connected', 'متصل']) : t(['Not connected', 'غير متصل'])}
              </p>
            </div>
            <div className={`rounded-xl border-2 p-4 ${syncStatusBadgeClass(syncStatusKey)}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t(['Sync status', 'حالة المزامنة'])}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {localizedGoogleDriveSyncStatus(syncStatusKey, t)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Pending syncs', 'مزامنات معلّقة'])}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{drive.pendingSyncCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Failed syncs', 'مزامنات فاشلة'])}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{drive.failedSyncCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Last sync', 'آخر مزامنة'])}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatBackupTimestamp(drive.lastSyncedAt)}
              </p>
            </div>
          </div>
        ) : driveQuery.isError ? (
          <p className="mt-4 text-sm text-rose-600">{driveQuery.error.message}</p>
        ) : null}
      </section>
    </div>
  );
}
