import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { BackupsApi } from '@/api/backups'
import { QK } from '@/constants/query-keys'
import {
  backupCreatedByLabel,
  formatBackupBytes,
  formatBackupTimestamp,
  formatBackupType,
} from '@/lib/backup-display'
import { useBackupOperationContext } from '../BackupOperationContext'

const RESTORE_PHRASE = 'RESTORE'

type Props = {
  open: boolean
  onClose: () => void
}

export function BackupRestoreModal({ open, onClose }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const { setTrackedJobId } = useBackupOperationContext()

  const [selectedId, setSelectedId] = useState('')
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [createPreSnapshot, setCreatePreSnapshot] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const restorableQuery = useQuery({
    queryKey: QK.backups.restorable,
    queryFn: () => BackupsApi.listRestorable(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setSelectedId('')
      setConfirmPhrase('')
      setCreatePreSnapshot(true)
      setConfirmOpen(false)
    }
  }, [open])

  const options = useMemo(
    () =>
      (restorableQuery.data ?? []).map((row) => ({
        value: row.id,
        label: `${formatBackupType(row.type)} · ${formatBackupBytes(row.bytesWritten)} · ${formatBackupTimestamp(row.createdAt)} · ${backupCreatedByLabel(row)}`,
      })),
    [restorableQuery.data],
  )

  const selected = restorableQuery.data?.find((r) => r.id === selectedId) ?? null

  const restoreMutation = useMutation({
    mutationFn: () =>
      BackupsApi.restore(selectedId, {
        confirmPhrase: RESTORE_PHRASE,
        createPreSnapshot,
      }),
    onSuccess: (result) => {
      setTrackedJobId(result.restoreJobId)
      setConfirmOpen(false)
      setConfirmPhrase('')
      toast.success(t('Restore started', 'بدأت الاستعادة'))
      void queryClient.invalidateQueries({ queryKey: QK.backups.all })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const phraseOk = confirmPhrase.trim() === RESTORE_PHRASE
  const busy = restoreMutation.isPending

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy && !confirmOpen && !o) onClose()
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Restore backup', 'استعادة نسخة احتياطية')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTitle>{t('Warnings', 'تحذيرات')}</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                  <li>
                    {t(
                      'This replaces the entire database with the selected backup.',
                      'يستبدل هذا قاعدة البيانات بالكامل بالنسخة المختارة.',
                    )}
                  </li>
                  <li>
                    {t(
                      'All users will be signed out when restore completes.',
                      'سيتم تسجيل خروج جميع المستخدمين عند اكتمال الاستعادة.',
                    )}
                  </li>
                  <li>
                    {t(
                      'The system enters maintenance mode during restore.',
                      'يدخل النظام وضع الصيانة أثناء الاستعادة.',
                    )}
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>{t('Select backup', 'اختر النسخة')}</Label>
              <Select value={selectedId} onValueChange={setSelectedId} disabled={restorableQuery.isLoading || busy}>
                <SelectTrigger>
                  <SelectValue placeholder={t('Choose a backup…', 'اختر نسخة…')} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={createPreSnapshot}
                onCheckedChange={(v) => setCreatePreSnapshot(v === true)}
                disabled={busy}
              />
              {t('Create pre-restore snapshot', 'إنشاء لقطة قبل الاستعادة')}
            </label>

            {selected ? (
              <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{t('Label', 'التسمية')}</dt>
                  <dd className="font-mono">{selected.label ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">SHA-256</dt>
                  <dd className="break-all font-mono">{selected.manifest?.checksumSha256 ?? '—'}</dd>
                </div>
              </dl>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="restore-phrase">{t(`Type ${RESTORE_PHRASE} to confirm`, `اكتب ${RESTORE_PHRASE} للتأكيد`)}</Label>
              <Input
                id="restore-phrase"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder={RESTORE_PHRASE}
                autoComplete="off"
                disabled={busy}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!selectedId || !phraseOk || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {t('Restore database', 'استعادة قاعدة البيانات')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        intent="danger"
        title={t('Confirm database restore', 'تأكيد استعادة قاعدة البيانات')}
        description={t(
          `You are about to restore from backup ${selectedId}. This cannot be undone without a pre-snapshot.`,
          `أنت على وشك الاستعادة من النسخة ${selectedId}. لا يمكن التراجع إلا عبر اللقطة السابقة.`,
        )}
        loading={busy}
        confirmLabel={t('Start restore', 'بدء الاستعادة')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => restoreMutation.mutate()}
      />
    </>
  )
}
