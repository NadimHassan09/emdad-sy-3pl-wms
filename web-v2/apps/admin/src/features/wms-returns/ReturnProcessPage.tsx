import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  ReturnsApi,
  type ReturnItemCondition,
  type ReturnItemDisposition,
  type ReturnOrderLine,
} from '@/api/returns'
import { QK } from '@/constants/query-keys'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { canPostDisposition, dispositionLabel } from '@/lib/return-labels'
import { isOperatorRole } from '@/lib/rbac'
import { useAuth } from '@/auth/AuthContext'
import { DispositionLocationPicker } from './DispositionLocationPicker'
import { ReturnLineStatusBadge } from './wms-returns-ui'

const CONDITIONS: ReturnItemCondition[] = ['new', 'good', 'damaged', 'unusable']
const DISPOSITIONS: ReturnItemDisposition[] = [
  'restock',
  'quarantine',
  'damaged',
  'discard',
  'inspection_required',
]

function lineNeedsWork(line: ReturnOrderLine): boolean {
  if (line.lineStatus === 'posted') return false
  const expected = Number(line.expectedQuantity)
  const received = Number(line.receivedQuantity)
  if (received < expected) return true
  if (line.lineStatus === 'received' || line.lineStatus === 'pending') return received > 0
  if (line.lineStatus === 'inspected') {
    return !line.disposition || line.disposition === 'inspection_required' || canPostDisposition(line.disposition)
  }
  return true
}

function nextWorkLine(lines: ReturnOrderLine[]): ReturnOrderLine | null {
  return lines.find(lineNeedsWork) ?? lines.find((l) => l.lineStatus !== 'posted') ?? lines[0] ?? null
}

