import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@emdad/ui/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@emdad/ui/ui/toggle-group'

export type InboundExportColumnOption = { id: string; labelEn: string; labelAr: string }

export function InboundExportDialog({
  open,
  onClose,
  columns,
  exporting,
  onExport,
  isArabic,
}: {
  open: boolean
  onClose: () => void
  columns: InboundExportColumnOption[]
  exporting: boolean
  onExport: (p: { columnIds: string[]; arabicHeaders: boolean }) => void
  isArabic: boolean
}) {
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
          <DialogTitle>{t('Export inbound orders', 'تصدير طلبات الوارد')}</DialogTitle>
          <DialogDescription>
            {t('Select the fields you want to include in the exported file.', 'اختر الحقول التي تريد تضمينها في ملف التصدير.')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{t('CSV column headers', 'عناوين أعمدة CSV')}</span>
          <ToggleGroup type="single" variant="outline" value={lang} onValueChange={(v) => v && setLang(v as 'ar' | 'en')} disabled={exporting}>
            <ToggleGroupItem
              value="ar"
              className="data-[state=on]:border-[#084c33] data-[state=on]:bg-[#084c33] data-[state=on]:text-white data-[state=on]:hover:bg-[#063d29] data-[state=on]:hover:text-white"
            >
              {t('Arabic', 'عربي')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="en"
              className="data-[state=on]:border-[#084c33] data-[state=on]:bg-[#084c33] data-[state=on]:text-white data-[state=on]:hover:bg-[#063d29] data-[state=on]:hover:text-white"
            >
              {t('English', 'إنجليزي')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={exporting || all}
            className="bg-[#084c33] text-white hover:bg-[#063d29] hover:text-white disabled:bg-muted disabled:text-muted-foreground"
            onClick={() => setSelected(new Set(columns.map((c) => c.id)))}
          >
            {t('Select all', 'تحديد الكل')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={exporting || selected.size === 0}
            className="border border-transparent text-tone-danger-fg hover:border-tone-danger-border hover:bg-tone-danger-bg hover:text-tone-danger-fg"
            onClick={() => setSelected(new Set())}
          >
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
          <Button
            type="button"
            variant="ghost"
            disabled={exporting}
            onClick={onClose}
            className="border border-transparent text-tone-danger-fg hover:border-tone-danger-border hover:bg-tone-danger-bg hover:text-tone-danger-fg"
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || exporting}
            onClick={() =>
              onExport({
                columnIds: columns.filter((c) => selected.has(c.id)).map((c) => c.id),
                arabicHeaders: lang === 'ar',
              })
            }
          >
            {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {exporting ? t('Exporting…', 'جاري التصدير…') : t('Export CSV', 'تصدير CSV')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
