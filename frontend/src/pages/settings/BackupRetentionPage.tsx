import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  BackupsApi,
  type DriveRetentionCleanupResult,
  type RetentionCleanupResult,
} from '../../api/backups';
import { BackupDriveRetentionAuditPanel } from '../../components/backups/BackupDriveRetentionAuditPanel';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupBytes } from '../../lib/backup-display';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';

function summarizeLocalPreview(preview: RetentionCleanupResult | undefined) {
  if (!preview) {
    return { eligible: 0, protected: 0, candidates: 0, reclaimedBytes: 0 };
  }
  const eligible = preview.buckets.reduce((sum, b) => sum + b.totalEligible, 0);
  return {
    eligible,
    protected: preview.protected.length,
    candidates: preview.deletedCount,
    reclaimedBytes: preview.bytesReclaimed,
  };
}

function summarizeDrivePreview(preview: DriveRetentionCleanupResult | undefined) {
  if (!preview) {
    return { eligible: 0, protected: 0, driveCandidates: 0, jobCandidates: 0 };
  }
  const eligible = preview.buckets.reduce((sum, b) => sum + b.totalEligible, 0);
  return {
    eligible,
    protected: preview.protected.length,
    driveCandidates: preview.deletedDriveCount,
    jobCandidates: preview.deletedJobCount,
  };
}

