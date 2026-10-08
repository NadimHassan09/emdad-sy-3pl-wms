import { useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Label } from '@emdad/ui/ui/label'
import { CompaniesApi } from '@/api/companies'
import { OutboundApi } from '@/api/outbound'
import { QK } from '@/constants/query-keys'

/** White field surface (avoids muted / light-green select fill). */
const FIELD_SURFACE = 'bg-white hover:bg-white dark:bg-white dark:text-foreground dark:hover:bg-white'

/** Soft-danger text button (Close). */
const DANGER_TEXT_BTN =
  'border border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg'

type ImportErrors = Array<{ rowNumber: number; externalReference?: string | null; orderNumber?: string | null; reason?: string; error?: string }>

function errorsToCsv(errors: ImportErrors): string {
  const lines = ['row_number,external_reference,reason']
  for (const e of errors) {
    const ref = (e.externalReference ?? e.orderNumber ?? '').replace(/"/g, '""')
    const reason = (e.reason ?? e.error ?? '').replace(/"/g, '""')
    lines.push(`${e.rowNumber},"${ref}","${reason}"`)
  }
  return `\uFEFF${lines.join('\n')}`
}

function downloadText(filename: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function OutboundImportDialog({
  open,
  onClose,
  onImported,
  isArabic,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const inputRef = useRef<HTMLInputElement>(null)
  const [companyId, setCompanyId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null)

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: open,
  })
  const options = companies.data?.map((c) => ({ value: c.id, label: c.name })) ?? []

  const mut = useMutation({
    mutationFn: (f: File) => OutboundApi.importOrders(f, companyId),
    onSuccess: (data) => {
      setResult(data)
      const imported = data.imported ?? data.created ?? 0
      const failed = data.failed ?? data.invalid ?? 0
      toast.success(t(`Imported ${imported} order(s). Failed: ${failed}.`, `تم استيراد ${imported} طلب/طلبات. فشل: ${failed}.`))
      onImported()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reset = () => {
    setCompanyId('')
    setFile(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }
  const close = () => {
    if (mut.isPending) return
    reset()
    onClose()
  }
  const busy = mut.isPending

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
  }

  const errors: ImportErrors = result?.errors ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Import outbound orders', 'استيراد طلبات الصادر')}</DialogTitle>
          <DialogDescription>
            {t(
              'Select a client, download the template, then upload a CSV. Only complete rows are imported.',
              'اختر عميلاً، نزّل القالب، ثم ارفع ملف CSV. تُستورد الصفوف المكتملة فقط.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('Client', 'العميل')}</Label>
            <Combobox
              value={companyId}
              onChange={setCompanyId}
              options={options}
              placeholder={t('Select client', 'اختر العميل')}
              searchPlaceholder={t('Search…', 'بحث…')}
              emptyLabel={t('No results', 'لا نتائج')}
              disabled={busy}
              className={FIELD_SURFACE}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void OutboundApi.downloadImportTemplate().catch((e: Error) => toast.error(e.message))}
            >
              <Download className="size-4" aria-hidden />
              {t('Download template', 'تنزيل القالب')}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outbound-import-file">{t('CSV file', 'ملف CSV')}</Label>
            <input
              ref={inputRef}
              id="outbound-import-file"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className="block w-full cursor-pointer rounded-lg border border-input bg-white text-sm file:me-4 file:h-10 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              onChange={onFile}
            />
          </div>
          {errors.length > 0 ? (
            <div className="rounded-lg border border-tone-warning-border bg-tone-warning-bg p-3 text-sm">
              <p className="font-medium text-tone-warning-fg">
                {t(`${errors.length} row error(s)`, `${errors.length} خطأ في الصفوف`)}
              </p>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => downloadText('outbound-import-errors.csv', errorsToCsv(errors))}
              >
                {t('Download error report', 'تنزيل تقرير الأخطاء')}
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} className={DANGER_TEXT_BTN} onClick={close}>
            {t('Close', 'إغلاق')}
          </Button>
          <Button
            type="button"
            disabled={busy || !companyId || !file}
            onClick={() => file && mut.mutate(file)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {t('Import', 'استيراد')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
