import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Textarea } from '@emdad/ui/ui/textarea'
import { toast } from 'sonner'
import { OutboundApi } from '@/api/outbound'
import { ProductsApi } from '@/api/products'
import { type CreateReturnOrderInput, ReturnsApi } from '@/api/returns'
import { CompaniesApi } from '@/api/companies'
import { QK } from '@/constants/query-keys'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'

const MAX_RETURN_LINES = 50

type DraftLine = { productId: string; outboundOrderLineId: string; expectedQuantity: string }

type Props = {
  open: boolean
  onClose: () => void
  loading: boolean
  warehouseId: string
  defaultCompanyId: string
  onSubmit: (input: CreateReturnOrderInput) => void
}

export function NewReturnDialog({
  open,
  onClose,
  loading,
  warehouseId,
  defaultCompanyId,
  onSubmit,
}: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [companyId, setCompanyId] = useState(defaultCompanyId)
  const [outboundId, setOutboundId] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [shipmentRef, setShipmentRef] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', outboundOrderLineId: '', expectedQuantity: '' }])

  useEffect(() => {
    if (!open) return
    setCompanyId(defaultCompanyId)
    setOutboundId('')
    setClientRef('')
    setShipmentRef('')
    setNotes('')
    setLines([{ productId: '', outboundOrderLineId: '', expectedQuantity: '' }])
  }, [open, defaultCompanyId])

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: open,
  })

  const outbounds = useQuery({
    queryKey: [...QK.outboundOrders, 'returns-create', companyId, warehouseId],
    queryFn: () =>
      OutboundApi.list({
        companyId: companyId || undefined,
        warehouseId: warehouseId || undefined,
        status: 'shipped',
        limit: 100,
      }),
    enabled: open && !!companyId && !!warehouseId,
  })

  const outboundDetail = useQuery({
    queryKey: ['outbound-orders', 'detail', outboundId],
    queryFn: () => OutboundApi.get(outboundId),
    enabled: open && !!outboundId,
  })

  const outboundQuota = useQuery({
    queryKey: QK.returns.outboundQuota(outboundId),
    queryFn: () => ReturnsApi.getOutboundQuota(outboundId),
    enabled: open && !!outboundId,
    staleTime: 30_000,
  })

  const products = useQuery({
    queryKey: [...QK.products, 'returns-create', companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 500 }),
    enabled: open && !!companyId && !outboundId,
  })

  const clientOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('Select client', 'اختر العميل')),
    [companies.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const outboundOptions = useMemo(
    () => [
      { value: '', label: t('No outbound link', 'بدون ربط صادر') },
      ...(outbounds.data?.items ?? []).map((o) => ({
        value: o.id,
        label: `${o.orderNumber} · ${o.status}`,
      })),
    ],
    [outbounds.data, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const quotaByLineId = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of outboundQuota.data?.lines ?? []) {
      m.set(q.outboundOrderLineId, Number(q.remaining))
    }
    return m
  }, [outboundQuota.data])

  const productOptionsFromOutbound = useMemo(() => {
    const ob = outboundDetail.data
    if (!ob) return []
    return (ob.lines ?? []).map((l) => {
      const remaining = quotaByLineId.get(l.id) ?? Number(l.pickedQuantity)
      return {
        value: l.id,
        label: `${l.product?.sku ?? ''} · ${l.product?.name ?? ''} (${t('remaining', 'متبقي')} ${remaining})`,
        productId: l.productId,
        maxQty: remaining,
        disabled: remaining <= 0,
      }
    })
  }, [outboundDetail.data, quotaByLineId, isArabic]) // eslint-disable-line react-hooks/exhaustive-deps

  const productOptionsManual = useMemo(
    () => (products.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })),
    [products.data],
  )

  const submit = () => {
    if (!companyId || !warehouseId) return
    const built: CreateReturnOrderInput['lines'] = []
    const seenOutbound = new Set<string>()
    const seenProduct = new Set<string>()

    for (const row of lines) {
      const qty = Number(row.expectedQuantity)
      if (!Number.isFinite(qty) || qty <= 0) continue

      if (outboundId && row.outboundOrderLineId) {
        if (seenOutbound.has(row.outboundOrderLineId)) {
          toast.error(t('Each outbound line can appear once.', 'كل بند صادر مرة واحدة فقط.'))
          return
        }
        seenOutbound.add(row.outboundOrderLineId)
        const obLine = outboundDetail.data?.lines?.find((l) => l.id === row.outboundOrderLineId)
        if (!obLine) continue
        const max = quotaByLineId.get(obLine.id) ?? Number(obLine.pickedQuantity)
        if (qty > max) {
          toast.error(t('Quantity exceeds returnable remaining.', 'الكمية تتجاوز المتبقي.'))
          return
        }
        built.push({ productId: obLine.productId, expectedQuantity: qty, outboundOrderLineId: obLine.id })
      } else if (row.productId) {
        if (seenProduct.has(row.productId)) return
        seenProduct.add(row.productId)
        built.push({ productId: row.productId, expectedQuantity: qty })
      }
    }

    if (built.length === 0) return

    onSubmit({
      companyId,
      warehouseId,
      originalOutboundOrderId: outboundId || undefined,
      clientReference: clientRef.trim() || undefined,
      shipmentReference: shipmentRef.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: built,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('New return', 'إرجاع جديد')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto pe-1">
          {!warehouseId ? (
            <p className="text-sm text-amber-700">{t('Warehouse not resolved.', 'المستودع غير محدد.')}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('Client', 'العميل')}</Label>
              <Combobox value={companyId} onChange={setCompanyId} options={clientOptions} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Linked outbound', 'الصادر المرتبط')}</Label>
              <Combobox
                value={outboundId}
                onChange={(v) => {
                  setOutboundId(v)
                  setLines([{ productId: '', outboundOrderLineId: '', expectedQuantity: '' }])
                }}
                options={outboundOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Client reference', 'مرجع العميل')}</Label>
              <Input value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Shipment reference', 'مرجع الشحنة')}</Label>
              <Input value={shipmentRef} onChange={(e) => setShipmentRef(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Notes', 'ملاحظات')}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('Lines', 'البنود')}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={lines.length >= MAX_RETURN_LINES}
                onClick={() =>
                  setLines((prev) =>
                    prev.length >= MAX_RETURN_LINES
                      ? prev
                      : [...prev, { productId: '', outboundOrderLineId: '', expectedQuantity: '' }],
                  )
                }
              >
                {t('+ Line', '+ بند')}
              </Button>
            </div>
            {lines.map((row, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  {outboundId ? (
                    <>
                      <Label>{t('Outbound line', 'بند الصادر')}</Label>
                      <Combobox
                        value={row.outboundOrderLineId}
                        onChange={(v) => {
                          const opt = productOptionsFromOutbound.find((o) => o.value === v)
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    outboundOrderLineId: v,
                                    productId: opt?.productId ?? '',
                                    expectedQuantity:
                                      opt && opt.maxQty > 0 ? String(opt.maxQty) : l.expectedQuantity,
                                  }
                                : l,
                            ),
                          )
                        }}
                        options={[
                          { value: '', label: t('Pick line…', 'اختر البند…') },
                          ...productOptionsFromOutbound
                            .filter(
                              (o) =>
                                o.value === row.outboundOrderLineId ||
                                !lines.some((l, i) => i !== idx && l.outboundOrderLineId === o.value),
                            )
                            .filter((o) => !o.disabled || o.value === row.outboundOrderLineId)
                            .map((o) => ({ value: o.value, label: o.label })),
                        ]}
                      />
                    </>
                  ) : (
                    <>
                      <Label>{t('Product', 'المنتج')}</Label>
                      <Combobox
                        value={row.productId}
                        onChange={(v) =>
                          setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, productId: v } : l)))
                        }
                        options={[{ value: '', label: t('Pick product…', 'اختر المنتج…') }, ...productOptionsManual]}
                      />
                    </>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-3">
                  <Label>{t('Qty', 'الكمية')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.expectedQuantity}
                    onChange={(e) => {
                      let v = e.target.value
                      if (outboundId && row.outboundOrderLineId) {
                        const max =
                          quotaByLineId.get(row.outboundOrderLineId) ??
                          productOptionsFromOutbound.find((o) => o.value === row.outboundOrderLineId)?.maxQty
                        if (max != null && Number(v) > max) v = String(max)
                      }
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, expectedQuantity: v } : l)))
                    }}
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))}
                  >
                    {t('Remove', 'إزالة')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={loading} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" disabled={loading || !warehouseId} onClick={submit}>
            {t('Create return', 'إنشاء الإرجاع')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
