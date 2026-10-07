import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import type { OutboundOrder } from '@/api/outbound'
import { OutboundApi } from '@/api/outbound'
import { ShippingApi } from '@/api/shipping'
import { QK } from '@/constants/query-keys'
import { invalidateWorkflowTasksInventory } from '@/lib/invalidate-wms-queries'
import { OmsCascadingAddressFields } from '@/features/oms/oms-cascading-address'
import { shippingDraftFromOrder, shippingDraftToPayload, type OutboundShippingDraft } from './outbound-shipping-form'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value || '—'}</div>
    </div>
  )
}

export function ShippingDetailsStageCard({ order, isArabic }: { order: OutboundOrder; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const carrierMethod = order.shippingMethod === 'carrier'
  const latestShipment = order.carrierShipments?.[0] ?? null
  const shipmentCreated = latestShipment?.status === 'created'
  const [editing, setEditing] = useState(!shipmentCreated)
  const [sendOpen, setSendOpen] = useState(false)
  const [draft, setDraft] = useState<OutboundShippingDraft>(() => shippingDraftFromOrder(order))

  useEffect(() => {
    setDraft(shippingDraftFromOrder(order))
    if (shipmentCreated) setEditing(false)
  }, [order, shipmentCreated])

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    staleTime: 60_000,
  })
  const providers = (providersQuery.data ?? []).filter((p) => p.enabled && p.connected)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.outboundOrders, order.id] })
    void qc.invalidateQueries({ queryKey: QK.outboundOrders })
    invalidateWorkflowTasksInventory(qc, { referenceId: order.id, referenceType: 'outbound_order' })
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = shippingDraftToPayload({
        ...draft,
        shippingMethod: order.shippingMethod === 'manual' ? 'manual' : 'carrier',
      })
      return OutboundApi.saveShippingDetails(
        order.id,
        { ...payload, shippingMethod: order.shippingMethod ?? 'carrier' },
        order.companyId,
      )
    },
    onSuccess: () => {
      toast.success(t('Shipping details saved.', 'تم حفظ تفاصيل الشحن.'))
      setEditing(false)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const sendMut = useMutation({
    mutationFn: () => OutboundApi.sendShippingDetails(order.id, order.companyId),
    onSuccess: () => {
      toast.success(t('Shipment sent to carrier.', 'تم إرسال الشحنة للشركة.'))
      setSendOpen(false)
      setEditing(false)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const completeMut = useMutation({
    mutationFn: () => OutboundApi.completeShippingDetails(order.id, order.companyId),
    onSuccess: () => {
      toast.success(t('Shipping complete — waiting for dispatch.', 'اكتمل الشحن — بانتظار الإرسال.'))
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const canSend = carrierMethod && !shipmentCreated && order.status === 'waiting_for_shipping_details'
  const canComplete =
    order.status === 'waiting_for_shipping_details' && (!carrierMethod || shipmentCreated)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{t('Shipping details', 'تفاصيل الشحن')}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {!shipmentCreated && !editing ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                {t('Edit', 'تعديل')}
              </Button>
            ) : null}
            {!shipmentCreated && editing ? (
              <Button type="button" variant="outline" size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Save', 'حفظ')}
              </Button>
            ) : null}
            {canSend ? (
              <Button type="button" size="sm" disabled={editing} onClick={() => setSendOpen(true)}>
                {t('Send shipment', 'إرسال الشحنة')}
              </Button>
            ) : null}
            {canComplete ? (
              <Button type="button" size="sm" disabled={completeMut.isPending} onClick={() => completeMut.mutate()}>
                {completeMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('Mark shipping complete', 'تأكيد اكتمال الشحن')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {carrierMethod && shipmentCreated ? (
            <Alert>
              <AlertTitle>{t('Carrier shipment created', 'تم إنشاء شحنة الشركة')}</AlertTitle>
              <AlertDescription>
                AWB{' '}
                <span className="font-mono font-semibold">
                  {latestShipment?.externalAwb?.trim() || latestShipment?.trackingNumber?.trim() || order.trackingNumber?.trim() || '—'}
                </span>
              </AlertDescription>
            </Alert>
          ) : null}
          {carrierMethod && latestShipment?.status === 'failed' ? (
            <Alert className="border-destructive/50 text-destructive">
              <AlertTitle>{t('Carrier send failed', 'فشل إرسال الشركة')}</AlertTitle>
              <AlertDescription>{latestShipment.lastErrorSafe?.trim() || t('Fix details and send again.', 'صحّح التفاصيل وأعد الإرسال.')}</AlertDescription>
            </Alert>
          ) : null}

          {editing && !shipmentCreated ? (
            <div className="space-y-4">
              {carrierMethod ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <OmsCascadingAddressFields
                      value={{ city: draft.city, district: draft.district, addressLine1: draft.addressLine1 }}
                      onChange={(addr) => setDraft((d) => ({ ...d, ...addr }))}
                      cityLabel={t('Governorate', 'المحافظة')}
                      districtLabel={t('City / region', 'المدينة / المنطقة')}
                      addressLine1Label={t('Town / neighborhood', 'الحي / المنطقة')}
                      cityRequired
                      districtRequired
                      addressLine1Required
                    />
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>{t('Street / detailed address', 'الشارع / العنوان التفصيلي')}</Label>
                      <Input value={draft.addressLine2} onChange={(e) => setDraft((d) => ({ ...d, addressLine2: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t('Provider', 'المزود')}</Label>
                      <Select value={draft.shippingProviderCode || undefined} onValueChange={(v) => setDraft((d) => ({ ...d, shippingProviderCode: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((p) => (
                            <SelectItem key={p.code} value={p.code}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('Weight (kg)', 'الوزن (كغ)')}</Label>
                      <Input type="number" min={0} step="0.01" value={draft.shippingWeightKg} onChange={(e) => setDraft((d) => ({ ...d, shippingWeightKg: e.target.value }))} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t('Carrier name', 'اسم شركة الشحن')}</Label>
                    <Input value={draft.carrier} onChange={(e) => setDraft((d) => ({ ...d, carrier: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('Tracking number', 'رقم التتبع')}</Label>
                    <Input value={draft.trackingNumber} onChange={(e) => setDraft((d) => ({ ...d, trackingNumber: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Field label={t('Method', 'الطريقة')} value={carrierMethod ? t('Shipping company', 'شركة شحن') : t('Manual', 'يدوي')} />
              {carrierMethod ? <Field label={t('Provider', 'المزود')} value={order.shippingProviderCode?.trim() || '—'} /> : null}
              <Field label={t('Governorate', 'المحافظة')} value={order.city?.trim() || '—'} />
              <Field label={t('City / region', 'المدينة / المنطقة')} value={order.district?.trim() || '—'} />
              <Field label={t('Town / neighborhood', 'الحي')} value={order.addressLine1?.trim() || '—'} />
              <Field label={t('Street / details', 'الشارع / التفاصيل')} value={order.addressLine2?.trim() || '—'} />
              {!carrierMethod ? (
                <Field label={t('Tracking', 'التتبع')} value={order.trackingNumber?.trim() || '—'} />
              ) : null}
            </dl>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={sendOpen}
        onOpenChange={(o) => !sendMut.isPending && setSendOpen(o)}
        title={t('Send shipment?', 'إرسال الشحنة؟')}
        description={t(
          'This submits the shipment to the carrier and creates an AWB. Mark shipping complete afterward.',
          'يُرسل الطلب للشركة ويُنشئ بوليصة. أكّد اكتمال الشحن بعد ذلك.',
        )}
        confirmLabel={t('Send shipment', 'إرسال الشحنة')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={sendMut.isPending}
        onConfirm={() => sendMut.mutate()}
      />
    </>
  )
}
