import { Alert } from '@ds';

import type { BackupActiveOperation } from '../../api/backups';
import type { BackupStatus } from '../../hooks/useBackupMaintenance';
import { formatBackupBytes } from '../../lib/backup-display';
import { useWmsTranslation } from '../../lib/ui-i18n';

type Props = {
  activeOperation: BackupActiveOperation | null;
  jobStatus: BackupStatus | null;
};

export function SystemMaintenanceScreen({ activeOperation, jobStatus }: Props) {
  const { t } = useWmsTranslation();
  const progress = jobStatus?.progressPercent ?? 0;
  const reason = activeOperation?.maintenanceReason ?? 'backup_restore';

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal,60)] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="backup-maintenance-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <i className="fa-solid fa-screwdriver-wrench text-xl" aria-hidden />
        </div>

        <h1 id="backup-maintenance-title" className="text-xl font-semibold text-slate-900">
          {t(['System Maintenance In Progress', 'صيانة النظام جارية'])}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t([
            'The database is being modified. Most API operations are temporarily unavailable until this completes.',
            'يتم تعديل قاعدة البيانات. معظم عمليات API غير متاحة مؤقتاً حتى اكتمال العملية.',
          ])}
        </p>

        <Alert
          variant="warning"
          title={t(['Do not close this window', 'لا تغلق هذه النافذة'])}
          description={t([
            `Reason: ${reason}. You may need to sign in again after restore completes.`,
            `السبب: ${reason}. قد تحتاج لتسجيل الدخول مجدداً بعد اكتمال الاستعادة.`,
          ])}
          compact
          className="mt-4"
        />

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{t(['Progress', 'التقدم'])}</span>
            <span className="tabular-nums text-slate-600">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
          {jobStatus ? (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <dt className="font-medium text-slate-500">{t(['Status', 'الحالة'])}</dt>
                <dd className="mt-0.5 font-mono">{jobStatus.status}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">{t(['Bytes', 'البايتات'])}</dt>
                <dd className="mt-0.5">{formatBackupBytes(jobStatus.bytesWritten)}</dd>
              </div>
              {jobStatus.errorMessage ? (
                <div className="col-span-2 text-rose-700">{jobStatus.errorMessage}</div>
              ) : null}
            </dl>
          ) : (
            <p className="text-xs text-slate-500">
              {t(['Waiting for operation status…', 'بانتظار حالة العملية…'])}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
