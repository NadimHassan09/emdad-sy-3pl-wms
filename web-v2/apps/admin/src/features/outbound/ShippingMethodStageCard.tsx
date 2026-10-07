import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Loader2, PackageOpen, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@emdad/ui'
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

type MethodChoice = 'manual' | 'carrier' | null

export function ShippingMethodStageCard({ order, isArabic }: { order: OutboundOrder; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const [method, setMethod] = useState<MethodChoice>(null)
  const [draft, setDraft] = useState<OutboundShippingDraft>(() => shippingDraftFromOrder(order))

  useEffect(() => {
    setDraft(shippingDraftFromOrder(order))
  }, [order])

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

  const submitMut = useMutation({
    mutationFn: async () => {
      if (method === 'manual') {
        return OutboundApi.selectShippingMethod(order.id, { shippingMethod: 'manual' }, order.companyId)
      }
      if (method !== 'carrier') throw new Error('Select a shipping method.')
      const payload = shippingDraftToPayload({ ...draft, shippingMethod: 'carrier' })
      if (!payload.shippingProviderCode) throw new Error(t('Select a shipping provider.', 'اختر شركة الشحن.'))
      if (!payload.city?.trim() || !payload.district?.trim() || !payload.addressLine1?.trim()) {
        throw new Error(t('Complete the destination address.', 'أكمل عنوان الوجهة.'))
      }
      return OutboundApi.selectShippingMethod(
        order.id,
        { ...payload, shippingMethod: 'carrier' },
        order.companyId,
      )
    },
    onSuccess: () => {
      toast.success(
        method === 'carrier'
          ? t('Carrier selected. Continue on shipping details.', 'تم اختيار الشركة. تابع في تفاصيل الشحن.')
          : t('Manual shipping selected.', 'تم اختيار الشحن اليدوي.'),
      )
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const canSubmit =
    method === 'manual' ||
    (method === 'carrier' && draft.shippingProviderCode.trim() !== '' && draft.city.trim() && draft.district.trim() && draft.addressLine1.trim())

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Select shipping method', 'اختر طريقة الشحن')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {t(
            'Choose manual handling or a connected carrier. Carrier orders need a destination and provider before dispatch.',
            'اختر معالجة يدوية أو شركة شحن متصلة. طلبات الشركات تحتاج وجهة ومزوداً قبل الإرسال.',
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMethod('manual')}
            className={cn(
              'relative rounded-xl border-2 p-4 text-start transition',
              method === 'manual' ? 'border-primary bg-primary/5' : 'border hover:bg-muted/40',
            )}
          >
            <div className="flex items-center gap-3">
              <PackageOpen className="size-8 text-primary" aria-hidden />
              <div>
                <div className="text-sm font-semibold">{t('Manual', 'يدوي')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t('No carrier API — tracking entered manually', 'بدون API — تتبع يدوي')}
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMethod('carrier')}
            className={cn(
              'relative rounded-xl border-2 p-4 text-start transition',
              method === 'carrier' ? 'border-primary bg-primary/5' : 'border hover:bg-muted/40',
            )}
          >
            <div className="flex items-center gap-3">
              <Truck className="size-8 text-primary" aria-hidden />
              <div>
                <div className="text-sm font-semibold">{t('Shipping company', 'شركة شحن')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t('Connected carrier with AWB', 'شركة متصلة مع بوليصة')}
                </div>
              </div>
            </div>
          </button>
        </div>

        {method === 'carrier' ? (
          <div className="space-y-4 rounded-lg border p-4">
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
                    <SelectValue placeholder={t('Select provider', 'اختر المزود')} />
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
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.shippingWeightKg}
                  onChange={(e) => setDraft((d) => ({ ...d, shippingWeightKg: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('Contents', 'المحتويات')}</Label>
                <Input value={draft.shippingContents} onChange={(e) => setDraft((d) => ({ ...d, shippingContents: e.target.value }))} />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" disabled={!canSubmit || submitMut.isPending} onClick={() => submitMut.mutate()}>
            {submitMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Save method', 'حفظ الطريقة')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
