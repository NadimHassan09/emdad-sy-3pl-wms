import { Wrench } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import type { BackupActiveOperation } from '@/api/backups'
import type { BackupStatus } from '@/hooks/useBackupMaintenance'
import { formatBackupBytes } from '@/lib/backup-display'

type Props = {
  activeOperation: BackupActiveOperation | null
  jobStatus: BackupStatus | null
}

export function SystemMaintenanceScreen({ activeOperation, jobStatus }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const progress = jobStatus?.progressPercent ?? 0
  const reason = activeOperation?.maintenanceReason ?? 'backup_restore'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="backup-maintenance-title"
    >
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-lg">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-tone-warning-bg text-tone-warning-fg">
          <Wrench className="size-6" aria-hidden />
        </div>

        <h1 id="backup-maintenance-title" className="text-xl font-semibold">
          {t('System maintenance in progress', 'صيانة النظام جارية')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            'The database is being modified. Most API operations are temporarily unavailable until this completes.',
            'يتم تعديل قاعدة البيانات. معظم عمليات API غير متاحة مؤقتاً حتى اكتمال العملية.',
          )}
        </p>

        <Alert className="mt-4 border-tone-warning-border bg-tone-warning-bg">
          <AlertTitle>{t('Do not close this window', 'لا تغلق هذه النافذة')}</AlertTitle>
          <AlertDescription>
            {t(
              `Reason: ${reason}. You may need to sign in again after restore completes.`,
              `السبب: ${reason}. قد تحتاج لتسجيل الدخول مجدداً بعد اكتمال الاستعادة.`,
            )}
          </AlertDescription>
        </Alert>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t('Progress', 'التقدم')}</span>
            <span className="tabular-nums text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-tone-warning-dot transition-all duration-500"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
          {jobStatus ? (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="font-medium text-muted-foreground">{t('Status', 'الحالة')}</dt>
                <dd className="mt-0.5 font-mono">{jobStatus.status}</dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">{t('Bytes', 'البايتات')}</dt>
                <dd className="mt-0.5">{formatBackupBytes(jobStatus.bytesWritten)}</dd>
              </div>
              {jobStatus.errorMessage ? (
                <div className="col-span-2 text-tone-danger-fg">{jobStatus.errorMessage}</div>
              ) : null}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('Waiting for operation status…', 'بانتظار حالة العملية…')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
