import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ErrorState, Link, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Textarea } from '@emdad/ui/ui/textarea'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import {
  fetchClientOutboundOrder,
  fetchClientOutboundOrders,
} from '@/services/clientOutboundOrdersService'
import {
  createClientReturn,
  fetchClientOutboundReturnQuota,
  type CreateClientReturnInput,
} from '@/services/clientReturnsService'

const MAX_RETURN_LINES = 50
const BASE_PATH = '/outbound-orders/returns'

type DraftLine = {
  productId: string
  outboundOrderLineId: string
  expectedQuantity: string
}

const emptyLine = (): DraftLine => ({
  productId: '',
  outboundOrderLineId: '',
  expectedQuantity: '',
})

function isPositiveIntegerString(value: string): boolean {
  return /^[1-9]\d*$/.test(value)
}

function sanitizePositiveIntegerInput(raw: string): string | null {
  if (raw === '') return ''
  if (!/^[1-9]\d*$/.test(raw)) return null
  return raw
}

function clampPositiveIntegerToMax(raw: string, maxAvailable: number | undefined): string | null {
  const next = sanitizePositiveIntegerInput(raw)
  if (next === null) return null
  if (next === '') return ''
  if (maxAvailable === undefined) return next
  const max = Math.floor(maxAvailable)
  if (max < 1) return ''
  return Number(next) > max ? String(max) : next
}

type ProductOption = {
  productId: string
  outboundOrderLineId: string
  label: string
  hint?: string
  maxQty: number
  uom?: string
}

