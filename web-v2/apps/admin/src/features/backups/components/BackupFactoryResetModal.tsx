import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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
import { toast } from 'sonner'
import { BackupsApi } from '@/api/backups'
import { QK } from '@/constants/query-keys'
import { useBackupOperationContext } from '../BackupOperationContext'

const FACTORY_RESET_PHRASE = 'FACTORY RESET'

type Props = {
  open: boolean
  onClose: () => void
}

export function BackupFactoryResetModal({ open, onClose }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const { setTrackedJobId } = useBackupOperationContext()

  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [createPreSnapshot, setCreatePreSnapshot] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirmPhrase('')
      setCreatePreSnapshot(true)
      setConfirmOpen(false)
    }
  }, [open])

  const resetMutation = useMutation({
    mutationFn: () =>
      BackupsApi.factoryReset({
        confirmPhrase: FACTORY_RESET_PHRASE,
        createPreSnapshot,
      }),
    onSuccess: (result) => {
      setTrackedJobId(result.resetJobId)
      setConfirmOpen(false)
      toast.success(t('Factory reset started', 'بدأت إعادة ضبط المصنع'))
      void queryClient.invalidateQueries({ queryKey: QK.backups.all })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const phraseOk = confirmPhrase.trim() === FACTORY_RESET_PHRASE
  const busy = resetMutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !busy && !confirmOpen && !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('Factory reset', 'إعادة ضبط المصنع')}</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTitle>{t('Destructive action', 'إجراء مدمر')}</AlertTitle>
            <AlertDescription>
              {t(
                'This wipes operational data and restores factory defaults. Use only when instructed.',
                'يمسح هذا البيانات التشغيلية ويعيد الإعدادات الافتراضية. استخدمه فقط عند الحاجة.',
              )}
            </AlertDescription>
          </Alert>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={createPreSnapshot}
              onCheckedChange={(v) => setCreatePreSnapshot(v === true)}
              disabled={busy}
            />
            {t('Create pre-reset snapshot', 'إنشاء لقطة قبل إعادة الضبط')}
          </label>
          <div className="space-y-2">
            <Label htmlFor="factory-phrase">
              {t(`Type ${FACTORY_RESET_PHRASE} to confirm`, `اكتب ${FACTORY_RESET_PHRASE} للتأكيد`)}
            </Label>
            <Input
              id="factory-phrase"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={FACTORY_RESET_PHRASE}
              autoComplete="off"
              disabled={busy}
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!phraseOk || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {t('Reset system', 'إعادة ضبط النظام')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        intent="danger"
        title={t('Confirm factory reset', 'تأكيد إعادة ضبط المصنع')}
        description={t(
          'This will erase data and cannot be undone without a pre-snapshot.',
          'سيؤدي هذا إلى مسح البيانات ولا يمكن التراجع إلا عبر لقطة سابقة.',
        )}
        loading={busy}
        confirmLabel={t('Start factory reset', 'بدء إعادة الضبط')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => resetMutation.mutate()}
      />
    </>
  )
}