export function ReturnProcessPage() {
  const { id = '' } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isOperator = isOperatorRole(user?.role)
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [receiveQty, setReceiveQty] = useState('')
  const [condition, setCondition] = useState<ReturnItemCondition>('good')
  const [disposition, setDisposition] = useState<ReturnItemDisposition>('inspection_required')
  const [targetLocationId, setTargetLocationId] = useState('')
  const [inspectionNotes, setInspectionNotes] = useState('')

  const detail = useQuery({
    queryKey: QK.returns.detail(id),
    queryFn: () => ReturnsApi.get(id),
    enabled: !!id,
  })

  const order = detail.data
  const warehouseId = order?.warehouseId ?? order?.warehouse?.id ?? ''

  const startReceivingMut = useMutation({
    mutationFn: () => ReturnsApi.startReceiving(id),
    onSuccess: (data) => {
      qc.setQueryData(QK.returns.detail(id), data)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  useEffect(() => {
    if (!order || startReceivingMut.isPending || startReceivingMut.isSuccess) return
    if (order.status === 'confirmed') {
      startReceivingMut.mutate()
    }
  }, [order?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.returns.detail(id) })
    qc.invalidateQueries({ queryKey: QK.returns.all })
  }

  const receiveMut = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      ReturnsApi.receiveLine(id, lineId, { quantity, condition }),
    onSuccess: () => {
      toast.success(t('Quantity received.', 'تم استلام الكمية.'))
      setReceiveQty('')
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const inspectMut = useMutation({
    mutationFn: (lineId: string) =>
      ReturnsApi.inspectLine(id, lineId, {
        condition,
        disposition,
        targetLocationId: targetLocationId || undefined,
        inspectionNotes: inspectionNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('Inspection saved.', 'تم حفظ الفحص.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const postLineMut = useMutation({
    mutationFn: (lineId: string) =>
      ReturnsApi.applyDisposition(id, lineId, {
        disposition,
        targetLocationId: targetLocationId || undefined,
      }),
    onSuccess: () => {
      toast.success(t('Inventory posted for line.', 'تم ترحيل مخزون البند.'))
      invalidate()
      invalidateWorkflowTasksInventory(qc)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const postAllMut = useMutation({
    mutationFn: () => ReturnsApi.postInventory(id),
    onSuccess: () => {
      toast.success(t('Batch inventory posted.', 'تم ترحيل المخزون دفعة.'))
      invalidate()
      invalidateWorkflowTasksInventory(qc)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const completeMut = useMutation({
    mutationFn: () => ReturnsApi.complete(id),
    onSuccess: () => {
      toast.success(t('Return completed.', 'اكتمل الإرجاع.'))
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const lines = order?.lines ?? []
  const activeLine = useMemo(() => {
    if (activeLineId) return lines.find((l) => l.id === activeLineId) ?? nextWorkLine(lines)
    return nextWorkLine(lines)
  }, [lines, activeLineId])

  useEffect(() => {
    if (!activeLine) return
    const remaining = Number(activeLine.expectedQuantity) - Number(activeLine.receivedQuantity)
    if (remaining > 0) setReceiveQty(String(remaining))
    if (activeLine.disposition) setDisposition(activeLine.disposition)
    if (activeLine.targetLocationId) setTargetLocationId(activeLine.targetLocationId)
  }, [activeLine?.id, activeLine?.receivedQuantity, activeLine?.disposition, activeLine?.targetLocationId])

  const busy =
    receiveMut.isPending ||
    inspectMut.isPending ||
    postLineMut.isPending ||
    postAllMut.isPending ||
    completeMut.isPending ||
    startReceivingMut.isPending

  const progressPct = useMemo(() => {
    if (lines.length === 0) return 0
    const done = lines.filter((l) => l.lineStatus === 'posted').length
    return Math.round((done / lines.length) * 100)
  }, [lines])

  if (detail.isLoading || startReceivingMut.isPending) {
    return <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
  }

  if (!order) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('Return not found.', 'الإرجاع غير موجود.')}</AlertTitle>
      </Alert>
    )
  }

  if (order.status === 'draft' || order.status === 'completed' || order.status === 'cancelled') {
    return (
      <div className="space-y-4">
        <PageHeader title={t('Process return', 'معالجة الإرجاع')} description={order.orderNumber} />
        <Alert>
          <AlertTitle>{t('Cannot process', 'لا يمكن المعالجة')}</AlertTitle>
          <AlertDescription>
            {t('Confirm the return first, or view a finished return on the detail page.', 'أكد الإرجاع أولاً.')}
          </AlertDescription>
        </Alert>
        <Button variant="secondary" asChild>
          <Link to={`/returns/${id}`}>{t('Details', 'التفاصيل')}</Link>
        </Button>
      </div>
    )
  }

  const stepReceive =
    activeLine && Number(activeLine.receivedQuantity) < Number(activeLine.expectedQuantity)
  const stepInspect =
    activeLine &&
    !stepReceive &&
    activeLine.lineStatus !== 'posted' &&
    (activeLine.lineStatus === 'received' ||
      activeLine.lineStatus === 'pending' ||
      (activeLine.lineStatus === 'inspected' && activeLine.disposition === 'inspection_required'))
  const stepPost =
    activeLine &&
    !stepReceive &&
    !stepInspect &&
    activeLine.lineStatus === 'inspected' &&
    !!activeLine.disposition &&
    canPostDisposition(activeLine.disposition)

  const submitReceive = () => {
    if (!activeLine) return
    const q = Number(receiveQty)
    if (!Number.isFinite(q) || q <= 0) {
      toast.error(t('Enter a valid quantity.', 'أدخل كمية صحيحة.'))
      return
    }
    receiveMut.mutate({ lineId: activeLine.id, quantity: q })
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        title={t('Process return', 'معالجة الإرجاع')}
        description={`${order.orderNumber} · ${progressPct}%`}
        actions={
          <Button variant="secondary" asChild>
            <Link to={`/returns/${id}`}>{t('Details', 'التفاصيل')}</Link>
          </Button>
        }
      />

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {lines.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveLineId(l.id)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-start text-sm ${
              activeLine?.id === l.id ? 'border-primary bg-muted/50' : 'border-border bg-card'
            }`}
          >
            <span className="font-mono font-semibold">{l.product.sku}</span>
            <div className="mt-1">
              <ReturnLineStatusBadge status={l.lineStatus} isArabic={isArabic} />
            </div>
          </button>
        ))}
      </div>

      {activeLine ? (
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">{activeLine.product.name}</h2>
          <p className="font-mono text-sm text-muted-foreground">
            {activeLine.product.sku} · {t('Expected', 'متوقع')} {Number(activeLine.expectedQuantity)} ·{' '}
            {t('Received', 'مستلم')} {Number(activeLine.receivedQuantity)}
          </p>

          {stepReceive ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">{t('1 · Receive', '1 · استلام')}</p>
              <div className="space-y-1.5">
                <Label>{t('Quantity to receive', 'كمية الاستلام')}</Label>
                <Input type="number" min={0} value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Condition', 'الحالة')}</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as ReturnItemCondition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={busy} onClick={submitReceive}>
                {t('Receive', 'استلام')}
              </Button>
            </div>
          ) : null}

          {stepInspect ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">{t('2 · Inspect', '2 · فحص')}</p>
              <div className="space-y-1.5">
                <Label>{t('Condition', 'الحالة')}</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as ReturnItemCondition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('Disposition', 'التصرف')}</Label>
                <Select
                  value={disposition}
                  onValueChange={(v) => {
                    setDisposition(v as ReturnItemDisposition)
                    setTargetLocationId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSITIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {dispositionLabel(d, isArabic)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canPostDisposition(disposition) && warehouseId ? (
                <DispositionLocationPicker
                  warehouseId={warehouseId}
                  disposition={disposition}
                  value={targetLocationId}
                  onChange={setTargetLocationId}
                  label={t('Target location', 'الموقع المستهدف')}
                  disabled={busy}
                />
              ) : null}
              <div className="space-y-1.5">
                <Label>{t('Inspection notes', 'ملاحظات الفحص')}</Label>
                <Textarea value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} rows={2} />
              </div>
              <Button disabled={busy} onClick={() => inspectMut.mutate(activeLine.id)}>
                {t('Save inspection', 'حفظ الفحص')}
              </Button>
            </div>
          ) : null}

          {stepPost ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">{t('3 · Post inventory', '3 · ترحيل')}</p>
              <p className="text-sm">
                {dispositionLabel(activeLine.disposition, isArabic)} →{' '}
                {activeLine.targetLocation?.fullPath ?? t('pick location', 'اختر موقع')}
              </p>
              {!activeLine.targetLocationId && canPostDisposition(disposition) && warehouseId ? (
                <DispositionLocationPicker
                  warehouseId={warehouseId}
                  disposition={disposition}
                  value={targetLocationId}
                  onChange={setTargetLocationId}
                  label={t('Target location', 'الموقع المستهدف')}
                  disabled={busy}
                />
              ) : null}
              <Button disabled={busy} onClick={() => postLineMut.mutate(activeLine.id)}>
                {t('Post line', 'ترحيل البند')}
              </Button>
            </div>
          ) : null}

          {activeLine.lineStatus === 'posted' ? (
            <p className="mt-4 text-sm text-primary">{t('Line complete.', 'اكتمل البند.')}</p>
          ) : null}
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-end">
          {!isOperator ? (
            <Button variant="secondary" disabled={busy} onClick={() => postAllMut.mutate()}>
              {t('Post all eligible', 'ترحيل الكل المؤهل')}
            </Button>
          ) : null}
          {!isOperator ? (
            <Button disabled={busy} onClick={() => completeMut.mutate()}>
              {t('Complete return', 'إكمال الإرجاع')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
