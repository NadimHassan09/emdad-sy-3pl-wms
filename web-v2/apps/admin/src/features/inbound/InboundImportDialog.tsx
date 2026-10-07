import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@emdad/ui/ui/dialog'
import { Label } from '@emdad/ui/ui/label'
import { CompaniesApi } from '@/api/companies'
import { InboundApi } from '@/api/inbound'
import { QK } from '@/constants/query-keys'

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

export function InboundImportDialog({
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
    mutationFn: (f: File) => InboundApi.importOrders(f, companyId),
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Import inbound orders', 'استيراد طلبات الوارد')}</DialogTitle>
          <DialogDescription>
            {t(
              'Pick a client, download the template, then upload once. Same validation as the client portal (complete rows only).',
              'اختر عميلًا، نزّل القالب، ثم ارفع الملف مرة واحدة. نفس قواعد التحقق في بوابة العميل (صفوف مكتملة فقط).',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inbound-import-company">{t('Client company', 'شركة العميل')}</Label>
            <Combobox
              id="inbound-import-company"
              value={companyId}
              onChange={setCompanyId}
              options={options}
              placeholder={t('Select company…', 'اختر الشركة…')}
              searchPlaceholder={t('Search…', 'بحث…')}
              emptyLabel={t('No results', 'لا نتائج')}
              disabled={busy}
              className="border-border bg-[#f1f7f2] hover:bg-[#f1f7f2] dark:bg-[#f1f7f2] dark:hover:bg-[#f1f7f2] dark:text-brand-900"
            />
          </div>
          <Button
            type="button"
            disabled={busy}
            className="bg-[#084c33] text-white hover:bg-[#063d29] hover:text-white"
            onClick={() => void InboundApi.downloadImportTemplate().catch((e: Error) => toast.error(e.message))}
          >
            <Download aria-hidden />
            {t('Download template', 'تنزيل القالب')}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="inbound-import-file">{t('File (CSV / Excel)', 'الملف (CSV / Excel)')}</Label>
            <input
              id="inbound-import-file"
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!companyId || busy}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setFile(e.target.files?.[0] ?? null)
                setResult(null)
              }}
              className="block w-full cursor-pointer rounded-lg border bg-card text-sm file:me-3 file:h-10 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#084c33] file:px-4 file:font-medium file:text-white hover:file:bg-[#063d29] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {result ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <p>
                {t('Imported', 'تم الاستيراد')}: <b className="tabular">{result.imported ?? result.created ?? 0}</b> ·{' '}
                {t('Failed', 'فشل')}: <b className="tabular">{result.failed ?? result.invalid ?? 0}</b>
              </p>
              {(result.errors?.length ?? 0) > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadText('inbound-import-errors.csv', errorsToCsv(result.errors as ImportErrors))}
                >
                  <Download aria-hidden />
                  {t('Download errors CSV', 'تنزيل أخطاء CSV')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            disabled={busy}
            className="border border-transparent text-tone-danger-fg hover:border-tone-danger-border hover:bg-tone-danger-bg hover:text-tone-danger-fg"
          >
            {t('Close', 'إغلاق')}
          </Button>
          <Button type="button" disabled={!file || !companyId || busy} onClick={() => file && mut.mutate(file)}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {t('Import', 'استيراد')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
