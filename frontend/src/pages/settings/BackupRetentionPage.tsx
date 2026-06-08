import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { BackupsApi, type RetentionCleanupResult } from '../../api/backups';
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

function summarizePreview(preview: RetentionCleanupResult | undefined) {
  if (!preview) {
    return {
      eligible: 0,
      protected: 0,
      candidates: 0,
      reclaimedBytes: 0,
    };
  }
  const eligible = preview.buckets.reduce((sum, b) => sum + b.totalEligible, 0);
  return {
    eligible,
    protected: preview.protected.length,
    candidates: preview.deletedCount,
    reclaimedBytes: preview.bytesReclaimed,
  };
}

export function BackupRetentionPage() {
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<RetentionCleanupResult | null>(null);

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

  const cleanupMutation = useMutation({
    mutationFn: () => BackupsApi.runRetentionCleanup(),
    onSuccess: (result) => {
      setConfirmOpen(false);
      setCleanupResult(result);
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

  const previewSummary = useMemo(
    () => summarizePreview(previewQuery.data),
    [previewQuery.data],
  );

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const policies = policiesQuery.data;

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Retention policies', 'سياسات الاحتفاظ'])}</h2>
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
        <h2 className={PANEL_TITLE_CLASS}>{t(['Cleanup preview', 'معاينة التنظيف'])}</h2>
        {previewQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t(['Loading preview…', 'جارٍ تحميل المعاينة…'])}</p>
        ) : (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">{t(['Eligible backups', 'نسخ مؤهلة'])}</dt>
              <dd className="mt-1 text-xl font-semibold">{previewSummary.eligible}</dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <dt className="text-xs text-emerald-800">{t(['Protected backups', 'نسخ محمية'])}</dt>
              <dd className="mt-1 text-xl font-semibold text-emerald-900">
                {previewSummary.protected}
              </dd>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <dt className="text-xs text-amber-800">
                {t(['Deletion candidates', 'مرشّحات للحذف'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-amber-900">
                {previewSummary.candidates}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <dt className="text-xs text-slate-500">
                {t(['Estimated reclaimed', 'المساحة المقدّرة'])}
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {formatBackupBytes(previewSummary.reclaimedBytes)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {canMutate ? (
        <section className="rounded-xl border-2 border-rose-300 bg-rose-50/40 p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-rose-900">
            {t(['Manual cleanup', 'تنظيف يدوي'])}
          </h2>
          <p className="mt-2 text-sm text-rose-800">
            {t([
              'Permanently deletes expired backups that are not protected. This cannot be undone.',
              'يحذف نهائياً النسخ المنتهية غير المحمية. لا يمكن التراجع.',
            ])}
          </p>
          <Button
            type="button"
            variant="danger"
            className="mt-4"
            onClick={() => setConfirmOpen(true)}
          >
            {t(['Run retention cleanup', 'تشغيل تنظيف الاحتفاظ'])}
          </Button>
        </section>
      ) : null}

      {cleanupResult ? (
        <section className={PANEL_CARD_CLASS}>
          <h2 className={PANEL_TITLE_CLASS}>{t(['Cleanup result', 'نتيجة التنظيف'])}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">{t(['Deleted count', 'عدد المحذوف'])}</dt>
              <dd className="text-lg font-semibold">{cleanupResult.deletedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t(['Reclaimed bytes', 'البايتات المستردة'])}</dt>
              <dd className="text-lg font-semibold">
                {formatBackupBytes(cleanupResult.bytesReclaimed)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {canMutate ? (
        <ConfirmModal
          open={confirmOpen}
          title={t(['Run retention cleanup?', 'تشغيل تنظيف الاحتفاظ؟'])}
          confirmLabel={t(['Delete expired backups', 'حذف النسخ المنتهية'])}
          danger
          loading={cleanupMutation.isPending}
          onConfirm={() => cleanupMutation.mutate()}
          onClose={() => !cleanupMutation.isPending && setConfirmOpen(false)}
        >
          {t([
            `This will delete ${previewSummary.candidates} backup(s) and reclaim approximately ${formatBackupBytes(previewSummary.reclaimedBytes)}.`,
            `سيحذف هذا ${previewSummary.candidates} نسخة ويسترد تقريباً ${formatBackupBytes(previewSummary.reclaimedBytes)}.`,
          ])}
        </ConfirmModal>
      ) : null}
    </div>
  );
}
