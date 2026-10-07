import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { OmsReturnsApi, type OmsReturn } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'

const DISCRETE_UOMS = new Set(['piece', 'box', 'roll', 'pallet', 'carton'])

function isDiscreteUom(uom: string | undefined): boolean {
  return !!uom && DISCRETE_UOMS.has(uom)
}

type PreviewLine = {
  productId: string
  sku: string
  name: string
  uom?: string
  ordered: number
  alreadyReturned: number
  returnable: number
}

type Props = {
  open: boolean
  onClose: () => void
  initialOrderReference?: string
  onCreated?: (created: OmsReturn) => void
}

export function CreateOmsReturnDialog({ open, onClose, initialOrderReference, onCreated }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { warehouseId: defaultWarehouseId, warehouses, isLoading: warehousesLoading } = useDefaultWarehouseId()

  const [orderReference, setOrderReference] = useState('')
  const [resolveState, setResolveState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [omsOrderId, setOmsOrderId] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [lines, setLines] = useState<PreviewLine[]>([])
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [warehouseId, setWarehouseId] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
    setResolveState('idle')
    setResolveError(null)
    setOmsOrderId(null)
    setOrderNumber(null)
    setLines([])
    setReturnQty({})
    const ref = initialOrderReference?.trim() ?? ''
    setOrderReference(ref)
    setWarehouseId(defaultWarehouseId)
    if (ref) void resolveOrder(ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open / initial ref only
  }, [open, initialOrderReference])

  useEffect(() => {
    if (open && defaultWarehouseId && !warehouseId) setWarehouseId(defaultWarehouseId)
  }, [open, defaultWarehouseId, warehouseId])

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name || w.code })),
    [warehouses],
  )

  const resolveOrder = async (reference: string) => {
    const trimmed = reference.trim()
    if (!trimmed) return
    setResolveState('loading')
    setResolveError(null)
    try {
      const preview = await OmsReturnsApi.preview({ orderReference: trimmed })
      const qty: Record<string, string> = {}
      for (const line of preview.lines) qty[line.productId] = '0'
      setOmsOrderId(preview.omsOrderId)
      setOrderNumber(preview.orderNumber)
      setLines(preview.lines)
      setReturnQty(qty)
      setResolveState('ready')
    } catch (e) {
      setResolveState('error')
      setResolveError(e instanceof Error ? e.message : t('Order not found.', 'الطلب غير موجود.'))
      setOmsOrderId(null)
      setLines([])
    }
  }

  const createMut = useMutation({
    mutationFn: async () => {
      if (!omsOrderId) throw new Error(t('Resolve an OMS order first.', 'حدّد طلب OMS أولاً.'))
      const payloadLines = lines
        .map((line) => {
          const qty = Number(returnQty[line.productId] ?? 0)
          if (!Number.isFinite(qty) || qty <= 0) return null
          if (qty > line.returnable) {
            throw new Error(
              t(
                `Return qty for ${line.sku} exceeds returnable (${line.returnable}).`,
                `كمية الإرجاع لـ ${line.sku} تتجاوز المتاح (${line.returnable}).`,
              ),
            )
          }
          if (isDiscreteUom(line.uom) && !Number.isInteger(qty)) {
            throw new Error(
              t(`Return qty for ${line.sku} must be a whole number.`, `يجب أن تكون كمية الإرجاع لـ ${line.sku} عدداً صحيحاً.`),
            )
          }
          return { productId: line.productId, quantity: qty }
        })
        .filter(Boolean) as Array<{ productId: string; quantity: number }>

      if (payloadLines.length === 0) {
        throw new Error(t('Enter a return quantity for at least one product.', 'أدخل كمية إرجاع لمنتج واحد على الأقل.'))
      }

      return OmsReturnsApi.create({
        omsOrderId,
        reason: reason.trim() || undefined,
        warehouseId: warehouseId.trim() || undefined,
        lines: payloadLines,
      })
    },
    onSuccess: (created) => {
      toast.success(t('Return created.', 'تم إنشاء المرتجع.'))
      void qc.invalidateQueries({ queryKey: QK.omsReturns })
      void qc.invalidateQueries({ queryKey: QK.omsOrders })
      onCreated?.(created)
      onClose()
      navigate(`/oms/returns/${created.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !createMut.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Create OMS return', 'إنشاء مرتجع OMS')}</DialogTitle>
          <DialogDescription>
            {t(
              'Find an OMS order, choose return quantities, warehouse, and reason.',
              'ابحث عن طلب OMS، واختر كميات الإرجاع والمستودع والسبب.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="return-reason">{t('Reason (optional)', 'السبب (اختياري)')}</Label>
            <Input id="return-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-warehouse">{t('Warehouse', 'المستودع')}</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId} disabled={warehousesLoading || warehouseOptions.length === 0}>
              <SelectTrigger id="return-warehouse" className="w-full">
                <SelectValue placeholder={t('Select warehouse…', 'اختر المستودع…')} />
              </SelectTrigger>
              <SelectContent>
                {warehouseOptions.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-order-ref">{t('OMS order # / ID / client reference', 'رقم OMS / المعرّف / المرجع الخارجي')}</Label>
            <div className="flex gap-2">
              <Input
                id="return-order-ref"
                value={orderReference}
                onChange={(e) => {
                  setOrderReference(e.target.value)
                  setResolveState('idle')
                  setResolveError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void resolveOrder(orderReference)
                  }
                }}
                placeholder={t('Search order…', 'بحث عن طلب…')}
              />
              <Button type="button" variant="secondary" disabled={resolveState === 'loading' || !orderReference.trim()} onClick={() => void resolveOrder(orderReference)}>
                {resolveState === 'loading' ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t('Load', 'تحميل')}
              </Button>
            </div>
            {resolveState === 'error' && resolveError ? (
              <p role="alert" className="text-sm text-tone-danger-fg">
                {resolveError}
              </p>
            ) : null}
            {resolveState === 'ready' && orderNumber ? (
              <p className="text-sm text-muted-foreground">
                {t('Order', 'الطلب')}: <span className="font-medium text-foreground">{orderNumber}</span>
              </p>
            ) : null}
          </div>

          {lines.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-start text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t('Product', 'المنتج')}</th>
                    <th className="px-3 py-2 text-end tabular">{t('Returnable', 'قابل للإرجاع')}</th>
                    <th className="px-3 py-2 text-end">{t('Return qty', 'كمية الإرجاع')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line) => (
                    <tr key={line.productId}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{line.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-end tabular">{line.returnable}</td>
                      <td className="px-3 py-2 text-end">
                        <Input
                          type="number"
                          min={0}
                          max={line.returnable}
                          step={isDiscreteUom(line.uom) ? 1 : 'any'}
                          className="ms-auto w-24 text-end tabular"
                          value={returnQty[line.productId] ?? '0'}
                          onChange={(e) => setReturnQty((prev) => ({ ...prev, [line.productId]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOrderReference('')}>
            <Trash2 className="size-4" aria-hidden />
            {t('Clear order', 'مسح الطلب')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={createMut.isPending}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button type="button" disabled={createMut.isPending || resolveState !== 'ready'} onClick={() => createMut.mutate()}>
              {createMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {t('Create return', 'إنشاء مرتجع')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
