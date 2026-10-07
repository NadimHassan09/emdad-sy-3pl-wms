import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import { OmsApi, type OmsOrderDetail, type OmsPaymentMethod } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { isValidRecipientName, phoneFromStoredValue } from '@/lib/recipient-contact'
import { OmsCascadingAddressFields } from './oms-cascading-address'
import {
  OmsRecipientNameField,
  OmsRecipientPhoneField,
  evaluatePhone,
  type RecipientPhoneState,
} from './oms-recipient-fields'

const EARLY_STATUSES = new Set([
  'draft',
  'waiting_for_confirmation',
  'confirmed_waiting_for_admin_approval',
  'pending_approval',
])

type Props = {
  open: boolean
  orderId: string | null
  onOpenChange: (open: boolean) => void
  onSaved?: (order: OmsOrderDetail) => void
  isArabic: boolean
}

export function OmsOrderFormDialog({ open, orderId, onOpenChange, onSaved, isArabic }: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const orderQuery = useQuery({
    queryKey: [...QK.omsOrders, orderId],
    queryFn: () => OmsApi.getOrder(orderId!),
    enabled: open && !!orderId,
  })

  const initial = orderQuery.data
  const linesFrozen = !!initial && !EARLY_STATUSES.has(initial.status)

  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState<RecipientPhoneState>({ countryIso: 'SY', nationalNumber: '' })
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [deliveryLat, setDeliveryLat] = useState('')
  const [deliveryLng, setDeliveryLng] = useState('')
  const [requiredShipDate, setRequiredShipDate] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<OmsPaymentMethod | ''>('')
  const [shippingFee, setShippingFee] = useState('')
  const [currency, setCurrency] = useState('USD')

  useEffect(() => {
    if (!open || !initial) return
    setRecipientName(initial.recipientName ?? '')
    const stored = phoneFromStoredValue(initial.recipientPhone, initial.shippingPhoneCountry)
    setRecipientPhone({ countryIso: stored.countryIso, nationalNumber: stored.nationalNumber })
    setContactSubmitted(false)
    setCity(initial.city ?? '')
    setDistrict(initial.district ?? '')
    setAddressLine1(initial.addressLine1 ?? '')
    setAddressLine2(initial.addressLine2 ?? '')
    setDeliveryLat(initial.shippingReceiverLat != null ? String(initial.shippingReceiverLat) : '')
    setDeliveryLng(initial.shippingReceiverLng != null ? String(initial.shippingReceiverLng) : '')
    setRequiredShipDate(initial.requiredShipDate.slice(0, 10))
    setNotes(initial.notes ?? '')
    setPaymentMethod(initial.paymentMethod ?? '')
    setShippingFee(initial.shippingFee ?? '')
    setCurrency(initial.currency ?? 'USD')
  }, [open, initial])

  const phoneEval = evaluatePhone(recipientPhone)

  const calculatedSubtotal = useMemo(() => {
    if (!initial) return 0
    const existingLinesSum = initial.lines.reduce((sum, l) => {
      if (l.lineTotal != null && l.lineTotal !== '') return sum + Number(l.lineTotal)
      const qty = Number(l.requestedQuantity)
      const price = Number(l.unitPrice ?? 0)
      return sum + (Number.isFinite(qty * price) ? qty * price : 0)
    }, 0)
    const shipAmount = shippingFee ? Number(shippingFee) || 0 : 0
    return existingLinesSum + shipAmount
  }, [initial, shippingFee])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!initial) throw new Error(t('Order not loaded.', 'الطلب غير محمّل.'))
      return OmsApi.update(initial.id, {
        recipientName: recipientName.trim() || undefined,
        recipientPhone: phoneEval.e164 || undefined,
        city,
        district,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        shippingReceiverLat: deliveryLat.trim() ? Number(deliveryLat) : undefined,
        shippingReceiverLng: deliveryLng.trim() ? Number(deliveryLng) : undefined,
        requiredShipDate,
        notes,
        paymentMethod: paymentMethod || undefined,
        subtotal: calculatedSubtotal,
        shippingFee: shippingFee ? Number(shippingFee) || 0 : 0,
        codAmount: paymentMethod === 'COD' ? calculatedSubtotal : undefined,
        currency,
        shippingPhoneCountry: phoneEval.countryIso || undefined,
      })
    },
    onSuccess: (order) => {
      toast.success(t('OMS order updated.', 'تم تحديث طلب OMS.'))
      void qc.invalidateQueries({ queryKey: [...QK.omsOrders, order.id] })
      void qc.invalidateQueries({ queryKey: QK.omsOrders })
      onSaved?.(order)
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setContactSubmitted(true)
    if (!recipientName.trim()) {
      toast.error(t('Recipient name is required.', 'اسم المستلم مطلوب.'))
      return
    }
    if (!isValidRecipientName(recipientName)) return
    if (phoneEval.isEmpty || !phoneEval.isValid) {
      toast.error(t('Recipient phone is required.', 'هاتف المستلم مطلوب.'))
      return
    }
    if (!city.trim() || !district.trim() || !addressLine1.trim()) {
      toast.error(
        t(
          'Governorate, City/Region, and Town/Neighborhood are required.',
          'المحافظة والمدينة/المنطقة والحي مطلوبة.',
        ),
      )
      return
    }
    if (!paymentMethod) {
      toast.error(t('Payment method is required.', 'طريقة الدفع مطلوبة.'))
      return
    }
    saveMut.mutate()
  }

  const loading = orderQuery.isLoading || saveMut.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Edit OMS order', 'تعديل طلب OMS')}</DialogTitle>
        </DialogHeader>
        {orderQuery.isLoading ? (
          <div className="flex justify-center py-8" aria-busy="true">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : orderQuery.isError || !initial ? (
          <p className="text-sm text-destructive">{t('Could not load order.', 'تعذر تحميل الطلب.')}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {linesFrozen ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t(
                  'Product lines cannot be changed after approval. You can still update recipient and shipping details.',
                  'لا يمكن تغيير بنود المنتجات بعد الاعتماد. يمكنك تحديث بيانات المستلم والشحن.',
                )}
              </p>
            ) : null}
            {initial.needsInformation ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                {t(
                  'Complete governorate, city/region, and town/neighborhood so this order can be approved.',
                  'أكمل المحافظة والمدينة/المنطقة والحي حتى يمكن اعتماد الطلب.',
                )}
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <OmsRecipientNameField
                label={t('Recipient name', 'اسم المستلم')}
                value={recipientName}
                onChange={setRecipientName}
                disabled={loading}
                submitted={contactSubmitted}
                required
                isArabic={isArabic}
              />
              <OmsRecipientPhoneField
                label={t('Recipient phone', 'هاتف المستلم')}
                value={recipientPhone}
                onChange={setRecipientPhone}
                disabled={loading}
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
                disabled={loading}
                cityRequired
                districtRequired
                addressLine1Required
              />
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-address-line2" className="text-sm">
                  {t('Street / detailed address', 'الشارع / العنوان التفصيلي')}
                </Label>
                <Input
                  id="edit-address-line2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  disabled={loading}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lat" className="text-sm">
                  {t('Latitude (optional)', 'خط العرض (اختياري)')}
                </Label>
                <Input id="edit-lat" value={deliveryLat} onChange={(e) => setDeliveryLat(e.target.value)} disabled={loading} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lng" className="text-sm">
                  {t('Longitude (optional)', 'خط الطول (اختياري)')}
                </Label>
                <Input id="edit-lng" value={deliveryLng} onChange={(e) => setDeliveryLng(e.target.value)} disabled={loading} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ship-date" className="text-sm">
                  {t('Required ship date', 'تاريخ الشحن المطلوب')}
                </Label>
                <Input
                  id="edit-ship-date"
                  type="date"
                  value={requiredShipDate}
                  onChange={(e) => setRequiredShipDate(e.target.value)}
                  disabled={loading}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm">{t('Payment method', 'طريقة الدفع')}</Label>
                <Select
                  value={paymentMethod || '__none'}
                  onValueChange={(v) => setPaymentMethod(v === '__none' ? '' : (v as OmsPaymentMethod))}
                  disabled={loading}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    <SelectItem value="COD">COD</SelectItem>
                    <SelectItem value="PREPAID">{t('Prepaid', 'مدفوع مسبقاً')}</SelectItem>
                    <SelectItem value="CREDIT">{t('Credit', 'آجل')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-shipping-fee" className="text-sm">
                  {t('Shipping fee', 'رسوم الشحن')}
                </Label>
                <Input id="edit-shipping-fee" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} disabled={loading} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-currency" className="text-sm">
                  {t('Currency', 'العملة')}
                </Label>
                <Input id="edit-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={loading} className="text-sm" />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {t('Subtotal', 'المجموع')}: <span className="font-semibold tabular-nums">{calculatedSubtotal}</span>
              <span className="ms-2 text-muted-foreground">({t('lines + shipping', 'البنود + الشحن')})</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes" className="text-sm">
                {t('Notes', 'ملاحظات')}
              </Label>
              <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={loading} className="text-sm" />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={loading}>
                {saveMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Save changes', 'حفظ التغييرات')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
