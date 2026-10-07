import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, Widget } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { toast } from 'sonner'
import {
  BackupsApi,
  type DriveRetentionCleanupResult,
  type RetentionCleanupResult,
} from '@/api/backups'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useBackupAdminAccess } from '@/hooks/useBackupAdminAccess'
import { formatBackupBytes } from '@/lib/backup-display'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'
import { defaultHomePath } from '@/lib/rbac'
import { BackupsLayout } from './BackupsLayout'
import { BackupDriveRetentionAuditPanel } from './components/BackupDriveRetentionAuditPanel'

function summarizeLocalPreview(preview: RetentionCleanupResult | undefined) {
  if (!preview) return { eligible: 0, protected: 0, candidates: 0, reclaimedBytes: 0 }
  const eligible = preview.buckets.reduce((sum, b) => sum + b.totalEligible, 0)
  return {
    eligible,
    protected: preview.protected.length,
    candidates: preview.deletedCount,
    reclaimedBytes: preview.bytesReclaimed,
  }
}

function summarizeDrivePreview(preview: DriveRetentionCleanupResult | undefined) {
  if (!preview) return { eligible: 0, protected: 0, driveCandidates: 0, jobCandidates: 0 }
  const eligible = preview.buckets.reduce((sum, b) => sum + b.totalEligible, 0)
  return {
    eligible,
    protected: preview.protected.length,
    driveCandidates: preview.deletedDriveCount,
    jobCandidates: preview.deletedJobCount,
  }
}