export function OutboundReturnCreatePage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const billingAccess = useClientOperationalAccess(isArabic)

  const [outboundId, setOutboundId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [error, setError] = useState<string | null>(null)

  const shippedOrders = useQuery({
    queryKey: ['client', 'outbound-orders', 'returns-create'],
    queryFn: () => fetchClientOutboundOrders({ limit: 100, status: 'shipped' }),
    enabled: billingAccess.operationalAllowed,
    staleTime: 60_000,
  })

  const outboundDetail = useQuery({
    queryKey: ['client', 'outbound-orders', outboundId],
    queryFn: () => fetchClientOutboundOrder(outboundId),
    enabled: !!outboundId,
  })

  const quota = useQuery({
    queryKey: ['client', 'returns', 'outbound-quota', outboundId],
    queryFn: () => fetchClientOutboundReturnQuota(outboundId),
    enabled: billingAccess.operationalAllowed && !!outboundId,
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: (input: CreateClientReturnInput) => createClientReturn(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'returns'] })
      navigate(`${BASE_PATH}/${order.id}`)
    },
    onError: (err: Error) => setError(err.message || t('Could not create return.', 'تعذر إنشاء المرتجع.')),
  })

  const orderOptions = useMemo(
    () =>
      (shippedOrders.data?.items ?? []).map((o) => ({
        value: o.id,
        label: `${o.orderNumber} · ${o.status}${o.recipientName ? ` · ${o.recipientName}` : ''}`,
      })),
    [shippedOrders.data],
  )

  const quotaByLineId = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of quota.data?.lines ?? []) {
      m.set(q.outboundOrderLineId, Number(q.remaining))
    }
    return m
  }, [quota.data])

  const productOptions: ProductOption[] = useMemo(() => {
    if (!outboundId || !outboundDetail.data) return []
    return (outboundDetail.data.lines ?? []).map((l) => {
      const remaining = quotaByLineId.get(l.id) ?? Number(l.pickedQuantity ?? l.requestedQuantity)
      return {
        productId: l.product.id,
        outboundOrderLineId: l.id,
        label: `${l.product.sku} — ${l.product.name}`,
        hint: `${t('remaining', 'متبقي')} ${remaining}`,
        maxQty: Math.max(0, Math.floor(remaining)),
        uom: l.product.uom ?? undefined,
      }
    })
  }, [outboundId, outboundDetail.data, quotaByLineId, isArabic]) // eslint-disable-line react-hooks/exhaustive-deps

  const productsById = useMemo(() => {
    const m = new Map<string, ProductOption>()
    for (const o of productOptions) m.set(o.productId, o)
    return m
  }, [productOptions])

  const optionsForLine = (lineIdx: number) => {
    const taken = new Set(
      lines
        .map((l, i) => (i !== lineIdx && l.productId ? l.productId : null))
        .filter((id): id is string => Boolean(id)),
    )
    return productOptions
      .filter((o) => !taken.has(o.productId) || o.productId === lines[lineIdx]?.productId)
      .filter((o) => o.maxQty > 0 || o.productId === lines[lineIdx]?.productId)
      .map((o) => ({ value: o.productId, label: o.hint ? `${o.label} (${o.hint})` : o.label }))
  }

  const productCount = productOptions.filter((o) => o.maxQty > 0).length
  const canAddLine = productCount > 0 && lines.length < Math.min(MAX_RETURN_LINES, productCount)

  useEffect(() => {
    setLines([emptyLine()])
  }, [outboundId])

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    if (patch.productId) {
      const alreadyUsed = lines.some((l, i) => i !== idx && l.productId === patch.productId)
      if (alreadyUsed) {
        setError(t('Each product can only be added once.', 'يمكن إضافة كل منتج مرة واحدة فقط.'))
        return
      }
      const opt = productsById.get(patch.productId)
      patch.outboundOrderLineId = opt?.outboundOrderLineId ?? ''
    }
    setError(null)
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t(
            'Creating returns is not available for your account right now.',
            'إنشاء المرتجعات غير متاح لحسابك حالياً.',
          ),
      )
      return
    }
    if (!outboundId) {
      setError(t('Linked order is required.', 'الطلب المرتبط مطلوب.'))
      return
    }

    const seen = new Set<string>()
    const payloadLines: CreateClientReturnInput['lines'] = []

    for (const row of lines) {
      if (!row.productId) continue
      if (!isPositiveIntegerString(row.expectedQuantity)) {
        setError(
          t(
            'Quantity must be a positive whole number (1, 2, 3, …).',
            'يجب أن تكون الكمية عدداً صحيحاً موجباً (1، 2، 3، …).',
          ),
        )
        return
      }
      if (seen.has(row.productId)) {
        setError(t('Each product can only be added once.', 'يمكن إضافة كل منتج مرة واحدة فقط.'))
        return
      }
      seen.add(row.productId)
      const qty = Number(row.expectedQuantity)
      const opt = productsById.get(row.productId)
      const max = opt?.maxQty ?? 0
      if (qty > max) {
        setError(t('Quantity exceeds returnable remaining.', 'الكمية تتجاوز المتبقي القابل للإرجاع.'))
        return
      }
      payloadLines.push({
        productId: row.productId,
        expectedQuantity: qty,
        outboundOrderLineId: row.outboundOrderLineId || opt?.outboundOrderLineId,
      })
    }

    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity.', 'أضف بنداً واحداً على الأقل بكمية.'))
      return
    }

    setError(null)
    createMut.mutate({
      originalOutboundOrderId: outboundId,
      notes: notes.trim() || undefined,
      lines: payloadLines,
    })
  }

  const loading = createMut.isPending
  const fieldsDisabled = loading || !billingAccess.operationalAllowed

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          to={BASE_PATH}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to returns', 'العودة إلى المرتجعات')}
        </Link>
        <PageHeader
          title={t('New warehouse return', 'مرتجع مستودع جديد')}
          description={t('Return items from a shipped outbound order', 'إرجاع أصناف من طلب صادر مشحون')}
        />
      </div>

      {!billingAccess.operationalAllowed ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Action blocked', 'الإجراء محظور')}</AlertTitle>
          <AlertDescription>
            {billingAccess.actionBlockedReason ||
              t(
                'Creating returns is not available for your account right now.',
                'إنشاء المرتجعات غير متاح لحسابك حالياً.',
              )}
          </AlertDescription>
        </Alert>
      ) : null}

      {shippedOrders.isError ? (
        <ErrorState
          title={t('Could not load orders', 'تعذر تحميل الطلبات')}
          description={(shippedOrders.error as Error)?.message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void shippedOrders.refetch()}
        />
      ) : null}

      <form id="create-client-outbound-return" onSubmit={submit} className="space-y-8">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-1.5">
            <Label htmlFor="linked-outbound">
              {t('Linked outbound order', 'طلب الصادر المرتبط')}
              <span className="ms-0.5 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Combobox
              id="linked-outbound"
              value={outboundId}
              onChange={(v) => {
                setOutboundId(v)
                setError(null)
              }}
              options={orderOptions}
              placeholder={t('Select order…', 'اختر الطلب…')}
              emptyLabel={t('No shipped orders available.', 'لا توجد طلبات مشحونة متاحة.')}
              disabled={fieldsDisabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-notes">{t('Return reason / notes', 'سبب الإرجاع / ملاحظات')}</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={fieldsDisabled}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('Products', 'المنتجات')}
          </h2>

          <div className="space-y-3">
            {lines.map((row, idx) => {
              const product = row.productId ? productsById.get(row.productId) : undefined
              const maxQty = product?.maxQty
              const isShort =
                maxQty !== undefined &&
                isPositiveIntegerString(row.expectedQuantity) &&
                Number(row.expectedQuantity) > maxQty

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                >
                  <div className="min-w-0 space-y-1.5">
                    <Combobox
                      id={`product-${idx}`}
                      value={row.productId}
                      onChange={(v) => updateLine(idx, { productId: v, expectedQuantity: '' })}
                      options={optionsForLine(idx)}
                      placeholder={
                        outboundId
                          ? t('Search and select a product...', 'ابحث واختر منتجاً...')
                          : t('Select a linked order first', 'اختر الطلب المرتبط أولاً')
                      }
                      emptyLabel={t('No available products', 'لا توجد منتجات متاحة')}
                      disabled={fieldsDisabled || !outboundId}
                    />
                    {product ? (
                      <p className="text-sm text-muted-foreground">
                        {t('Available', 'المتاح')}:{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {product.maxQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                        {isShort ? (
                          <span className="ms-1 text-destructive">
                            · {t('Exceeds available', 'يتجاوز المتاح')}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    id={`qty-${idx}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[1-9][0-9]*"
                    aria-invalid={isShort || undefined}
                    value={row.expectedQuantity}
                    onChange={(e) => {
                      const next = clampPositiveIntegerToMax(e.target.value, maxQty)
                      if (next === null) return
                      updateLine(idx, { expectedQuantity: next })
                    }}
                    disabled={fieldsDisabled || !row.productId}
                    placeholder={t('Qty', 'الكمية')}
                    required={Boolean(row.productId)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10"
                    aria-label={t('Remove', 'إزالة')}
                    disabled={fieldsDisabled || lines.length <= 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              )
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fieldsDisabled || !canAddLine}
              onClick={() => {
                if (!canAddLine) return
                setLines((prev) => [...prev, emptyLine()])
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t('+ Add line', '+ إضافة بند')}
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          <Button type="button" variant="ghost" disabled={loading} onClick={() => navigate(BASE_PATH)}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={loading || !billingAccess.operationalAllowed}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t('Create return', 'إنشاء المرتجع')}
          </Button>
        </div>
      </form>
    </div>
  )
}
