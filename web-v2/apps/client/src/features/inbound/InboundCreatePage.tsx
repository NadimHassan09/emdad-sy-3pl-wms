import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { Link, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Textarea } from '@emdad/ui/ui/textarea'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '@/lib/order-planning-dates'
import {
  createClientInboundOrder,
  type CreateClientInboundOrderInput,
} from '@/services/clientInboundOrdersService'
import {
  fetchClientProducts,
  type ClientProductRow,
} from '@/services/clientProductsService'
import {
  isPositiveIntegerString,
  sanitizePositiveIntegerInput,
  SectionHeading,
} from './inbound-ui'

type DraftLine = { productId: string; expectedQuantity: string }

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'
}

export function InboundCreatePage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const billingAccess = useClientOperationalAccess(isArabic)

  const [arrival, setArrival] = useState(() => localCalendarDateYmd())
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', expectedQuantity: '' }])
  const [error, setError] = useState<string | null>(null)

  const products = useQuery({
    queryKey: ['client', 'products', 'create-inbound'],
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
      setLines([{ productId: '', expectedQuantity: '' }])
      return
    }
    setLines((prev) => (prev.length > max ? prev.slice(0, max) : prev))
  }, [products.isSuccess, products.data?.items?.length])

  const createMut = useMutation({
    mutationFn: (input: CreateClientInboundOrderInput) => createClientInboundOrder(input),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'inbound-orders'] })
      navigate(`/inbound-orders/${order.id}`)
    },
    onError: (err: Error) =>
      setError(err.message || t('Could not submit order.', 'تعذر إرسال الطلب.')),
  })

  const productOptions = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
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
    if (!isYmdOnOrAfterLocalToday(arrival)) {
      setError(
        t(
          'Expected arrival date cannot be before today.',
          'لا يمكن أن يكون تاريخ الوصول قبل اليوم.',
        ),
      )
      return
    }
    const incomplete = lines.some(
      (l) => l.productId && !isPositiveIntegerString(l.expectedQuantity),
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
    const payloadLines = lines
      .filter((l) => l.productId && isPositiveIntegerString(l.expectedQuantity))
      .map((l) => ({
        productId: l.productId,
        expectedQuantity: Number(l.expectedQuantity),
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
      expectedArrivalDate: arrival,
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
          to="/inbound-orders"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to inbound orders', 'العودة إلى طلبات الوارد')}
        </Link>
        <PageHeader
          title={t('New inbound order', 'طلب وارد جديد')}
          description={t('Create a warehouse receipt request', 'إنشاء طلب إيصال وارد للمستودع')}
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

      <form id="create-client-inbound" onSubmit={submit} className="space-y-8">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <SectionHeading title={t('General information', 'المعلومات العامة')} />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="expected-arrival">
                {t('Expected arrival date', 'تاريخ الوصول المتوقع')}
                <span className="ms-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="expected-arrival"
                type="date"
                required
                min={localCalendarDateYmd()}
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inbound-notes">{t('Notes', 'ملاحظات')}</Label>
              <Textarea
                id="inbound-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={t(
                  'Add any notes about this inbound order...',
                  'أضف أي ملاحظات حول طلب الوارد هذا...',
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
                      onChange={(v) => updateLine(idx, { productId: v, expectedQuantity: '' })}
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
                      value={row.expectedQuantity}
                      onChange={(e) => {
                        const next = sanitizePositiveIntegerInput(e.target.value)
                        if (next === null) return
                        updateLine(idx, { expectedQuantity: next })
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
                  setLines((prev) => [...prev, { productId: '', expectedQuantity: '' }])
                }}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate('/inbound-orders')}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={loading || !billingAccess.operationalAllowed}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t('Submit for approval', 'إرسال للموافقة')}
          </Button>
        </div>
      </form>
    </div>
  )
}
