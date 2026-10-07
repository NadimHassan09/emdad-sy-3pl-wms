import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { ScrollArea } from '@emdad/ui/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import type { OmsOrderListItem } from '@/api/oms'
import { OutboundApi, type BulkShippingDetailsItem, type ShippingDetailsPreviewItem } from '@/api/outbound'
import { ShippingApi } from '@/api/shipping'
import { QK } from '@/constants/query-keys'
const CHUNK = 100

type RowDraft = {
  omsOrderId: string
  outboundOrderId: string
  orderNumber: string
  companyId: string
  method: 'manual' | 'carrier'
  providerCode: string
  trackingNumber: string
  carrierLabel: string
  ready: boolean
  issues: string[]
}

function outboundId(order: OmsOrderListItem): string | null {
  return order.outboundOrderId ?? order.linkedOutboundOrder?.id ?? null
}

function draftFromPreview(item: ShippingDetailsPreviewItem): RowDraft {
  const p = item.prefill
  const method = p.shippingMethod === 'manual' ? 'manual' : 'carrier'
  return {
    omsOrderId: '',
    outboundOrderId: item.outboundOrderId,
    orderNumber: item.omsOrderNumber || item.orderNumber,
    companyId: item.companyId,
    method,
    providerCode: p.shippingProviderCode?.trim() || '',
    trackingNumber: '',
    carrierLabel: p.shippingProviderCode?.trim() || '',
    ready: item.ready,
    issues: item.issues ?? [],
  }
}

type Props = {
  open: boolean
  orders: OmsOrderListItem[]
  isArabic: boolean
  onClose: () => void
  onSuccess: () => void
}

