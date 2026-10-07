import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Textarea } from '@emdad/ui/ui/textarea'
import { OmsReturnsApi } from '@/api/oms'
import { LocationsApi } from '@/api/locations'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import type { InboundExecutionPlan } from '@/lib/execution-plan'
import { inboundAdminPlanReadinessIssues } from '@/lib/execution-plan'

type PutawayRow = { key: string; locationId: string; qty: string }
type DraftLine = {
  key: string
  productId: string
  sku: string
  name: string
  expectedQuantity: string
  putaway: PutawayRow[]
}

export function OmsReturnPlanEditPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const { warehouseId, warehouses } = useDefaultWarehouseId()
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId) ? selectedWarehouseId : warehouseId) ||
    ''

  const [receivingDockId, setReceivingDockId] = useState('')
  const [receivingDockSearch, setReceivingDockSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [locationSearchByLine, setLocationSearchByLine] = useState<Record<string, string>>({})

  const existing = useQuery({
    queryKey: QK.omsReturn(id),
    queryFn: () => OmsReturnsApi.get(id),
    enabled: !!id,
  })

  useEffect(() => {
    if (!existing.data) return
    const o = existing.data
    setNotes(o.notes ?? '')
    const plan = o.executionPlan
    if (plan?.warehouseId) setSelectedWarehouseId(plan.warehouseId)
    if (plan?.receivingDockId) setReceivingDockId(plan.receivingDockId)
    setLines(
      o.lines.map((l, i) => {
        const pl =
          plan?.lines.find((x) => x.orderLineId === l.id) ?? plan?.lines.find((x) => x.productId === l.productId)
        const putaway =
          pl?.putaway?.length
            ? pl.putaway.map((p, j) => ({
                key: `${i}-${j}`,
                locationId: p.locationId,
                qty: String(p.qty),
              }))
            : [{ key: `${i}-0`, locationId: '', qty: String(l.quantity) }]
        return {
          key: l.id,
          productId: l.productId,
          sku: l.product?.sku ?? '',
          name: l.product?.name ?? '',
          expectedQuantity: String(l.quantity),
          putaway,
        }
      }),
    )
  }, [existing.data])

  useEffect(() => {
    setSelectedWarehouseId((cur) => (cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId))
  }, [warehouseId, warehouses])

  const dockLookup = useQuery({
    queryKey: QK.locations.lookup(effectiveWarehouseId, receivingDockSearch),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId: effectiveWarehouseId,
        search: receivingDockSearch || undefined,
        type: 'input',
        limit: 25,
      }),
    enabled: Boolean(effectiveWarehouseId),
  })

  const planPreview: InboundExecutionPlan | null = useMemo(() => {
    if (!effectiveWarehouseId) return null
    return {
      warehouseId: effectiveWarehouseId,
      receivingDockId: receivingDockId.trim(),
      planUpdatedAt: new Date().toISOString(),
      lines: lines.map((l) => ({
        productId: l.productId,
        orderLineId: l.key,
        expectedQty: Number(l.expectedQuantity) || 0,
        putaway: l.putaway
          .filter((r) => r.locationId.trim() && Number(r.qty) > 0)
          .map((r) => ({ locationId: r.locationId.trim(), qty: Number(r.qty) })),
      })),
    }
  }, [effectiveWarehouseId, lines, receivingDockId])

  const readinessIssues = useMemo(() => {
    if (!existing.data) return [t('Loading…', 'جارٍ التحميل…')]
    return inboundAdminPlanReadinessIssues(
      planPreview,
      existing.data.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        expectedQuantity: l.quantity,
      })),
    )
  }, [existing.data, planPreview, isArabic])

  const saveMut = useMutation({
    mutationFn: () => {
      if (!planPreview) throw new Error(t('Select a warehouse.', 'اختر مستودعاً.'))
      if (readinessIssues.length > 0) {
        throw new Error(readinessIssues[0] ?? t('Plan incomplete.', 'الخطة غير مكتملة.'))
      }
      for (const line of planPreview.lines) {
        const locs = [...new Set((line.putaway ?? []).map((p) => p.locationId))]
        if (locs.length > 1) {
          throw new Error(t('Use one putaway location per product.', 'استخدم موقع تخزين واحد لكل منتج.'))
        }
      }
      return OmsReturnsApi.updatePlan(id, {
        executionMode: 'admin',
        executionPlan: planPreview,
        notes: notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast.success(t('Return plan saved.', 'تم حفظ خطة المرتجع.'))
      void qc.invalidateQueries({ queryKey: QK.omsReturn(id) })
      void qc.invalidateQueries({ queryKey: QK.omsReturns })
      navigate(`/oms/returns/${id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }

  if (!id) return null

  if (existing.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('Loading return…', 'جارٍ تحميل المرتجع…')}</p>
  }

  if (existing.isError || !existing.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('Failed to load OMS return.', 'تعذر تحميل مرتجع OMS.')}</AlertTitle>
      </Alert>
    )
  }

  if (existing.data.status !== 'requested') {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>{t('Plan is locked', 'الخطة مقفلة')}</AlertTitle>
          <AlertDescription>
            {t(
              `This return is already ${existing.data.status.replace(/_/g, ' ')}. Open return details to continue warehouse stages.`,
              `هذا المرتجع في حالة ${existing.data.status}. افتح التفاصيل لمتابعة مراحل المستودع.`,
            )}
          </AlertDescription>
        </Alert>
        <Button variant="link" className="px-0" asChild>
          <Link to={`/oms/returns/${id}`}>{t('Back to return details', 'العودة إلى التفاصيل')}</Link>
        </Button>
      </div>
    )
  }

  const warehouseOptions = warehouses
    .filter((w) => w.status === 'active')
    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))

  const dockOptions =
    dockLookup.data?.items.map((loc) => ({
      value: loc.id,
      label: loc.fullPath || loc.name,
    })) ?? []

  return (
    <form className="mx-auto max-w-3xl space-y-6 pb-16" onSubmit={onSubmit}>
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to={`/oms/returns/${id}`}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t('Back to return', 'العودة إلى المرتجع')}
        </Link>
      </Button>

      <PageHeader
        title={t(`Edit return plan · ${existing.data.returnNumber}`, `تعديل الخطة · ${existing.data.returnNumber}`)}
        description={t(
          'Set receiving dock and putaway location per product, then save and approve from the detail page.',
          'حدد رصيف الاستلام وموقع التخزين لكل منتج، ثم احفظ ووافق من صفحة التفاصيل.',
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('Receiving area', 'منطقة الاستلام')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {warehouses.length > 1 ? (
            <div className="space-y-1.5">
              <Label>{t('Warehouse', 'المستودع')}</Label>
              <Combobox
                value={selectedWarehouseId || warehouseId}
                onChange={setSelectedWarehouseId}
                options={warehouseOptions}
                placeholder={t('Select warehouse', 'اختر المستودع')}
              />
            </div>
          ) : null}
          {effectiveWarehouseId ? (
            <div className="space-y-1.5">
              <Label>{t('Receiving dock', 'رصيف الاستلام')}</Label>
              <Input
                value={receivingDockSearch}
                onChange={(e) => setReceivingDockSearch(e.target.value)}
                placeholder={t('Search dock…', 'ابحث عن الرصيف…')}
              />
              <Combobox
                value={receivingDockId}
                onChange={setReceivingDockId}
                options={dockOptions}
                placeholder={t('Select receiving dock', 'اختر رصيف الاستلام')}
                searchPlaceholder={t('Filter list…', 'تصفية…')}
              />
              <Input
                value={receivingDockId}
                onChange={(e) => setReceivingDockId(e.target.value)}
                placeholder={t('Or paste location ID', 'أو الصق معرف الموقع')}
                className="font-mono text-xs"
              />
            </div>
          ) : (
            <Alert>
              <AlertTitle>{t('Set a default warehouse first.', 'عيّن مستودعاً افتراضياً أولاً.')}</AlertTitle>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="return-notes">{t('Notes', 'ملاحظات')}</Label>
            <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Putaway lines', 'خطوط التخزين')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {lines.map((line) => (
            <PutawayLineEditor
              key={line.key}
              line={line}
              warehouseId={effectiveWarehouseId}
              search={locationSearchByLine[line.key] ?? ''}
              onSearchChange={(v) => setLocationSearchByLine((prev) => ({ ...prev, [line.key]: v }))}
              onChange={(next) => setLines((prev) => prev.map((l) => (l.key === line.key ? next : l)))}
              isArabic={isArabic}
            />
          ))}
        </CardContent>
      </Card>

      {readinessIssues.length ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Plan issues', 'مشكلات الخطة')}</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {readinessIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link to={`/oms/returns/${id}`}>{t('Cancel', 'إلغاء')}</Link>
        </Button>
        <Button type="submit" disabled={saveMut.isPending || readinessIssues.length > 0}>
          {saveMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t('Save plan', 'حفظ الخطة')}
        </Button>
      </div>
    </form>
  )
}

function PutawayLineEditor({
  line,
  warehouseId,
  search,
  onSearchChange,
  onChange,
  isArabic,
}: {
  line: DraftLine
  warehouseId: string
  search: string
  onSearchChange: (v: string) => void
  onChange: (line: DraftLine) => void
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const putaway = line.putaway[0] ?? { key: '0', locationId: '', qty: line.expectedQuantity }

  const lookup = useQuery({
    queryKey: QK.locations.putawayLookup(warehouseId, 'inbound_putaway', search),
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId,
        search: search || undefined,
        limit: 25,
      }),
    enabled: Boolean(warehouseId),
  })

  const options =
    lookup.data?.items.map((loc) => ({
      value: loc.id,
      label: loc.fullPath || loc.name,
    })) ?? []

  return (
    <div className="rounded-lg border p-4">
      <div className="font-medium text-sm">
        {line.sku || line.productId} · {line.name}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {t('Expected', 'المطلوب')}: {line.expectedQuantity}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('Putaway location', 'موقع التخزين')}</Label>
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('Search locations…', 'ابحث عن المواقع…')}
          />
          <Combobox
            value={putaway.locationId}
            onChange={(locationId) =>
              onChange({
                ...line,
                putaway: [{ ...putaway, locationId }],
              })
            }
            options={options}
            placeholder={t('Select location', 'اختر الموقع')}
          />
          <Input
            value={putaway.locationId}
            onChange={(e) =>
              onChange({
                ...line,
                putaway: [{ ...putaway, locationId: e.target.value }],
              })
            }
            placeholder={t('Or paste location ID', 'أو الصق معرف الموقع')}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('Quantity', 'الكمية')}</Label>
          <Input
            inputMode="decimal"
            value={putaway.qty}
            onChange={(e) =>
              onChange({
                ...line,
                putaway: [{ ...putaway, qty: e.target.value }],
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