export function BackupRetentionPage() {
  const gdriveUiEnabled = isBackupGdriveUiEnabled()
  const { user } = useAuth()
  const { canRead, canMutate } = useBackupAdminAccess()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()

  const [localConfirmOpen, setLocalConfirmOpen] = useState(false)
  const [driveConfirmOpen, setDriveConfirmOpen] = useState(false)
  const [localCleanupResult, setLocalCleanupResult] = useState<RetentionCleanupResult | null>(null)
  const [driveCleanupResult, setDriveCleanupResult] = useState<DriveRetentionCleanupResult | null>(null)

  const policiesQuery = useQuery({
    queryKey: QK.backups.retentionPolicies,
    queryFn: () => BackupsApi.getRetentionPolicies(),
    enabled: canRead,
  })

  const previewQuery = useQuery({
    queryKey: QK.backups.retentionPreview,
    queryFn: () => BackupsApi.previewRetentionCleanup(),
    enabled: canRead,
    refetchInterval: 60_000,
  })

  const drivePoliciesQuery = useQuery({
    queryKey: QK.backups.driveRetentionPolicies,
    queryFn: () => BackupsApi.getDriveRetentionPolicies(),
    enabled: canRead && gdriveUiEnabled,
  })

  const drivePreviewQuery = useQuery({
    queryKey: QK.backups.driveRetentionPreview,
    queryFn: () => BackupsApi.previewDriveRetentionCleanup(),
    enabled: canRead && gdriveUiEnabled,
    refetchInterval: 60_000,
  })

  const cleanupMutation = useMutation({
    mutationFn: () => BackupsApi.runRetentionCleanup(),
    onSuccess: (result) => {
      setLocalConfirmOpen(false)
      setLocalCleanupResult(result)
      toast.success(t(`Cleanup removed ${result.deletedCount} backup(s)`, `أزال التنظيف ${result.deletedCount} نسخة`))
      void queryClient.invalidateQueries({ queryKey: QK.backups.retentionPreview })
      void queryClient.invalidateQueries({ queryKey: QK.backups.health })
      void queryClient.invalidateQueries({ queryKey: QK.backups.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const driveCleanupMutation = useMutation({
    mutationFn: () => BackupsApi.runDriveRetentionCleanup(),
    onSuccess: (result) => {
      setDriveConfirmOpen(false)
      setDriveCleanupResult(result)
      toast.success(
        t(
          `Drive cleanup removed ${result.deletedDriveCount} file(s)`,
          `أزال تنظيف Drive ${result.deletedDriveCount} ملفاً`,
        ),
      )
      void queryClient.invalidateQueries({ queryKey: QK.backups.driveRetentionPreview })
      void queryClient.invalidateQueries({ queryKey: QK.backups.driveRetentionAudit })
      void queryClient.invalidateQueries({ queryKey: QK.backups.googleDrive })
      void queryClient.invalidateQueries({ queryKey: QK.backups.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const localPreviewSummary = useMemo(() => summarizeLocalPreview(previewQuery.data), [previewQuery.data])
  const drivePreviewSummary = useMemo(() => summarizeDrivePreview(drivePreviewQuery.data), [drivePreviewQuery.data])

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />
  }

  const policies = policiesQuery.data
  const drivePolicies = drivePoliciesQuery.data

  return (
    <BackupsLayout>
      <Widget title={t('Local retention policies', 'سياسات الاحتفاظ المحلية')}>
        {policiesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
        ) : policies ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('Daily', 'يومي')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{policies.keepLastDaily}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('Weekly', 'أسبوعي')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{policies.keepLastWeekly}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">{t('Monthly', 'شهري')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{policies.keepLastMonthly}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs font-medium uppercase text-muted-foreground">
                {t('Pre-snapshot protection', 'حماية ما قبل اللقطة')}
              </dt>
              <dd className="mt-1 text-2xl font-semibold">{policies.preSnapshotProtectDays}</dd>
            </div>
          </dl>
        ) : null}
      </Widget>

      <Widget title={t('Local cleanup preview', 'معاينة التنظيف المحلي')}>
        {previewQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading preview…', 'جارٍ تحميل المعاينة…')}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">{t('Eligible backups', 'نسخ مؤهلة')}</dt>
              <dd className="mt-1 text-xl font-semibold">{localPreviewSummary.eligible}</dd>
            </div>
            <div className="rounded-lg border border-tone-success-border bg-tone-success-bg/40 p-4">
              <dt className="text-xs">{t('Protected backups', 'نسخ محمية')}</dt>
              <dd className="mt-1 text-xl font-semibold">{localPreviewSummary.protected}</dd>
            </div>
            <div className="rounded-lg border border-tone-warning-border bg-tone-warning-bg/40 p-4">
              <dt className="text-xs">{t('Deletion candidates', 'مرشّحات للحذف')}</dt>
              <dd className="mt-1 text-xl font-semibold">{localPreviewSummary.candidates}</dd>
            </div>
            <div className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">{t('Estimated reclaimed', 'المساحة المقدّرة')}</dt>
              <dd className="mt-1 text-xl font-semibold">{formatBackupBytes(localPreviewSummary.reclaimedBytes)}</dd>
            </div>
          </dl>
        )}
      </Widget>

      {canMutate ? (
        <Widget title={t('Local manual cleanup', 'تنظيف محلي يدوي')}>
          <Alert variant="destructive">
            <AlertDescription>
              {t(
                'Permanently deletes expired local backups that are not protected. This cannot be undone.',
                'يحذف نهائياً النسخ المحلية المنتهية غير المحمية. لا يمكن التراجع.',
              )}
            </AlertDescription>
          </Alert>
          <Button type="button" variant="destructive" className="mt-4" onClick={() => setLocalConfirmOpen(true)}>
            {t('Run local retention cleanup', 'تشغيل تنظيف الاحتفاظ المحلي')}
          </Button>
        </Widget>
      ) : null}

      {localCleanupResult ? (
        <Widget title={t('Local cleanup result', 'نتيجة التنظيف المحلي')}>
          <p className="text-sm">
            {t('Deleted', 'محذوف')}: {localCleanupResult.deletedCount} ·{' '}
            {formatBackupBytes(localCleanupResult.bytesReclaimed)}
          </p>
        </Widget>
      ) : null}

      {gdriveUiEnabled && drivePolicies ? (
        <Widget title={t('Google Drive retention policies', 'سياسات احتفاظ Google Drive')}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs text-muted-foreground">{t('Daily', 'يومي')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{drivePolicies.keepLastDaily}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs text-muted-foreground">{t('Weekly', 'أسبوعي')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{drivePolicies.keepLastWeekly}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <dt className="text-xs text-muted-foreground">{t('Monthly', 'شهري')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{drivePolicies.keepLastMonthly}</dd>
            </div>
          </dl>
        </Widget>
      ) : null}

      {gdriveUiEnabled ? (
        <Widget title={t('Drive cleanup preview', 'معاينة تنظيف Drive')}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">{t('Eligible synced backups', 'نسخ متزامنة مؤهلة')}</dt>
              <dd className="mt-1 text-xl font-semibold">{drivePreviewSummary.eligible}</dd>
            </div>
            <div className="rounded-lg border p-4">
              <dt className="text-xs text-muted-foreground">{t('Drive file candidates', 'ملفات مرشّحة')}</dt>
              <dd className="mt-1 text-xl font-semibold">{drivePreviewSummary.driveCandidates}</dd>
            </div>
          </dl>
          {canMutate ? (
            <Button type="button" variant="destructive" className="mt-4" onClick={() => setDriveConfirmOpen(true)}>
              {t('Run Drive retention cleanup', 'تشغيل تنظيف احتفاظ Drive')}
            </Button>
          ) : null}
        </Widget>
      ) : null}

      {driveCleanupResult ? (
        <Widget title={t('Drive cleanup result', 'نتيجة تنظيف Drive')}>
          <p className="text-sm">
            {t('Deleted files', 'ملفات محذوفة')}: {driveCleanupResult.deletedDriveCount}
          </p>
        </Widget>
      ) : null}

      {gdriveUiEnabled ? <BackupDriveRetentionAuditPanel /> : null}

      <ConfirmDialog
        open={localConfirmOpen}
        onOpenChange={setLocalConfirmOpen}
        intent="danger"
        title={t('Delete expired backups', 'حذف النسخ المنتهية')}
        description={t(
          'This permanently deletes eligible local backups. Protected snapshots are kept.',
          'يحذف هذا النسخ المحلية المؤهلة نهائياً. تُحفظ اللقطات المحمية.',
        )}
        loading={cleanupMutation.isPending}
        confirmLabel={t('Delete expired backups', 'حذف النسخ المنتهية')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => cleanupMutation.mutate()}
      />

      <ConfirmDialog
        open={driveConfirmOpen}
        onOpenChange={setDriveConfirmOpen}
        intent="danger"
        title={t('Delete expired Drive backups', 'حذف نسخ Drive المنتهية')}
        description={t(
          'Removes expired synced files from Google Drive and related job metadata.',
          'يزيل الملفات المتزامنة المنتهية من Google Drive وبيانات المهام ذات الصلة.',
        )}
        loading={driveCleanupMutation.isPending}
        confirmLabel={t('Delete expired Drive backups', 'حذف نسخ Drive المنتهية')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => driveCleanupMutation.mutate()}
      />
    </BackupsLayout>
  )
}
