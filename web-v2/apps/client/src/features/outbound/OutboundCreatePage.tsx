import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '@/lib/order-planning-dates'
import { fetchProductAvailability } from '@/services/clientInventoryService'
import {
  createClientOutboundOrder,
  type CreateClientOutboundOrderInput,
} from '@/services/clientOutboundOrdersService'
import {
  fetchClientProducts,
  type ClientProductRow,
} from '@/services/clientProductsService'
import { SectionHeading } from './outbound-ui'

type DraftLine = { productId: string; requestedQuantity: string }

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

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'
}

export function OutboundCreatePage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const billingAccess = useClientOperationalAccess(isArabic)

  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd())
  const [destination, setDestination] = useState('')
  const [carrier, setCarrier] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', requestedQuantity: '' }])
  const [error, setError] = useState<string | null>(null)

  const products = useQuery({
    queryKey: ['client', 'products', 'create-outbound'],
    queryFn: () => fetchClientProducts({ limit: 200 }),
    enabled: billingAccess.operationalAllowed,
    staleTime: 5 * 60_000,
  })

  const productCount = products.data?.items?.length ?? 0
  const canAddLine = productCount > 0 && lines.length < productCount

  useEffect(() => {
    if (!products.isSuccess) return
    const max = products.data?.items?.length ?? 0
    if (max <= 0) {
      setLines([{ productId: '', requestedQuantity: '' }])
      return
    }
    setLines((prev) => (prev.length > max ? prev.slice(0, max) : prev))
  }, [products.isSuccess, products.data?.items?.length])

  const createMut = useMutation({
    mutationFn: (input: CreateClientOutboundOrderInput) => createClientOutboundOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'outbound-orders'] })
      navigate(`/outbound-orders/${order.id}`)
    },
    onError: (err: Error) =>
      setError(err.message || t('Could not submit order.', 'تعذر إرسال الطلب.')),
  })

  const productOptions = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name} · ${p.uom} · on hand ${formatOnHand(p)}`,
      })),
    [products.data],
  )

  const productsById = useMemo(() => {
    const m = new Map<string, ClientProductRow>()
    for (const p of products.data?.items ?? []) m.set(p.id, p)
    return m
  }, [products.data])

  const optionsForLine = (lineIdx: number) => {
    const taken = new Set(
      lines
        .map((l, i) => (i !== lineIdx && l.productId ? l.productId : null))
        .filter((id): id is string => Boolean(id)),
    )
    return productOptions.filter((o) => !taken.has(o.value))
  }

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  )

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: ['client', 'availability', pid],
      queryFn: () => fetchProductAvailability(pid),
      enabled: billingAccess.operationalAllowed && !!pid,
      staleTime: 10_000,
    })),
  })

  const availabilityByProduct = useMemo(() => {
    const m = new Map<string, number>()
    distinctProductIds.forEach((pid, i) => {
      const r = availabilityResults[i]?.data
      if (r) m.set(pid, Number(r.available))
    })
    return m
  }, [availabilityResults, distinctProductIds])

  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lines) {
      if (!l.productId || !isPositiveIntegerString(l.requestedQuantity)) continue
      const n = Number(l.requestedQuantity)
      m.set(l.productId, (m.get(l.productId) ?? 0) + n)
    }
    return m
  }, [lines])

  const shortages = useMemo(() => {
    const out: { productId: string; requested: number; available: number }[] = []
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid)
      if (avail !== undefined && qty > avail) {
        out.push({ productId: pid, requested: qty, available: avail })
      }
    })
    return out
  }, [availabilityByProduct, requestedByProduct])

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    if (patch.productId) {
      const alreadyUsed = lines.some((l, i) => i !== idx && l.productId === patch.productId)
      if (alreadyUsed) {
        setError(t('Each product can only be added once.', 'يمكن إضافة كل منتج مرة واحدة فقط.'))
        return
      }
    }
    setError(null)
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  useEffect(() => {
    setLines((prev) => {
      let changed = false
      const next = prev.map((l) => {
        if (!l.productId || !isPositiveIntegerString(l.requestedQuantity)) return l
        const avail = availabilityByProduct.get(l.productId)
        if (avail === undefined) return l
        const max = Math.floor(avail)
        const qty = Number(l.requestedQuantity)
        if (max < 1) {
          if (l.requestedQuantity === '') return l
          changed = true
          return { ...l, requestedQuantity: '' }
        }
        if (qty > max) {
          changed = true
          return { ...l, requestedQuantity: String(max) }
        }
        return l
      })
      return changed ? next : prev
    })
  }, [availabilityByProduct])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t(
            'Creating orders is not available for your account right now.',
            'إنشاء الطلبات غير متاح لحسابك حالياً.',
          ),
      )
      return
    }
    if (!destination.trim()) {
      setError(t('Destination is required.', 'الوجهة مطلوبة.'))
      return
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError(t('Required ship date cannot be before today.', 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.'))
      return
    }
    const incomplete = lines.some(
      (l) => l.productId && !isPositiveIntegerString(l.requestedQuantity),
    )
    if (incomplete) {
      setError(
        t(
          'Quantity must be a positive whole number (1, 2, 3, …).',
          'يجب أن تكون الكمية عدداً صحيحاً موجباً (1، 2، 3، …).',
        ),
      )
      return
    }
    const overStock = lines.some((l) => {
      if (!l.productId || !isPositiveIntegerString(l.requestedQuantity)) return false
      const avail = availabilityByProduct.get(l.productId)
      if (avail === undefined) return false
      return Number(l.requestedQuantity) > Math.floor(avail)
    })
    if (overStock || shortages.length > 0) {
      setError(t('Quantity cannot exceed available stock.', 'لا يمكن أن تتجاوز الكمية المخزون المتاح.'))
      return
    }
    const payloadLines = lines
      .filter((l) => l.productId && isPositiveIntegerString(l.requestedQuantity))
      .map((l) => ({
        productId: l.productId,
        requestedQuantity: Number(l.requestedQuantity),
      }))
    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity.', 'أضف بنداً واحداً على الأقل بكمية.'))
      return
    }
    const productIds = payloadLines.map((l) => l.productId)
    if (new Set(productIds).size !== productIds.length) {
      setError(t('Each product can only be added once.', 'يمكن إضافة كل منتج مرة واحدة فقط.'))
      return
    }
    setError(null)
    createMut.mutate({
      destinationAddress: destination.trim(),
      requiredShipDate: shipDate,
      carrier: carrier.trim() || undefined,
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
          to="/outbound-orders"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to outbound orders', 'العودة إلى طلبات الصادر')}
        </Link>
        <PageHeader
          title={t('New outbound order', 'طلب صادر جديد')}
          description={t(
            'Create a warehouse shipment request',
            'إنشاء طلب شحن صادر من المستودع',
          )}
        />
      </div>

      {!billingAccess.operationalAllowed ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Action blocked', 'الإجراء محظور')}</AlertTitle>
          <AlertDescription>
            {billingAccess.actionBlockedReason ||
              t(
                'Creating orders is not available for your account right now.',
                'إنشاء الطلبات غير متاح لحسابك حالياً.',
              )}
          </AlertDescription>
        </Alert>
      ) : null}

      {products.isError ? (
        <ErrorState
          title={t('Could not load products', 'تعذر تحميل المنتجات')}
          description={(products.error as Error)?.message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void products.refetch()}
        />
      ) : null}

      <form id="create-client-outbound" onSubmit={submit} className="space-y-8">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <SectionHeading title={t('Shipping information', 'معلومات الشحن')} />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="destination">
                {t('Destination', 'الوجهة')}
                <span className="ms-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={fieldsDisabled}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ship-date">
                  {t('Required ship date', 'تاريخ الشحن المطلوب')}
                  <span className="ms-0.5 text-destructive" aria-hidden>
                    *
                  </span>
                </Label>
                <Input
                  id="ship-date"
                  type="date"
                  min={localCalendarDateYmd()}
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                  disabled={fieldsDisabled}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carrier">{t('Carrier', 'الناقل')}</Label>
                <Input
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  disabled={fieldsDisabled}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t('Notes', 'ملاحظات')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={t(
                  'Add any notes about this outbound order...',
                  'أضف أي ملاحظات حول طلب الصادر هذا...',
                )}
                disabled={fieldsDisabled}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <SectionHeading title={t('Products', 'المنتجات')} />

          <div className="space-y-3">
            <div className="hidden gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_140px_40px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('Product', 'المنتج')}
                <span className="ms-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('Quantity', 'الكمية')}
                <span className="ms-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </span>
              <span className="sr-only">{t('Remove', 'إزالة')}</span>
            </div>

            {lines.map((row, idx) => {
              const product = row.productId ? productsById.get(row.productId) : undefined
              const avail = row.productId ? availabilityByProduct.get(row.productId) : undefined
              const maxQty = avail !== undefined ? Math.floor(avail) : undefined
              const summed = row.productId ? (requestedByProduct.get(row.productId) ?? 0) : 0
              const isShort = avail !== undefined && summed > avail

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]"
                >
                  <div className="min-w-0 space-y-1.5">
                    <Label className="sm:sr-only" htmlFor={`product-${idx}`}>
                      {t('Product', 'المنتج')}
                    </Label>
                    <Combobox
                      id={`product-${idx}`}
                      value={row.productId}
                      onChange={(v) => updateLine(idx, { productId: v, requestedQuantity: '' })}
                      options={optionsForLine(idx)}
                      placeholder={t('Search and select a product...', 'ابحث واختر منتجاً...')}
                      emptyLabel={t('No available products', 'لا توجد منتجات متاحة')}
                      disabled={fieldsDisabled || products.isLoading}
                    />
                    {product ? (
                      <p className="text-sm text-muted-foreground">
                        {t('Current quantity:', 'الكمية الحالية:')}{' '}
                        <span className="font-mono font-semibold text-foreground">
                          {formatOnHand(product)}
                        </span>{' '}
                        <span className="uppercase">{product.uom}</span>
                      </p>
                    ) : null}
                    {avail !== undefined ? (
                      <p
                        className={`text-sm ${isShort ? 'text-destructive' : 'text-primary'}`}
                      >
                        {t('Available', 'المتاح')}:{' '}
                        {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {isShort
                          ? ` · ${t('Exceeds available stock', 'يتجاوز المخزون المتاح')}`
                          : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="sm:sr-only" htmlFor={`qty-${idx}`}>
                      {t('Quantity', 'الكمية')}
                    </Label>
                    <Input
                      id={`qty-${idx}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[1-9][0-9]*"
                      aria-invalid={isShort || undefined}
                      value={row.requestedQuantity}
                      onChange={(e) => {
                        const next = clampPositiveIntegerToMax(e.target.value, maxQty)
                        if (next === null) return
                        updateLine(idx, { requestedQuantity: next })
                      }}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault()
                      }}
                      disabled={fieldsDisabled || !row.productId}
                      placeholder={
                        row.productId
                          ? t('Enter Qty', 'أدخل الكمية')
                          : t('Select a product first', 'اختر منتجاً أولاً')
                      }
                      required={Boolean(row.productId)}
                    />
                  </div>
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

            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]">
              <div className="hidden sm:block" />
              <div className="hidden sm:block" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 justify-self-start sm:justify-self-auto"
                aria-label={t('+ Add line', '+ إضافة بند')}
                title={
                  !canAddLine && productCount > 0
                    ? t('All products already added', 'تمت إضافة كل المنتجات')
                    : t('+ Add line', '+ إضافة بند')
                }
                disabled={fieldsDisabled || !canAddLine}
                onClick={() => {
                  if (!canAddLine) return
                  setLines((prev) => [...prev, { productId: '', requestedQuantity: '' }])
                }}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          {shortages.length > 0 ? (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              <strong className="block">
                {t(
                  'Order cannot be created — insufficient stock:',
                  'لا يمكن إنشاء الطلب — مخزون غير كافٍ:',
                )}
              </strong>
              <ul className="mt-1 list-disc ps-4">
                {shortages.map((s) => {
                  const p = products.data?.items.find((x) => x.id === s.productId)
                  return (
                    <li key={s.productId}>
                      {p ? `${p.sku} — ${p.name}` : s.productId}: {t('requested', 'مطلوب')}{' '}
                      {s.requested}, {t('available', 'متاح')} {s.available}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate('/outbound-orders')}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            type="submit"
            disabled={loading || !billingAccess.operationalAllowed || shortages.length > 0}
          >
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t('Submit for approval', 'إرسال للموافقة')}
          </Button>
        </div>
      </form>
    </div>
  )
}
