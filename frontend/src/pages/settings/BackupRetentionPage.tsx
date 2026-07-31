import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, SectionContainer } from '@ds';

import {
  BackupsApi,
  type DriveRetentionCleanupResult,
  type RetentionCleanupResult,
} from '../../api/backups';
import { BackupDriveRetentionAuditPanel } from '../../components/backups/BackupDriveRetentionAuditPanel';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupBytes } from '../../lib/backup-display';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
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

const STAT_CARD = 'rounded-lg border border-border p-4';
const STAT_CARD_MUTED = 'rounded-lg border border-border bg-surface-card-muted p-4';
const STAT_CARD_SUCCESS = 'rounded-lg border border-status-success-border bg-status-success-bg/40 p-4';
const STAT_CARD_WARNING = 'rounded-lg border border-status-warning-border bg-status-warning-bg/40 p-4';

export function BackupRetentionPage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled();
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
    enabled: canRead && gdriveUiEnabled,
  });

  const drivePreviewQuery = useQuery({
    queryKey: QK.backups.driveRetentionPreview,
    queryFn: () => BackupsApi.previewDriveRetentionCleanup(),
    enabled: canRead && gdriveUiEnabled,
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
      <SectionContainer title={t(['Local retention policies', 'سياسات الاحتفاظ المحلية'])}>
        {policiesQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : policies ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Daily', 'يومي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {policies.keepLastDaily}
              </dd>
              <p className="text-xs text-text-muted">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Weekly', 'أسبوعي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {policies.keepLastWeekly}
              </dd>
              <p className="text-xs text-text-muted">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Monthly', 'شهري'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {policies.keepLastMonthly}
              </dd>
              <p className="text-xs text-text-muted">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Pre-snapshot protection', 'حماية ما قبل اللقطة'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {policies.preSnapshotProtectDays}
              </dd>
              <p className="text-xs text-text-muted">{t(['days', 'أيام'])}</p>
            </div>
          </dl>
        ) : null}
        {policies ? (
          <p className="text-xs text-text-muted">
            {t(['Automatic cleanup:', 'التنظيف التلقائي:'])}{' '}
            {policies.retentionCleanupEnabled
              ? t(['enabled', 'مفعّل'])
              : t(['disabled', 'معطّل'])}
          </p>
        ) : null}
      </SectionContainer>

      <SectionContainer title={t(['Local cleanup preview', 'معاينة التنظيف المحلي'])}>
        {previewQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading preview…', 'جارٍ تحميل المعاينة…'])}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={STAT_CARD}>
              <dt className="text-xs text-text-muted">{t(['Eligible backups', 'نسخ مؤهلة'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-text-strong">{localPreviewSummary.eligible}</dd>
            </div>
            <div className={STAT_CARD_SUCCESS}>
              <dt className="text-xs text-status-success-fg">{t(['Protected backups', 'نسخ محمية'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-status-success-fg">
                {localPreviewSummary.protected}
              </dd>
            </div>
            <div className={STAT_CARD_WARNING}>
              <dt className="text-xs text-status-warning-fg">
                {t(['Deletion candidates', 'مرشّحات للحذف'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-status-warning-fg">
                {localPreviewSummary.candidates}
              </dd>
            </div>
            <div className={STAT_CARD}>
              <dt className="text-xs text-text-muted">
                {t(['Estimated reclaimed', 'المساحة المقدّرة'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-text-strong">
                {formatBackupBytes(localPreviewSummary.reclaimedBytes)}
              </dd>
            </div>
          </dl>
        )}
      </SectionContainer>

      {canMutate ? (
        <SectionContainer title={t(['Local manual cleanup', 'تنظيف محلي يدوي'])}>
          <Alert
            variant="error"
            description={t([
              'Permanently deletes expired local backups that are not protected. This cannot be undone.',
              'يحذف نهائياً النسخ المحلية المنتهية غير المحمية. لا يمكن التراجع.',
            ])}
            action={
              <Button
                type="button"
                variant="danger"
                onClick={() => setLocalConfirmOpen(true)}
              >
                {t(['Run local retention cleanup', 'تشغيل تنظيف الاحتفاظ المحلي'])}
              </Button>
            }
          />
        </SectionContainer>
      ) : null}

      {localCleanupResult ? (
        <SectionContainer title={t(['Local cleanup result', 'نتيجة التنظيف المحلي'])}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">{t(['Deleted count', 'عدد المحذوف'])}</dt>
              <dd className="text-lg font-semibold text-text-strong">{localCleanupResult.deletedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">{t(['Reclaimed bytes', 'البايتات المستردة'])}</dt>
              <dd className="text-lg font-semibold text-text-strong">
                {formatBackupBytes(localCleanupResult.bytesReclaimed)}
              </dd>
            </div>
          </dl>
        </SectionContainer>
      ) : null}

      {gdriveUiEnabled ? (
      <>
      <SectionContainer title={t(['Google Drive retention policies', 'سياسات احتفاظ Google Drive'])}>
        {drivePoliciesQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : drivePolicies ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Daily', 'يومي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {drivePolicies.keepLastDaily}
              </dd>
              <p className="text-xs text-text-muted">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Weekly', 'أسبوعي'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {drivePolicies.keepLastWeekly}
              </dd>
              <p className="text-xs text-text-muted">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
            <div className={STAT_CARD_MUTED}>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(['Monthly', 'شهري'])}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-text-strong">
                {drivePolicies.keepLastMonthly}
              </dd>
              <p className="text-xs text-text-muted">{t(['keep last', 'الاحتفاظ بآخر'])}</p>
            </div>
          </dl>
        ) : null}
        {drivePolicies ? (
          <p className="text-xs text-text-muted">
            {t(['Automatic Drive cleanup:', 'تنظيف Drive التلقائي:'])}{' '}
            {drivePolicies.driveRetentionCleanupEnabled
              ? t(['enabled', 'مفعّل'])
              : t(['disabled', 'معطّل'])}
          </p>
        ) : null}
      </SectionContainer>

      <SectionContainer title={t(['Drive cleanup preview', 'معاينة تنظيف Drive'])}>
        {drivePreviewQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading preview…', 'جارٍ تحميل المعاينة…'])}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={STAT_CARD}>
              <dt className="text-xs text-text-muted">
                {t(['Eligible synced backups', 'نسخ متزامنة مؤهلة'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-text-strong">{drivePreviewSummary.eligible}</dd>
            </div>
            <div className={STAT_CARD_SUCCESS}>
              <dt className="text-xs text-status-success-fg">{t(['Protected backups', 'نسخ محمية'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-status-success-fg">
                {drivePreviewSummary.protected}
              </dd>
            </div>
            <div className={STAT_CARD_WARNING}>
              <dt className="text-xs text-status-warning-fg">
                {t(['Drive file deletions', 'حذف ملفات Drive'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-status-warning-fg">
                {drivePreviewSummary.driveCandidates}
              </dd>
            </div>
            <div className={STAT_CARD_WARNING}>
              <dt className="text-xs text-status-warning-fg">
                {t(['Drive-only job deletions', 'حذف مهام drive-only'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-status-warning-fg">
                {drivePreviewSummary.jobCandidates}
              </dd>
            </div>
          </dl>
        )}
      </SectionContainer>

      {canMutate ? (
        <SectionContainer title={t(['Drive manual cleanup', 'تنظيف Drive يدوي'])}>
          <Alert
            variant="error"
            description={t([
              'Removes expired Google Drive backup files and drive-only job records. Local copies are not affected.',
              'يزيل ملفات النسخ المنتهية على Google Drive وسجلات مهام drive-only. لا يؤثر على النسخ المحلية.',
            ])}
            action={
              <Button
                type="button"
                variant="danger"
                onClick={() => setDriveConfirmOpen(true)}
              >
                {t(['Run Drive retention cleanup', 'تشغيل تنظيف احتفاظ Drive'])}
              </Button>
            }
          />
        </SectionContainer>
      ) : null}

      {driveCleanupResult ? (
        <SectionContainer title={t(['Drive cleanup result', 'نتيجة تنظيف Drive'])}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-muted">
                {t(['Drive files deleted', 'ملفات Drive المحذوفة'])}
              </dt>
              <dd className="text-lg font-semibold text-text-strong">{driveCleanupResult.deletedDriveCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">
                {t(['Drive-only jobs deleted', 'مهام drive-only المحذوفة'])}
              </dt>
              <dd className="text-lg font-semibold text-text-strong">{driveCleanupResult.deletedJobCount}</dd>
            </div>
          </dl>
        </SectionContainer>
      ) : null}

      <BackupDriveRetentionAuditPanel />
      </>
      ) : null}

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

          {gdriveUiEnabled ? (
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}
