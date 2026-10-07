import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Label } from '@emdad/ui/ui/label'
import {
  downloadClientImportTemplate,
  downloadImportErrors,
  importClientOrders,
  type ClientOrderImportSummary,
} from '@/services/clientOrderImport'

export function OmsImportDialog({
  open,
  onClose,
  onImported,
  isArabic,
  disabled,
  disabledReason,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
  isArabic: boolean
  disabled?: boolean
  disabledReason?: string
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ClientOrderImportSummary | null>(null)

  const templateMut = useMutation({
    mutationFn: () => downloadClientImportTemplate('oms'),
    onError: (err: Error) => toast.error(err.message),
  })

  const mut = useMutation({
    mutationFn: (f: File) => importClientOrders('oms', f),
    onSuccess: (data) => {
      setResult(data)
      toast.success(
        t(
          `Created ${data.created}. Invalid: ${data.invalid}. Duplicates: ${data.duplicate}.`,
          `تم الإنشاء ${data.created}. غير صالح: ${data.invalid}. مكرر: ${data.duplicate}.`,
        ),
      )
      onImported()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reset = () => {
    setFile(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const close = () => {
    if (mut.isPending) return
    reset()
    onClose()
  }

  const busy = mut.isPending || templateMut.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Import online orders', 'استيراد الطلبات الإلكترونية')}</DialogTitle>
          <DialogDescription>
            {t(
              'Upload a CSV/Excel file. Every row must be complete and valid (same rules as Create order).',
              'ارفع ملف CSV/Excel. يجب أن يكون كل صف مكتملًا وصحيحًا (نفس قواعد إنشاء الطلب).',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {disabled ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              {disabledReason || t('Import is currently unavailable.', 'الاستيراد غير متاح حالياً.')}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={busy || disabled}
            onClick={() => templateMut.mutate()}
          >
            {templateMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {t('Download template', 'تنزيل القالب')}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="oms-import-file">{t('File (CSV / Excel)', 'الملف (CSV / Excel)')}</Label>
            <input
              id="oms-import-file"
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy || disabled}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setFile(e.target.files?.[0] ?? null)
                setResult(null)
              }}
              className="block w-full cursor-pointer rounded-lg border bg-card text-sm file:me-3 file:h-10 file:cursor-pointer file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {result ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <p>
                {t('Created', 'تم الإنشاء')}: <b className="tabular">{result.created}</b>
                {' · '}
                {t('Invalid', 'غير صالح')}: <b className="tabular">{result.invalid}</b>
                {' · '}
                {t('Duplicates', 'مكررات')}: <b className="tabular">{result.duplicate}</b>
              </p>
              {result.errors.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadImportErrors('oms', result.errors)}
                >
                  <Download aria-hidden />
                  {t('Download errors CSV', 'تنزيل أخطاء CSV')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={mut.isPending}>
            {t('Close', 'إغلاق')}
          </Button>
          <Button
            type="button"
            disabled={!file || busy || disabled}
            onClick={() => file && mut.mutate(file)}
          >
            {mut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {t('Import', 'استيراد')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
