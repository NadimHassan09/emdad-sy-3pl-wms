import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, PageHeader, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Textarea } from '@emdad/ui/ui/textarea'
import {
  CycleCountApi,
  type BlindCycleCountLocationLine,
  type BlindCycleCountProductGroup,
} from '@/api/cycle-count'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { canExecuteCycleCount } from '@/lib/rbac'
import { BarcodeScanModal } from '@/features/tasks/components/BarcodeScanModal'
import { CycleCountStatusBadge } from './cycle-count-ui'

function nextPendingLine(products: BlindCycleCountProductGroup[]): {
  product: BlindCycleCountProductGroup
  line: BlindCycleCountLocationLine
} | null {
  for (const p of products) {
    const line = p.locations.find((l) => l.status === 'pending')
    if (line) return { product: p, line }
  }
  return null
}

export function CycleCountExecutePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canExecute = canExecuteCycleCount(user)
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [activeProductId, setActiveProductId] = useState<string | null>(null)

  const taskQuery = useQuery({
    queryKey: QK.cycleCount.execution(id),
    queryFn: () => CycleCountApi.getExecutionTask(id),
    enabled: !!id && canExecute,
  })

  const claimMut = useMutation({
    mutationFn: () => CycleCountApi.claimExecutionTask(id),
    onSuccess: (data) => qc.setQueryData(QK.cycleCount.execution(id), data),
    onError: (e: Error) => toast.error(e.message),
  })

  useEffect(() => {
    if (!taskQuery.data || claimMut.isPending || claimMut.isSuccess) return
    if (taskQuery.data.status === 'scheduled') claimMut.mutate()
  }, [taskQuery.data?.status, claimMut.isPending, claimMut.isSuccess])

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: QK.cycleCount.execution(id) })
    void qc.invalidateQueries({ queryKey: QK.cycleCount.myTasks('') })
    void qc.invalidateQueries({ queryKey: QK.cycleCount.all })
  }, [qc, id])

  const countLineMut = useMutation({
    mutationFn: ({ lineId, actualQuantity }: { lineId: string; actualQuantity: string }) =>
      CycleCountApi.submitLineCount(id, lineId, actualQuantity, notes.trim() || undefined),
    onSuccess: () => {
      setQty('')
      setNotes('')
      invalidate()
      toast.success(t('Count saved.', 'تم حفظ العد.'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const skipMut = useMutation({
    mutationFn: (lineId: string) => CycleCountApi.skipLine(id, lineId, notes.trim() || undefined),
    onSuccess: () => {
      setQty('')
      setNotes('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const finishMut = useMutation({
    mutationFn: () => CycleCountApi.finishTask(id),
    onSuccess: () => {
      toast.success(t('Submitted for review.', 'أُرسل للمراجعة.'))
      invalidate()
      navigate(`/cycle-count/${id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const task = taskQuery.data
  const products = task?.products ?? []

  const activeProduct = useMemo(() => {
    if (activeProductId) return products.find((p) => p.productId === activeProductId) ?? products[0]
    return nextPendingLine(products)?.product ?? products[0]
  }, [products, activeProductId])

  const activeLine = useMemo(() => {
    if (!activeProduct) return null
    return activeProduct.locations.find((l) => l.status === 'pending') ?? activeProduct.locations[0]
  }, [activeProduct])

  const progressPct = task
    ? Math.round(((task.progress.counted + task.progress.skipped) / Math.max(task.progress.totalLines, 1)) * 100)
    : 0

  const handleScan = (code: string) => {
    const c = code.trim().toLowerCase()
    if (!c) return
    const match = products.find(
      (p) =>
        p.sku.toLowerCase() === c ||
        p.barcode?.toLowerCase() === c ||
        p.locations.some((l) => l.location.barcode.toLowerCase() === c),
    )
    if (match) {
      setActiveProductId(match.productId)
      setScanOpen(false)
      toast.success(t('Product selected.', 'تم اختيار المنتج.'))
      return
    }
    toast.error(t('No matching product or location.', 'لا منتج أو موقع مطابق.'))
  }

  const submitCurrent = () => {
    if (!activeLine || activeLine.status !== 'pending') return
    const trimmed = qty.trim()
    if (trimmed === '' || Number(trimmed) < 0 || !Number.isFinite(Number(trimmed))) {
      toast.error(t('Enter a valid quantity.', 'أدخل كمية صحيحة.'))
      return
    }
    countLineMut.mutate({ lineId: activeLine.lineId, actualQuantity: trimmed })
  }

  if (!canExecute) {
    return (
      <PageHeader
        title={t('Count execution', 'تنفيذ الجرد')}
        description={t('Worker profile required', 'يتطلب ملف عامل')}
        actions={
          <Button type="button" variant="ghost" onClick={() => navigate('/cycle-count')}>
            {t('Dashboard', 'لوحة الجرد')}
          </Button>
        }
      />
    )
  }

  if (taskQuery.isLoading) return <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
  if (!task) return <p className="text-sm text-destructive">{t('Task not found.', 'المهمة غير موجودة.')}</p>

  const busy = countLineMut.isPending || skipMut.isPending || finishMut.isPending

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        title={t('Count execution', 'تنفيذ الجرد')}
        description={`${task.warehouse.code} · ${task.progress.totalLines - task.progress.pending}/${task.progress.totalLines}`}
        actions={
          <Button type="button" variant="ghost" onClick={() => navigate(`/cycle-count/${id}`)}>
            {t('Details', 'التفاصيل')}
          </Button>
        }
      />

      <div className="sticky top-0 z-10 rounded-lg border bg-background/95 p-3 backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <CycleCountStatusBadge status={task.status} isArabic={isArabic} />
          <span className="font-mono text-sm">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('Blind count — expected quantities are hidden.', 'جرد أعمى — الكميات المتوقعة مخفية.')}
        </p>
      </div>

      <Button type="button" variant="secondary" className="min-h-10 w-full sm:w-auto" onClick={() => setScanOpen(true)}>
        {t('Scan barcode', 'مسح باركود')}
      </Button>

      {activeProduct && activeLine ? (
        <div className="rounded-lg border-2 p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('Product', 'المنتج')}</div>
          <div className="text-lg font-semibold">{activeProduct.name}</div>
          <div className="font-mono text-sm">{activeProduct.sku}</div>
          {activeProduct.barcode ? <div className="font-mono text-xs text-muted-foreground">{activeProduct.barcode}</div> : null}

          <div className="mt-4 border-t pt-3">
            <div className="text-xs uppercase text-muted-foreground">{t('Location', 'الموقع')}</div>
            <div className="font-mono text-sm font-medium">{activeLine.location.fullPath}</div>
            <div className="font-mono text-xs text-muted-foreground">{activeLine.location.barcode}</div>
            {activeLine.lot ? (
              <div className="mt-1 text-sm">
                {t('Lot', 'دفعة')}: {activeLine.lot.lotNumber}
              </div>
            ) : null}
            <div className="mt-2">
              <CycleCountStatusBadge status={activeLine.status} isArabic={isArabic} />
            </div>
          </div>

          {activeLine.status === 'pending' ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>{t('Counted quantity', 'الكمية المعدودة')}</Label>
                <Input type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Notes', 'ملاحظات')}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="min-h-10 flex-1" onClick={submitCurrent} disabled={busy}>
                  {t('Save count', 'حفظ العد')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-10"
                  onClick={() => skipMut.mutate(activeLine.lineId)}
                  disabled={busy}
                >
                  {t('Skip line', 'تخطي البند')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:static sm:border-0 sm:p-0">
        <Button type="button" className="min-h-10 w-full" variant="default" onClick={() => setFinishOpen(true)} disabled={busy || task.progress.pending > 0}>
          {t('Finish & submit for review', 'إنهاء وإرسال للمراجعة')}
        </Button>
      </div>

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      <ConfirmDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title={t('Submit count?', 'إرسال الجرد؟')}
        confirmLabel={t('Submit', 'إرسال')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={finishMut.isPending}
        onConfirm={() => finishMut.mutate()}
      >
        <p className="text-sm">{t('All lines must be counted or skipped before submit.', 'يجب عد أو تخطي كل البنود قبل الإرسال.')}</p>
      </ConfirmDialog>
    </div>
  )
}
