import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Loader2, Upload } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@emdad/ui/ui/dialog'
import { Label } from '@emdad/ui/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@emdad/ui/ui/toggle-group'
import { CompaniesApi } from '@/api/companies'
import { OmsApi } from '@/api/oms'
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

export function OmsImportDialog({ open, onClose, onImported, isArabic }: { open: boolean; onClose: () => void; onImported: () => void; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const inputRef = useRef<HTMLInputElement>(null)
  const [companyId, setCompanyId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null)

  const companies = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list(), staleTime: 10 * 60_000, enabled: open })
  const options = companies.data?.map((c) => ({ value: c.id, label: c.name })) ?? []

  const mut = useMutation({
    mutationFn: (f: File) => OmsApi.importOrders(f, companyId),
    onSuccess: (data) => {
      setResult(data)
      const imported = data.imported ?? 0
      const failed = data.failed ?? 0
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
          <DialogTitle>{t('Import OMS orders', 'استيراد طلبات OMS')}</DialogTitle>
          <DialogDescription>
            {t(
              'Pick a client, download the client template, then upload once. Same validation as the client portal (complete rows only).',
              'اختر عميلًا، نزّل قالب العميل، ثم ارفع الملف مرة واحدة. نفس قواعد التحقق في بوابة العميل (صفوف مكتملة فقط).',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oms-import-company">{t('Client company', 'شركة العميل')}</Label>
            <Combobox id="oms-import-company" value={companyId} onChange={setCompanyId} options={options} placeholder={t('Select company…', 'اختر الشركة…')} searchPlaceholder={t('Search…', 'بحث…')} emptyLabel={t('No results', 'لا نتائج')} disabled={busy} />
          </div>
          <Button type="button" variant="outline" disabled={!companyId || busy} onClick={() => void OmsApi.downloadImportTemplate().catch((e: Error) => toast.error(e.message))}>
            <Download aria-hidden />
            {t('Download client template', 'تنزيل قالب العميل')}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="oms-import-file">{t('File (CSV / Excel)', 'الملف (CSV / Excel)')}</Label>
            <input
              id="oms-import-file"
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!companyId || busy}
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
                {t('Created', 'تم الإنشاء')}: <b className="tabular">{result.imported ?? 0}</b> · {t('Failed', 'فشل')}: <b className="tabular">{result.failed ?? 0}</b> · {t('Duplicates', 'مكررات')}: <b className="tabular">{result.skippedDuplicates ?? 0}</b>
              </p>
              {(result.errors?.length ?? 0) > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => downloadText('oms-import-errors.csv', errorsToCsv(result.errors as ImportErrors))}>
                  <Download aria-hidden />
                  {t('Download errors CSV', 'تنزيل أخطاء CSV')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
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

export type OmsExportColumnOption = { id: string; labelEn: string; labelAr: string }

export function OmsExportDialog({
  open, onClose, columns, exporting, onExport, isArabic,
}: { open: boolean; onClose: () => void; columns: OmsExportColumnOption[]; exporting: boolean; onExport: (p: { columnIds: string[]; arabicHeaders: boolean }) => void; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(columns.map((c) => c.id)))
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const key = columns.map((c) => c.id).join(',')
  useEffect(() => {
    if (open) {
      setSelected(new Set(columns.map((c) => c.id)))
      setLang('ar')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])
  const all = columns.length > 0 && selected.size === columns.length
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !exporting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Export OMS orders', 'تصدير طلبات OMS')}</DialogTitle>
          <DialogDescription>{t('Select the fields you want to include in the exported file.', 'اختر الحقول التي تريد تضمينها في ملف التصدير.')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{t('CSV column headers', 'عناوين أعمدة CSV')}</span>
          <ToggleGroup type="single" variant="outline" value={lang} onValueChange={(v) => v && setLang(v as 'ar' | 'en')} disabled={exporting}>
            <ToggleGroupItem value="ar">{t('Arabic', 'عربي')}</ToggleGroupItem>
            <ToggleGroupItem value="en">{t('English', 'إنجليزي')}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={exporting || all} onClick={() => setSelected(new Set(columns.map((c) => c.id)))}>
            {t('Select all', 'تحديد الكل')}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={exporting || selected.size === 0} onClick={() => setSelected(new Set())}>
            {t('Clear all', 'إلغاء الكل')}
          </Button>
          <span className="ms-auto text-sm text-muted-foreground tabular">{t(`Selected: ${selected.size}`, `المحدد: ${selected.size}`)}</span>
        </div>
        <ul className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
          {columns.map((c) => (
            <li key={c.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 hover:bg-accent">
                <Checkbox checked={selected.has(c.id)} disabled={exporting} onCheckedChange={(v) => toggle(c.id, !!v)} />
                <span className="text-sm">{lang === 'ar' ? c.labelAr : c.labelEn}</span>
              </label>
            </li>
          ))}
        </ul>
        {selected.size === 0 ? (
          <p role="alert" className="text-sm text-destructive">
            {t('Please select at least one field to export.', 'يرجى اختيار حقل واحد على الأقل للتصدير.')}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={exporting} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" disabled={selected.size === 0 || exporting} onClick={() => onExport({ columnIds: columns.filter((c) => selected.has(c.id)).map((c) => c.id), arabicHeaders: lang === 'ar' })}>
            {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {exporting ? t('Exporting…', 'جاري التصدير…') : t('Export CSV', 'تصدير CSV')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