export function BackupRetentionPage() {
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();

  const [localConfirmOpen, setLocalConfirmOpen] = useState(false);
  const [driveConfirmOpen, setDriveConfirmOpen] = useState(false);
  const [localCleanupResult, setLocalCleanupResult] = useState<RetentionCleanupResult | null>(null);
  const [driveCleanupResult, setDriveCleanupResult] = useState<DriveRetentionCleanupResult | null>(
    null,
  );

  const policiesQuery = useQuery({
    queryKey: QK.backups.retentionPolicies,
    queryFn: () => BackupsApi.getRetentionPolicies(),
    enabled: canRead,
  });

  const previewQuery = useQuery({
    queryKey: QK.backups.retentionPreview,
    queryFn: () => BackupsApi.previewRetentionCleanup(),
    enabled: canRead,
    refetchInterval: 60_000,
  });

  const drivePoliciesQuery = useQuery({
    queryKey: QK.backups.driveRetentionPolicies,
    queryFn: () => BackupsApi.getDriveRetentionPolicies(),
    enabled: canRead,
  });

  const drivePreviewQuery = useQuery({
    queryKey: QK.backups.driveRetentionPreview,
    queryFn: () => BackupsApi.previewDriveRetentionCleanup(),
    enabled: canRead,
    refetchInterval: 60_000,
  });

  const cleanupMutation = useMutation({
    mutationFn: () => BackupsApi.runRetentionCleanup(),
    onSuccess: (result) => {
      setLocalConfirmOpen(false);
      setLocalCleanupResult(result);
      toast.success(
        t([
          `Cleanup removed ${result.deletedCount} backup(s)`,
          `أزال التنظيف ${result.deletedCount} نسخة`,
        ]),
      );
      void queryClient.invalidateQueries({ queryKey: QK.backups.retentionPreview });
      void queryClient.invalidateQueries({ queryKey: QK.backups.health });
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const driveCleanupMutation = useMutation({
    mutationFn: () => BackupsApi.runDriveRetentionCleanup(),
    onSuccess: (result) => {
      setDriveConfirmOpen(false);
      setDriveCleanupResult(result);
      toast.success(
        t([
          `Drive cleanup removed ${result.deletedDriveCount} file(s) and ${result.deletedJobCount} job record(s)`,
          `أزال تنظيف Drive ${result.deletedDriveCount} ملفاً و${result.deletedJobCount} سجل مهمة`,
        ]),
      );
      void queryClient.invalidateQueries({ queryKey: QK.backups.driveRetentionPreview });
      void queryClient.invalidateQueries({ queryKey: QK.backups.driveRetentionAudit });
      void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive });
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const localPreviewSummary = useMemo(
    () => summarizeLocalPreview(previewQuery.data),
    [previewQuery.data],
  );

  const drivePreviewSummary = useMemo(
    () => summarizeDrivePreview(drivePreviewQuery.data),
    [drivePreviewQuery.data],
  );

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const policies = policiesQuery.data;
  const drivePolicies = drivePoliciesQuery.data;

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>
          {t(['Local retention policies', 'سياسات الاحتفاظ المحلية'])}
        </h2>
        {policiesQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : policies ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Daily', 'يومي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {policies.keepLastDaily}
              </dd>
              <p className="text-xs text-slate-500">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Weekly', 'أسبوعي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {policies.keepLastWeekly}
              </dd>
              <p className="text-xs text-slate-500">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Monthly', 'شهري'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {policies.keepLastMonthly}
              </dd>
              <p className="text-xs text-slate-500">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Pre-snapshot protection', 'حماية ما قبل اللقطة'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {policies.preSnapshotProtectDays}
              </dd>
              <p className="text-xs text-slate-500">{t(['days', 'أيام'])}</p>
            </div>
          </dl>
        ) : null}
        {policies ? (
          <p className="mt-3 text-xs text-slate-500">
            {t(['Automatic cleanup:', 'التنظيف التلقائي:'])}{' '}
            {policies.retentionCleanupEnabled
              ? t(['enabled', 'مفعّل'])
              : t(['disabled', 'معطّل'])}
          </p>
        ) : null}
      </section>

      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Local cleanup preview', 'معاينة التنظيف المحلي'])}</h2>
        {previewQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading preview…', 'جارٍ تحميل المعاينة…'])}</p>
        ) : (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">{t(['Eligible backups', 'نسخ مؤهلة'])}</dt>
              <dd className="mt-1 text-xl font-semibold">{localPreviewSummary.eligible}</dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <dt className="text-xs text-emerald-800">{t(['Protected backups', 'نسخ محمية'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-emerald-900">
                {localPreviewSummary.protected}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <dt className="text-xs text-amber-800">
                {t(['Deletion candidates', 'مرشّحات للحذف'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-amber-900">
                {localPreviewSummary.candidates}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">
                {t(['Estimated reclaimed', 'المساحة المقدّرة'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatBackupBytes(localPreviewSummary.reclaimedBytes)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {canMutate ? (
        <section className="rounded-xl border-2 border-rose-300 bg-rose-50/40 p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-rose-900">
            {t(['Local manual cleanup', 'تنظيف محلي يدوي'])}
          </h2>
          <p className="mt-2 text-sm text-rose-800">
            {t([
              'Permanently deletes expired local backups that are not protected. This cannot be undone.',
              'يحذف نهائياً النسخ المحلية المنتهية غير المحمية. لا يمكن التراجع.',
            ])}
          </p>
          <Button
            type="button"
            variant="danger"
            className="mt-4"
            onClick={() => setLocalConfirmOpen(true)}
          >
            {t(['Run local retention cleanup', 'تشغيل تنظيف الاحتفاظ المحلي'])}
          </Button>
        </section>
      ) : null}

      {localCleanupResult ? (
        <section className={PANEL_CARD_CLASS}>
          <h2 className={PANEL_TITLE_CLASS}>{t(['Local cleanup result', 'نتيجة التنظيف المحلي'])}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">{t(['Deleted count', 'عدد المحذوف'])}</dt>
              <dd className="text-lg font-semibold">{localCleanupResult.deletedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t(['Reclaimed bytes', 'البايتات المستردة'])}</dt>
              <dd className="text-lg font-semibold">
                {formatBackupBytes(localCleanupResult.bytesReclaimed)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>
          {t(['Google Drive retention policies', 'سياسات احتفاظ Google Drive'])}
        </h2>
        {drivePoliciesQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drivePolicies ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Daily', 'يومي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {drivePolicies.keepLastDaily}
              </dd>
              <p className="text-xs text-slate-500">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Weekly', 'أسبوعي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {drivePolicies.keepLastWeekly}
              </dd>
              <p className="text-xs text-slate-500">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(['Monthly', 'شهري'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {drivePolicies.keepLastMonthly}
              </dd>
              <p className="text-xs text-slate-500">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
          </dl>
        ) : null}
        {drivePolicies ? (
          <p className="mt-3 text-xs text-slate-500">
            {t(['Automatic Drive cleanup:', 'تنظيف Drive التلقائي:'])}{' '}
            {drivePolicies.driveRetentionCleanupEnabled
              ? t(['enabled', 'مفعّل'])
              : t(['disabled', 'معطّل'])}
          </p>
        ) : null}
      </section>

      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>
          {t(['Drive cleanup preview', 'معاينة تنظيف Drive'])}
        </h2>
        {drivePreviewQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading preview…', 'جارٍ تحميل المعاينة…'])}</p>
        ) : (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">
                {t(['Eligible synced backups', 'نسخ متزامنة مؤهلة'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold">{drivePreviewSummary.eligible}</dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <dt className="text-xs text-emerald-800">{t(['Protected backups', 'نسخ محمية'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-emerald-900">
                {drivePreviewSummary.protected}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <dt className="text-xs text-amber-800">
                {t(['Drive file deletions', 'حذف ملفات Drive'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-amber-900">
                {drivePreviewSummary.driveCandidates}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <dt className="text-xs text-amber-800">
                {t(['Drive-only job deletions', 'حذف مهام drive-only'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-amber-900">
                {drivePreviewSummary.jobCandidates}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {canMutate ? (
        <section className="rounded-xl border-2 border-rose-300 bg-rose-50/40 p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-rose-900">
            {t(['Drive manual cleanup', 'تنظيف Drive يدوي'])}
          </h2>
          <p className="mt-2 text-sm text-rose-800">
            {t([
              'Removes expired Google Drive backup files and drive-only job records. Local copies are not affected.',
              'يزيل ملفات النسخ المنتهية على Google Drive وسجلات مهام drive-only. لا يؤثر على النسخ المحلية.',
            ])}
          </p>
          <Button
            type="button"
            variant="danger"
            className="mt-4"
            onClick={() => setDriveConfirmOpen(true)}
          >
            {t(['Run Drive retention cleanup', 'تشغيل تنظيف احتفاظ Drive'])}
          </Button>
        </section>
      ) : null}

      {driveCleanupResult ? (
        <section className={PANEL_CARD_CLASS}>
          <h2 className={PANEL_TITLE_CLASS}>{t(['Drive cleanup result', 'نتيجة تنظيف Drive'])}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">
                {t(['Drive files deleted', 'ملفات Drive المحذوفة'])}
              </dt>
              <dd className="text-lg font-semibold">{driveCleanupResult.deletedDriveCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">
                {t(['Drive-only jobs deleted', 'مهام drive-only المحذوفة'])}
              </dt>
              <dd className="text-lg font-semibold">{driveCleanupResult.deletedJobCount}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <BackupDriveRetentionAuditPanel />

      {canMutate ? (
        <>
          <ConfirmModal
            open={localConfirmOpen}
            title={t(['Run local retention cleanup?', 'تشغيل تنظيف الاحتفاظ المحلي؟'])}
            confirmLabel={t(['Delete expired backups', 'حذف النسخ المنتهية'])}
            danger
            loading={cleanupMutation.isPending}
            onConfirm={() => cleanupMutation.mutate()}
            onClose={() => !cleanupMutation.isPending && setLocalConfirmOpen(false)}
          >
            {t([
              `This will delete ${localPreviewSummary.candidates} local backup(s) and reclaim approximately ${formatBackupBytes(localPreviewSummary.reclaimedBytes)}.`,
              `سيحذف هذا ${localPreviewSummary.candidates} نسخة محلية ويسترد تقريباً ${formatBackupBytes(localPreviewSummary.reclaimedBytes)}.`,
            ])}
          </ConfirmModal>

          <ConfirmModal
            open={driveConfirmOpen}
            title={t(['Run Drive retention cleanup?', 'تشغيل تنظيف احتفاظ Drive؟'])}
            confirmLabel={t(['Delete expired Drive backups', 'حذف نسخ Drive المنتهية'])}
            danger
            loading={driveCleanupMutation.isPending}
            onConfirm={() => driveCleanupMutation.mutate()}
            onClose={() => !driveCleanupMutation.isPending && setDriveConfirmOpen(false)}
          >
            {t([
              `This will delete ${drivePreviewSummary.driveCandidates} Drive file(s) and ${drivePreviewSummary.jobCandidates} drive-only job record(s).`,
              `سيحذف هذا ${drivePreviewSummary.driveCandidates} ملفاً على Drive و${drivePreviewSummary.jobCandidates} سجل مهمة drive-only.`,
            ])}
          </ConfirmModal>
        </>
      ) : null}
    </div>
  );
}
