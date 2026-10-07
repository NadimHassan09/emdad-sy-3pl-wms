import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useUiPreferences } from '@emdad/core'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
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
import { BackupsApi, type BackupStoragePolicyValue, type CreateBackupInput } from '@/api/backups'
import { QK } from '@/constants/query-keys'
import { isBackupGdriveUiEnabled } from '@/lib/backup-gdrive-ui'
import {
  localizedBackupStoragePolicyLabel,
  localizedBackupStoragePolicyOptions,
} from '@/lib/settings-backup-labels'

type Props = {
  open: boolean
  loading?: boolean
  onClose: () => void
  onSubmit: (body: CreateBackupInput) => void
}

function requiresDrive(policy: BackupStoragePolicyValue): boolean {
  return policy === 'drive_only' || policy === 'local_and_drive'
}

export function CreateBackupModal({ open, loading, onClose, onSubmit }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const gdriveUiEnabled = isBackupGdriveUiEnabled()
  const policyOptions = useMemo(() => localizedBackupStoragePolicyOptions(t), [isArabic])

  const [label, setLabel] = useState('')
  const [storagePolicy, setStoragePolicy] = useState<BackupStoragePolicyValue>('local_only')
  const [error, setError] = useState<string | null>(null)

  const policyQuery = useQuery({
    queryKey: QK.backups.storagePolicy,
    queryFn: () => BackupsApi.getStoragePolicy(),
    enabled: open,
  })

  const driveQuery = useQuery({
    queryKey: QK.backups.googleDrive,
    queryFn: () => BackupsApi.getGoogleDriveStatus(),
    enabled: open && gdriveUiEnabled,
  })

  useEffect(() => {
    if (!open) return
    setLabel('')
    setError(null)
    if (policyQuery.data) {
      setStoragePolicy(policyQuery.data.effectiveDefaultPolicy)
    }
  }, [open, policyQuery.data])

  const driveConnected = !!driveQuery.data?.connected
  const driveEnabled = !!driveQuery.data?.gdriveEnabled
  const drivePolicyBlocked =
    gdriveUiEnabled && requiresDrive(storagePolicy) && (!driveEnabled || !driveConnected)

  const handleSubmit = () => {
    const trimmed = label.trim()
    if (trimmed.length > 200) {
      setError(t('Label must be 200 characters or fewer.', 'يجب ألا تتجاوز التسمية 200 حرفاً.'))
      return
    }
    if (drivePolicyBlocked) {
      setError(
        t(
          'Drive storage policies require a connected Google Drive account.',
          'سياسات تخزين Drive تتطلب حساب Google Drive متصلاً.',
        ),
      )
      return
    }
    setError(null)
    onSubmit({
      label: trimmed || undefined,
      storagePolicy,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Create backup', 'إنشاء نسخة احتياطية')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="backup-label">{t('Label (optional)', 'التسمية (اختياري)')}</Label>
            <Input
              id="backup-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Storage policy', 'سياسة التخزين')}</Label>
            <Select
              value={storagePolicy}
              onValueChange={(v) => setStoragePolicy(v as BackupStoragePolicyValue)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {policyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {localizedBackupStoragePolicyLabel(opt.value, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {drivePolicyBlocked ? (
            <Alert>
              <AlertDescription>
                {t(
                  'Connect Google Drive before using off-site storage policies.',
                  'اربط Google Drive قبل استخدام سياسات التخزين خارج الموقع.',
                )}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading || drivePolicyBlocked}>
            {t('Start backup', 'بدء النسخ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
