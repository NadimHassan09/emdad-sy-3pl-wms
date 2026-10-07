import { useMemo } from 'react'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import type { BackupDetail } from '@/api/backups'
import {
  backupCreatedByLabel,
  formatBackupBytes,
  formatBackupStorage,
  formatBackupStoragePolicy,
  formatBackupTimestamp,
  formatBackupType,
  formatGdriveSyncStatus,
  truncateBackupId,
} from '@/lib/backup-display'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'
import { localizedBackupDetailFieldLabels, localizedBackupStoragePolicyLabel } from '@/lib/settings-backup-labels'

type Props = {
  open: boolean
  onClose: () => void
  row: BackupDetail | null
  loading?: boolean
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 border-b py-2 text-sm last:border-0">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs sm:text-sm">{value}</dd>
    </div>
  )
}

export function BackupDetailModal({ open, onClose, row, loading }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const gdriveUiEnabled = isBackupGdriveUiEnabled()
  const fields = useMemo(() => localizedBackupDetailFieldLabels(t), [isArabic])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('Backup details', 'تفاصيل النسخة الاحتياطية')}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
        ) : !row ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('Overview', 'نظرة عامة')}
              </h3>
              <dl className="rounded-lg border bg-muted/30 px-3">
                <MetaRow label={fields.id} value={row.id} />
                <MetaRow label={fields.shortId} value={truncateBackupId(row.id)} />
                <MetaRow label={fields.type} value={formatBackupType(row.type)} />
                <MetaRow label={fields.status} value={row.status} />
                <MetaRow label={fields.label} value={row.label ?? '—'} />
                <MetaRow label={fields.created} value={formatBackupTimestamp(row.createdAt)} />
                <MetaRow label={fields.completed} value={formatBackupTimestamp(row.completedAt)} />
                <MetaRow label={fields.createdBy} value={backupCreatedByLabel(row)} />
                <MetaRow
                  label={fields.storagePolicy}
                  value={
                    row.storagePolicy
                      ? localizedBackupStoragePolicyLabel(row.storagePolicy, t)
                      : formatBackupStoragePolicy(row.storagePolicy)
                  }
                />
                <MetaRow label={fields.storage} value={formatBackupStorage(row.manifest)} />
                {gdriveUiEnabled ? (
                  <>
                    <MetaRow
                      label={fields.driveSync}
                      value={formatGdriveSyncStatus(row.gdriveSyncStatus, row.storagePolicy)}
                    />
                    <MetaRow label={fields.driveSyncedAt} value={formatBackupTimestamp(row.gdriveSyncedAt)} />
                  </>
                ) : null}
                <MetaRow label={fields.size} value={formatBackupBytes(row.bytesWritten)} />
                <MetaRow label={fields.progress} value={`${row.progressPercent}%`} />
              </dl>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('Technical', 'تقني')}
              </h3>
              <dl className="rounded-lg border bg-muted/30 px-3">
                <MetaRow label={fields.dumpFile} value={row.dumpFilename ?? '—'} />
                <MetaRow label={fields.started} value={formatBackupTimestamp(row.startedAt)} />
                <MetaRow label={fields.checksum} value={row.manifest?.checksumSha256 ?? '—'} />
                <MetaRow label={fields.db} value={row.manifest?.dbName ?? '—'} />
                <MetaRow label={fields.pgVersion} value={row.manifest?.pgVersion ?? '—'} />
              </dl>
            </section>
            {row.errorMessage ? (
              <pre className="max-h-48 overflow-auto rounded-lg border border-tone-danger-border bg-tone-danger-bg/60 p-3 text-xs text-tone-danger-fg">
                {row.errorMessage}
              </pre>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
