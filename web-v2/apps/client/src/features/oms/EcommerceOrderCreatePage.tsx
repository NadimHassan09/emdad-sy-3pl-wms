import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { PageHeader, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '@/lib/order-planning-dates'
import { isValidRecipientName } from '@/lib/recipient-contact'
import { fetchProductAvailability } from '@/services/clientInventoryService'
import {
  createClientOmsOrder,
  type ClientOmsPaymentMethod,
  type CreateClientOmsOrderInput,
} from '@/services/clientOmsOrdersService'
import { fetchClientProducts, type ClientProductRow } from '@/services/clientProductsService'
import { OmsCascadingAddressFields } from './oms-cascading-address'
import {
  OmsRecipientNameField,
  OmsRecipientPhoneField,
  emptyRecipientPhone,
  evaluatePhone,
  type RecipientPhoneState,
} from './oms-recipient-fields'
import { SectionHeading } from './oms-ui'

type DraftLine = {
  key: string
  productId: string
  requestedQuantity: string
  unitPrice: string
}

const emptyLine = (): DraftLine => ({
  key: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  productId: '',
  requestedQuantity: '1',
  unitPrice: '',
})

function formatAvailable(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '…'
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalAvailable ?? p.totalOnHand ?? 0)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'
}

export function EcommerceOrderCreatePage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const billing = useClientOperationalAccess(isArabic)

  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd())
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState<RecipientPhoneState>(() => emptyRecipientPhone())
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [deliveryLat, setDeliveryLat] = useState('')
  const [deliveryLng, setDeliveryLng] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<ClientOmsPaymentMethod | ''>('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [error, setError] = useState<string | null>(null)

  const phoneEval = evaluatePhone(recipientPhone)
  const fieldsDisabled = !billing.operationalAllowed

  const products = useQuery({
    queryKey: ['client', 'products', 'create-oms'],
    queryFn: () => fetchClientProducts({ limit: 200 }),
    enabled: billing.operationalAllowed,
    staleTime: 5 * 60_000,
  })

  const activeProducts = useMemo(
    () => (products.data?.items ?? []).filter((p) => p.status === 'active'),
    [products.data],
  )

  const productById = useMemo(() => {
    const map = new Map<string, ClientProductRow>()
    for (const p of activeProducts) map.set(p.id, p)
    return map
  }, [activeProducts])

  const usedProductIds = useMemo(
    () => new Set(lines.map((l) => l.productId).filter(Boolean)),
    [lines],
  )

  const optionsForLine = (lineKey: string) => {
    const currentId = lines.find((l) => l.key === lineKey)?.productId
    return activeProducts
      .filter((p) => p.id === currentId || !usedProductIds.has(p.id))
      .map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name} · ${p.uom} · ${formatOnHand(p)}`,
      }))
  }

  const canAddLine = activeProducts.some((p) => !usedProductIds.has(p.id))

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  )

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: ['client', 'availability', pid],
      queryFn: () => fetchProductAvailability(pid),
      enabled: billing.operationalAllowed && !!pid,
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
      if (!l.productId) continue
      const n = Number(l.requestedQuantity)
      if (!Number.isFinite(n) || n <= 0) continue
      m.set(l.productId, (m.get(l.productId) ?? 0) + n)
    }
    return m
  }, [lines])

  const shortages = useMemo(() => {
    const out: { productId: string; requested: number; available: number }[] = []
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid)
      if (avail !== undefined && qty > avail) out.push({ productId: pid, requested: qty, available: avail })
    })
    return out
  }, [availabilityByProduct, requestedByProduct])

  const clampNonNegativeQty = (raw: string): string => {
    if (raw === '') return raw
    const n = Number(raw)
    if (!Number.isFinite(n)) return raw
    if (n < 0) return '0'
    return raw
  }

  const linesSum = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = Number(l.requestedQuantity)
        const price = Number(l.unitPrice)
        if (!l.productId || !(qty > 0) || !(price >= 0) || Number.isNaN(price)) return sum
        return sum + qty * price
      }, 0),
    [lines],
  )

  const totalItems = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = Number(l.requestedQuantity)
        if (!l.productId || !(qty > 0)) return sum
        return sum + qty
      }, 0),
    [lines],
  )

  const createMut = useMutation({
    mutationFn: (payload: CreateClientOmsOrderInput) => createClientOmsOrder(payload),
    onSuccess: (order) => {
      toast.success(t('Order created.', 'تم إنشاء الطلب.'))
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] })
      navigate(`/ecommerce-orders/${order.id}`)
    },
    onError: (err: Error) =>
      setError(err.message || t('Could not submit order.', 'تعذر إرسال الطلب.')),
  })

  const loading = createMut.isPending
  const disabled = loading || fieldsDisabled

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!billing.operationalAllowed) {
      setError(
        billing.actionBlockedReason ||
          t(
            'Creating orders is not available for your account right now.',
            'إنشاء الطلبات غير متاح لحسابك حالياً.',
          ),
      )
      return
    }
    setContactSubmitted(true)

    if (!recipientName.trim()) {
      setError(t('Recipient name is required.', 'اسم المستلم مطلوب.'))
      return
    }
    if (!isValidRecipientName(recipientName)) {
      setError(
        t(
          'Name can only contain Arabic or English letters and spaces.',
          'الاسم يقبل حروف عربية أو إنجليزية ومسافات فقط.',
        ),
      )
      return
    }
    if (phoneEval.isEmpty || !phoneEval.isValid) {
      setError(t('Recipient phone is required.', 'رقم هاتف المستلم مطلوب.'))
      return
    }
    if (!city.trim() || !district.trim() || !addressLine1.trim()) {
      setError(
        t(
          'Governorate, City/Region, and Town/Neighborhood are required.',
          'المحافظة والمدينة/المنطقة والبلدة/الحي مطلوبة.',
        ),
      )
      return
    }
    if (!paymentMethod) {
      setError(t('Payment method is required.', 'طريقة الدفع مطلوبة.'))
      return
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError(
        t('Required ship date cannot be before today.', 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.'),
      )
      return
    }

    const payloadLines: CreateClientOmsOrderInput['lines'] = []
    for (const l of lines) {
      if (!l.productId.trim()) {
        setError(t('Product is required on every line.', 'المنتج مطلوب في كل سطر.'))
        return
      }
      if (!l.requestedQuantity.trim()) {
        setError(t('Qty is required on every line.', 'الكمية مطلوبة في كل سطر.'))
        return
      }
      const qty = Number(l.requestedQuantity)
      const unitPrice = Number(l.unitPrice)
      if (!(qty > 0) || !Number.isFinite(qty)) {
        setError(t('Qty must be a positive number.', 'الكمية يجب أن تكون رقمًا موجبًا.'))
        return
      }
      if (Number.isNaN(unitPrice) || unitPrice < 0 || l.unitPrice.trim() === '') {
        setError(t('Each product line needs a valid price.', 'كل بند يحتاج سعراً صالحاً.'))
        return
      }
      payloadLines.push({ productId: l.productId, requestedQuantity: qty, unitPrice })
    }
    if (payloadLines.length === 0) {
      setError(
        t('Add at least one line with quantity and price.', 'أضف بنداً واحداً على الأقل بكمية وسعر.'),
      )
      return
    }

    setError(null)
    createMut.mutate({
      requiredShipDate: shipDate,
      recipientName: recipientName.trim() || undefined,
      recipientPhone: phoneEval.e164 || undefined,
      shippingPhoneCountry: phoneEval.countryIso || undefined,
      city: city.trim() || undefined,
      district: district.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      addressLine2: addressLine2.trim() || undefined,
      shippingReceiverLat: deliveryLat.trim() ? Number(deliveryLat) : undefined,
      shippingReceiverLng: deliveryLng.trim() ? Number(deliveryLng) : undefined,
      notes: notes.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      lines: payloadLines,
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/ecommerce-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('Back to online orders', 'العودة إلى الطلبات الإلكترونية')}
      </Link>

      <PageHeader
        title={t('New online order', 'طلب إلكتروني جديد')}
        description={t('Create an order from your store channel', 'أنشئ طلباً من قناة متجرك')}
      />

      {!billing.operationalAllowed ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {billing.actionBlockedReason ||
            t(
              'Creating orders is not available for your account right now.',
              'إنشاء الطلبات غير متاح لحسابك حالياً.',
            )}
        </p>
      ) : null}

      <form id="create-client-oms" onSubmit={submit} className="space-y-8">
        {error ? (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-3">
          <SectionHeading title={t('Shipping information', 'معلومات الشحن')} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <OmsRecipientNameField
              label={t('Recipient name', 'اسم المستلم')}
              value={recipientName}
              onChange={setRecipientName}
              disabled={disabled}
              submitted={contactSubmitted}
              required
              isArabic={isArabic}
            />
            <OmsRecipientPhoneField
              label={t('Recipient phone', 'هاتف المستلم')}
              value={recipientPhone}
              onChange={setRecipientPhone}
              disabled={disabled}
              submitted={contactSubmitted}
              required
              isArabic={isArabic}
            />
            <OmsCascadingAddressFields
              value={{ city, district, addressLine1 }}
              onChange={(next) => {
                setCity(next.city)
                setDistrict(next.district)
                setAddressLine1(next.addressLine1)
              }}
              cityLabel={t('Governorate', 'المحافظة')}
              districtLabel={t('City/Region', 'المدينة/المنطقة')}
              addressLine1Label={t('Town/Neighborhood', 'الحي/البلدة')}
              disabled={disabled}
              cityRequired
              districtRequired
              addressLine1Required
            />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="oms-address-line2" className="text-sm">
                {t('Street / detailed address', 'الشارع / العنوان التفصيلي')}
              </Label>
              <Input
                id="oms-address-line2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                disabled={disabled}
                placeholder={t('Street name, building, floor…', 'اسم الشارع، البناء، الطابق…')}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oms-lat" className="text-sm">
                {t('Latitude (optional)', 'خط العرض (اختياري)')}
              </Label>
              <Input
                id="oms-lat"
                type="number"
                step="any"
                value={deliveryLat}
                onChange={(e) => setDeliveryLat(e.target.value)}
                disabled={disabled}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oms-lng" className="text-sm">
                {t('Longitude (optional)', 'خط الطول (اختياري)')}
              </Label>
              <Input
                id="oms-lng"
                type="number"
                step="any"
                value={deliveryLng}
                onChange={(e) => setDeliveryLng(e.target.value)}
                disabled={disabled}
                className="text-sm"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading title={t('Order details', 'تفاصيل الطلب')} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oms-ship-date" className="text-sm">
                {t('Required ship date', 'تاريخ الشحن المطلوب')}
              </Label>
              <Input
                id="oms-ship-date"
                type="date"
                required
                min={localCalendarDateYmd()}
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                disabled={disabled}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{t('Payment method', 'طريقة الدفع')}</Label>
              <Select
                value={paymentMethod || '__none'}
                onValueChange={(v) =>
                  setPaymentMethod(v === '__none' ? '' : (v as ClientOmsPaymentMethod))
                }
                disabled={disabled}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="PREPAID">{t('Prepaid', 'مدفوع مسبقاً')}</SelectItem>
                  <SelectItem value="CREDIT">{t('Credit', 'آجل')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="oms-notes" className="text-sm">
              {t('Notes', 'ملاحظات')}
            </Label>
            <Textarea
              id="oms-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={disabled}
              className="text-sm"
            />
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading title={t('Products', 'المنتجات')} />
          {lines.map((line) => {
            const p = productById.get(line.productId)
            const avail = line.productId ? availabilityByProduct.get(line.productId) : undefined
            const summed = line.productId ? (requestedByProduct.get(line.productId) ?? 0) : 0
            const isShort = avail !== undefined && summed > avail
            return (
              <div
                key={line.key}
                className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_40px]"
              >
                <div className="min-w-0 space-y-1">
                  <Combobox
                    value={line.productId}
                    onChange={(id) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                productId: id,
                                requestedQuantity: clampNonNegativeQty(l.requestedQuantity),
                              }
                            : l,
                        ),
                      )
                    }
                    options={optionsForLine(line.key)}
                    placeholder={t('Pick product…', 'اختر المنتج…')}
                    disabled={disabled}
                    emptyLabel={t('All products used', 'جميع المنتجات مستخدمة')}
                  />
                  {p ? (
                    <p className="text-sm text-muted-foreground">
                      {t('Available', 'المتاح')}:{' '}
                      <span className={`font-mono font-semibold ${isShort ? 'text-amber-700' : ''}`}>
                        {formatAvailable(avail)}
                      </span>{' '}
                      {p.uom}
                    </p>
                  ) : null}
                  {isShort ? (
                    <p className="text-sm font-medium text-amber-700">
                      {t(
                        'Exceeds available stock',
                        'يتجاوز المخزون المتاح',
                      )}
                    </p>
                  ) : null}
                </div>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  aria-label={t('Qty', 'الكمية')}
                  value={line.requestedQuantity}
                  onChange={(e) => {
                    const next = clampNonNegativeQty(e.target.value)
                    setLines((prev) =>
                      prev.map((l) => (l.key === line.key ? { ...l, requestedQuantity: next } : l)),
                    )
                  }}
                  disabled={disabled || !line.productId}
                  className="text-sm"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={t('Price', 'السعر')}
                  value={line.unitPrice}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key ? { ...l, unitPrice: e.target.value } : l,
                      ),
                    )
                  }
                  required
                  disabled={disabled || !line.productId}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t('Remove', 'إزالة')}
                  disabled={lines.length <= 1 || disabled}
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
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
            disabled={disabled || !canAddLine}
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            <Plus className="size-4" aria-hidden />
            {t('Add line', 'إضافة بند')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('Total items', 'إجمالي القطع')}:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {totalItems.toLocaleString()}
            </span>
            {' · '}
            {t('Subtotal', 'المجموع')}:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {linesSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </p>
          {shortages.length > 0 ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              role="status"
            >
              {t(
                'Insufficient stock. This order can be created, but it cannot be approved until sufficient stock is available.',
                'مخزون غير كافٍ. يمكن إنشاء الطلب، لكن لا يمكن اعتماده حتى تتوفر الكمية الكافية.',
              )}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate('/ecommerce-orders')}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={disabled}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Submit for approval', 'إرسال للموافقة')}
          </Button>
        </div>
      </form>
    </div>
  )
}