export function OmsBulkShippingDetailsDialog({ open, orders, isArabic, onClose, onSuccess }: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [rows, setRows] = useState<RowDraft[]>([])
  const [busy, setBusy] = useState(false)

  const outboundIds = useMemo(
    () => orders.map(outboundId).filter((id): id is string => Boolean(id)),
    [orders],
  )

  const omsByOutbound = useMemo(() => {
    const map = new Map<string, string>()
    for (const order of orders) {
      const ob = outboundId(order)
      if (ob) map.set(ob, order.id)
    }
    return map
  }, [orders])

  const previewQuery = useQuery({
    queryKey: ['bulk-shipping-preview', outboundIds.join(',')],
    queryFn: () => OutboundApi.bulkShippingDetailsPreview(outboundIds),
    enabled: open && outboundIds.length > 0,
  })

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    enabled: open,
    staleTime: 60_000,
  })

  const providers = useMemo(
    () => (providersQuery.data ?? []).filter((p) => p.enabled && p.connected),
    [providersQuery.data],
  )

  useEffect(() => {
    if (!open || !previewQuery.data) return
    const byOutbound = new Map(previewQuery.data.orders.map((o) => [o.outboundOrderId, o]))
    setRows(
      outboundIds.map((obId) => {
        const item = byOutbound.get(obId)
        if (!item) {
          return {
            omsOrderId: omsByOutbound.get(obId) ?? '',
            outboundOrderId: obId,
            orderNumber: obId.slice(0, 8),
            companyId: '',
            method: 'manual' as const,
            providerCode: '',
            trackingNumber: '',
            carrierLabel: '',
            ready: false,
            issues: [t('Preview unavailable', 'تعذر تحميل المعاينة')],
          }
        }
        const draft = draftFromPreview(item)
        draft.omsOrderId = omsByOutbound.get(obId) ?? ''
        return draft
      }),
    )
  }, [open, previewQuery.data, outboundIds, omsByOutbound, isArabic])

  const updateRow = (outboundOrderId: string, patch: Partial<RowDraft>) => {
    setRows((prev) => prev.map((r) => (r.outboundOrderId === outboundOrderId ? { ...r, ...patch } : r)))
  }

  const buildBulkItem = (row: RowDraft): BulkShippingDetailsItem | null => {
    const preview = previewQuery.data?.orders.find((o) => o.outboundOrderId === row.outboundOrderId)
    const p = preview?.prefill
    if (!p) return null
    if (row.method === 'manual') {
      return {
        outboundOrderId: row.outboundOrderId,
        shippingMethod: 'manual',
        recipientName: p.recipientName ?? undefined,
        recipientPhone: p.recipientPhone ?? undefined,
        city: p.city ?? undefined,
        district: p.district ?? undefined,
        addressLine1: p.addressLine1 ?? undefined,
        addressLine2: p.addressLine2 ?? undefined,
        shippingPackageType: p.shippingPackageType ?? undefined,
        shippingWeightKg: p.shippingWeightKg ?? undefined,
        shippingVolumeCbm: p.shippingVolumeCbm ?? undefined,
      }
    }
    if (!row.providerCode.trim()) return null
    return {
      outboundOrderId: row.outboundOrderId,
      shippingMethod: 'carrier',
      shippingProviderCode: row.providerCode.trim(),
      recipientName: p.recipientName ?? undefined,
      recipientPhone: p.recipientPhone ?? undefined,
      city: p.city ?? undefined,
      district: p.district ?? undefined,
      addressLine1: p.addressLine1 ?? undefined,
      addressLine2: p.addressLine2 ?? undefined,
      shippingPackageType: p.shippingPackageType ?? undefined,
      shippingDeliveryType: p.shippingDeliveryType ?? undefined,
      shippingPickupType: p.shippingPickupType ?? undefined,
      shippingPayer: p.shippingPayer ?? undefined,
      shippingWeightKg: p.shippingWeightKg ?? undefined,
      shippingVolumeCbm: p.shippingVolumeCbm ?? undefined,
      babelNeighbourhoodId: p.babelNeighbourhoodId ?? undefined,
      shippingReceiverLat: p.shippingReceiverLat ?? undefined,
      shippingReceiverLng: p.shippingReceiverLng ?? undefined,
    }
  }

  const handleApply = async () => {
    setBusy(true)
    let sent = 0
    let failed = 0
    try {
      const bulkItems = rows.map(buildBulkItem).filter((item): item is BulkShippingDetailsItem => Boolean(item))
      if (bulkItems.length) {
        for (let i = 0; i < bulkItems.length; i += CHUNK) {
          const chunk = bulkItems.slice(i, i + CHUNK)
          const part = await OutboundApi.bulkShippingDetails(chunk)
          failed += part.failed
        }
      }

      for (const row of rows) {
        if (row.method !== 'manual') continue
        const tracking = row.trackingNumber.trim()
        const carrier = row.carrierLabel.trim()
        if (!tracking && !carrier) continue
        try {
          await OutboundApi.saveShippingDetails(
            row.outboundOrderId,
            {
              shippingMethod: 'manual',
              trackingNumber: tracking || null,
              carrier: carrier || null,
            },
            row.companyId || undefined,
          )
        } catch {
          failed += 1
        }
      }

      for (const row of rows) {
        if (row.method !== 'carrier' || !row.providerCode.trim()) continue
        try {
          await OutboundApi.sendShippingDetails(row.outboundOrderId, row.companyId || undefined)
          sent += 1
        } catch (e) {
          failed += 1
          const msg = e instanceof Error ? e.message : t('Send failed', 'فشل الإرسال')
          toast.error(`${row.orderNumber}: ${msg}`)
        }
      }

      if (failed) {
        toast.warning(t(`${failed} order(s) had errors.`, `حدثت أخطاء في ${failed} طلب.`))
      } else {
        toast.success(
          t(
            `Shipping details saved${sent ? `; ${sent} sent to carrier` : ''}.`,
            `تم حفظ تفاصيل الشحن${sent ? `؛ أُرسل ${sent} إلى شركة الشحن` : ''}.`,
          ),
        )
      }
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Action failed', 'فشل الإجراء'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('Bulk shipping details', 'تفاصيل الشحن الجماعية')}</DialogTitle>
          <DialogDescription>
            {t(
              'Choose manual tracking or a connected carrier per order, then apply. Carrier rows will request an AWB when possible.',
              'اختر التتبع اليدوي أو شركة شحن متصلة لكل طلب، ثم طبّق. صفوف الشركات ستطلب بوليصة عند الإمكان.',
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(70vh,32rem)]">
          <div className="space-y-4 px-6 py-4">
            {previewQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t('Loading orders…', 'جارٍ تحميل الطلبات…')}
              </div>
            ) : null}
            {rows.map((row) => (
              <div key={row.outboundOrderId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{row.orderNumber}</div>
                  {!row.ready && row.issues.length ? (
                    <div className="text-xs text-tone-warning-fg">{row.issues.join(' · ')}</div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t('Method', 'الطريقة')}</Label>
                    <Select
                      value={row.method}
                      onValueChange={(v) => updateRow(row.outboundOrderId, { method: v as 'manual' | 'carrier' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">{t('Manual', 'يدوي')}</SelectItem>
                        <SelectItem value="carrier">{t('Carrier', 'شركة شحن')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {row.method === 'carrier' ? (
                    <div className="space-y-1.5">
                      <Label>{t('Provider', 'المزود')}</Label>
                      <Select
                        value={row.providerCode || undefined}
                        onValueChange={(v) => updateRow(row.outboundOrderId, { providerCode: v })}
                      >
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
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label>{t('Carrier name', 'اسم شركة الشحن')}</Label>
                        <Input
                          value={row.carrierLabel}
                          onChange={(e) => updateRow(row.outboundOrderId, { carrierLabel: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>{t('Tracking number', 'رقم التتبع')}</Label>
                        <Input
                          value={row.trackingNumber}
                          onChange={(e) => updateRow(row.outboundOrderId, { trackingNumber: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" disabled={busy || !rows.length} onClick={() => void handleApply()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Apply', 'تطبيق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
