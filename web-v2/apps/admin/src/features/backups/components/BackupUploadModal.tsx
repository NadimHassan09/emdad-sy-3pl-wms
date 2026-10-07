import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { BackupUploadDropzone } from './BackupUploadDropzone'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function BackupUploadModal({ open, onClose, onSuccess }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Upload backup', 'رفع نسخة احتياطية')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t(
            'Upload a PostgreSQL custom-format dump. The server validates the file and stores a checksum.',
            'ارفع ملف dump بصيغة PostgreSQL المخصصة. يتحقق الخادم من الملف ويخزن المجموع الاختباري.',
          )}
        </p>
        <BackupUploadDropzone onSuccess={() => onSuccess?.()} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
