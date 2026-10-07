import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { StatCard } from './OmsMisc'
import { Button } from '@emdad/ui/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { cn, useNavigate } from '@emdad/ui'
import { OmsApi, type OmsOrderListItem } from '@/api/oms'
import { QK } from '@/constants/query-keys'

const ISSUE = new Set(['failed_delivery', 'cancelled', 'rejected', 'returned'])
const FINISHED = new Set(['delivered', 'completed'])
const MAX_IDS = 1000

export function OmsCreateBatchDialog({
  open, selectedIds, loadedOrders, isArabic, onClose,
}: { open: boolean; selectedIds: string[]; loadedOrders: OmsOrderListItem[]; isArabic: boolean; onClose: () => void }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const loaded = useMemo(() => loadedOrders.filter((o) => selectedIds.includes(o.id)), [loadedOrders, selectedIds])
  const canPreview = loaded.length === selectedIds.length && selectedIds.length > 0
  const issues = loaded.filter((o) => ISSUE.has(o.status)).length
  const finished = loaded.filter((o) => FINISHED.has(o.status)).length
  const eligible = Math.max(0, loaded.length - issues - finished)

  async function create() {
    if (!selectedIds.length || saving) return
    setSaving(true)
    try {
      const batch = await OmsApi.createBatch(selectedIds, name.trim())
      toast.success(t(`${batch.batchNumber} created. Opening the batch workspace.`, `تم إنشاء ${batch.batchNumber}. ستُفتح صفحة المجموعة الآن.`))
      void qc.invalidateQueries({ queryKey: QK.omsBatches })
      onClose()
      setName('')
      navigate(`/oms/batches/${batch.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not create the batch.', 'تعذر إنشاء المجموعة.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Create batch', 'إنشاء مجموعة')}</DialogTitle>
          <DialogDescription>
            {t(
              'The selected orders are saved as an operational group. Each order keeps its own status, and you can continue this same group after the stage changes.',
              'تُحفظ الطلبات المحددة كمجموعة تشغيلية. تبقى حالات كل طلب كما هي، ويمكنك متابعة نفس المجموعة بعد تغيير المرحلة دون البحث عنها مرة أخرى.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <div className="text-lg font-semibold tabular">{t(`${selectedIds.length} orders selected`, `${selectedIds.length} طلب محدد`)}</div>
          <div className="text-sm text-muted-foreground">{t('These orders will belong to the new batch.', 'ستُضاف هذه الطلبات إلى المجموعة الجديدة.')}</div>
        </div>
        {canPreview ? (
          <div className="grid grid-cols-3 gap-2">
            <StatCard label={t('Eligible', 'قابلة للمتابعة')} value={eligible} tone="success" />
            <StatCard label={t('With issues', 'فيها مشكلة')} value={issues} tone="warning" />
            <StatCard label={t('Finished', 'مكتملة')} value={finished} tone="neutral" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('Some selected orders are on other pages. The breakdown appears after the batch opens.', 'بعض الطلبات المحددة موجودة في صفحات أخرى. سيتم حساب التفصيل بعد فتح المجموعة.')}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="oms-batch-name">{t('Batch name (optional)', 'اسم المجموعة (اختياري)')}</Label>
          <Input id="oms-batch-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t('Example: Morning shift', 'مثال: وردية الصباح')} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" disabled={saving || selectedIds.length === 0} onClick={() => void create()}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {saving ? t('Creating…', 'جارٍ الإنشاء…') : t('Create batch', 'إنشاء المجموعة')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OmsAddToBatchDialog({
  open, selectedIds, isArabic, onClose,
}: { open: boolean; selectedIds: string[]; isArabic: boolean; onClose: () => void }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(id)
  }, [search])
  useEffect(() => {
    if (!open) {
      setSearch('')
      setDebounced('')
      setBatchId(null)
    }
  }, [open])

  const batchesQuery = useQuery({
    queryKey: [...QK.omsBatches, 'add-modal', debounced],
    queryFn: () => OmsApi.listBatches(debounced || undefined),
    enabled: open,
  })
  const batches = batchesQuery.data ?? []
  const overLimit = selectedIds.length > MAX_IDS

  async function confirm() {
    if (!batchId || !selectedIds.length || saving) return
    if (overLimit) {
      toast.error(t('You can add up to 1000 orders at once.', 'يمكن إضافة حتى 1000 طلب في المرة الواحدة.'))
      return
    }
    setSaving(true)
    try {
      await OmsApi.addBatchOrders(batchId, selectedIds)
      const b = batches.find((x) => x.id === batchId)
      toast.success(t(`Added ${selectedIds.length} orders to ${b?.batchNumber ?? 'the batch'}.`, `تمت إضافة ${selectedIds.length} طلب إلى ${b?.batchNumber ?? 'المجموعة'}.`))
      void qc.invalidateQueries({ queryKey: QK.omsBatches })
      onClose()
      navigate(`/oms/batches/${batchId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not add orders to the batch.', 'تعذرت إضافة الطلبات إلى المجموعة.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Add to existing batch', 'إضافة إلى مجموعة موجودة')}</DialogTitle>
          <DialogDescription>
            {t('Pick an existing batch to add the selected orders to. Orders already in the batch are not duplicated.', 'اختر مجموعة موجودة لإضافة الطلبات المحددة إليها. الطلبات الموجودة فيها مسبقًا لن تتكرر.')}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <div className="text-lg font-semibold tabular">{t(`${selectedIds.length} orders selected`, `${selectedIds.length} طلب محدد`)}</div>
          {overLimit ? <div className="text-sm font-medium text-destructive">{t('You can add up to 1000 orders at once.', 'يمكن إضافة حتى 1000 طلب في المرة الواحدة.')}</div> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="oms-batch-search">{t('Search batches', 'بحث عن مجموعة')}</Label>
          <Input id="oms-batch-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Batch number or name…', 'رقم المجموعة أو الاسم…')} />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border">
          {batchesQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
          ) : batches.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('No batches found.', 'لا توجد مجموعات.')}</p>
          ) : (
            <ul className="divide-y">
              {batches.map((b) => {
                const selected = b.id === batchId
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setBatchId(b.id)}
                      className={cn('flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-start transition-colors hover:bg-accent', selected && 'bg-accent')}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{b.batchNumber}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {b.name || t('Unnamed', 'بدون اسم')} · {new Date(b.createdAt).toLocaleDateString(isArabic ? 'ar-SY-u-nu-latn' : 'en-GB')}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                        {t(`${b.orderCount} orders`, `${b.orderCount} طلب`)}
                        {selected ? <CheckCircle2 className="size-4 text-primary" aria-hidden /> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" disabled={saving || !batchId || selectedIds.length === 0 || overLimit} onClick={() => void confirm()}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {saving ? t('Adding…', 'جارٍ الإضافة…') : t('Add to batch', 'إضافة إلى المجموعة')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
