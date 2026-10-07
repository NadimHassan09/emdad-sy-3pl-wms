import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Plus, Trash2, User, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useUiPreferences } from '@emdad/core'
import { PageHeader, cn } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Textarea } from '@emdad/ui/ui/textarea'
import { CreateOutboundOrderInput, OutboundApi } from '@/api/outbound'
import { CompaniesApi } from '@/api/companies'
import { InventoryApi } from '@/api/inventory'
import { ProductsApi, type Product } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useTenantCompanyId } from '@/hooks/useTenantCompanyId'
import type { OrderExecutionMode, OutboundExecutionPlan } from '@/lib/execution-plan'
import { outboundAdminPlanReadinessIssues } from '@/lib/execution-plan'
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '@/lib/order-planning-dates'
import { OutboundLocationCombobox } from './OutboundLocationCombobox'

const NOTES_MAX = 500

type DraftLine = { key: string; productId: string; requestedQuantity: string }

function ModeOption({
  selected,
  onSelect,
  icon,
  title,
  bullets,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  bullets: string[]
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-xl border-2 p-5 text-start transition',
        selected ? 'border-primary bg-primary/5 shadow-sm' : 'border bg-card hover:border-muted-foreground/30',
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className={cn('mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-primary' : 'border-muted-foreground/40')} aria-hidden>
          {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={cn('flex size-10 items-center justify-center rounded-full', selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{icon}</span>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  )
}

export function OutboundOrderFormPage() {
  const { id: editId } = useParams<{ id?: string }>()
  const isEdit = Boolean(editId)
  const navigate = useNavigate()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const tenantCompanyId = useTenantCompanyId()
  const { warehouseId, warehouses } = useDefaultWarehouseId()

  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const effectiveWarehouseId =
    (selectedWarehouseId && warehouses.some((w) => w.id === selectedWarehouseId) ? selectedWarehouseId : warehouseId) || ''

  const [companyId, setCompanyId] = useState(tenantCompanyId)
  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd())
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const [requiresPacking, setRequiresPacking] = useState(true)
  const [executionMode, setExecutionMode] = useState<OrderExecutionMode>('admin')
  const [packingLocationId, setPackingLocationId] = useState('')
  const [dispatchDockId, setDispatchDockId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ key: '1', productId: '', requestedQuantity: '' }])

  const existing = useQuery({
    queryKey: [...QK.outboundOrders, editId],
    queryFn: () => OutboundApi.get(editId!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (!existing.data) return
    const o = existing.data
    const plan = o.executionPlan
    setCompanyId(o.companyId)
    setShipDate(o.requiredShipDate.slice(0, 10))
    setDestination(o.destinationAddress ?? '')
    setNotes(o.notes ?? '')
    setRequiresPacking(o.requiresPacking !== false)
    setExecutionMode(o.executionMode === 'workers' ? 'workers' : 'admin')
    if (plan?.warehouseId) setSelectedWarehouseId(plan.warehouseId)
    setPackingLocationId(plan?.packingLocationId ?? '')
    setDispatchDockId(plan?.dispatchDockId ?? '')
    setLines(
      (o.lines ?? []).map((l) => ({
        key: l.id,
        productId: l.productId,
        requestedQuantity: String(l.requestedQuantity),
      })),
    )
  }, [existing.data])

  const companies = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list() })
  const products = useQuery({
    queryKey: [...QK.products, companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 200 }),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

  const productById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products.data?.items ?? []) m.set(p.id, p)
    return m
  }, [products.data])

  const activeProducts = useMemo(
    () => (products.data?.items ?? []).filter((p) => p.status === 'active'),
    [products.data],
  )

  const usedProductIds = useMemo(() => new Set(lines.map((l) => l.productId).filter(Boolean)), [lines])

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  )

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: QK.availability(pid, companyId, isEdit ? editId : undefined),
      queryFn: () => InventoryApi.availability(pid, companyId, isEdit ? editId : undefined),
      enabled: !!pid && !!companyId,
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

  const shortages = useMemo(() => {
    const requestedByProduct = new Map<string, number>()
    for (const l of lines) {
      if (!l.productId) continue
      const n = Number(l.requestedQuantity)
      if (!Number.isFinite(n) || n <= 0) continue
      requestedByProduct.set(l.productId, (requestedByProduct.get(l.productId) ?? 0) + n)
    }
    const out: { productId: string; requested: number; available: number }[] = []
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid)
      if (avail !== undefined && qty > avail) out.push({ productId: pid, requested: qty, available: avail })
    })
    return out
  }, [lines, availabilityByProduct])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!companyId.trim()) throw new Error(t('Pick a client.', 'اختر عميلاً.'))
      if (!isYmdOnOrAfterLocalToday(shipDate)) throw new Error(t('Ship date cannot be before today.', 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.'))
      if (!destination.trim()) throw new Error(t('Enter a destination address.', 'أدخل عنوان الوجهة.'))
      const validLines = lines.filter((l) => l.productId && Number(l.requestedQuantity) > 0)
      if (!validLines.length) throw new Error(t('Add at least one product line.', 'أضف بند منتج واحد على الأقل.'))
      const ids = validLines.map((l) => l.productId)
      if (new Set(ids).size !== ids.length) throw new Error(t('Each product can only appear once.', 'لا يمكن تكرار المنتج.'))
      if (shortages.length) throw new Error(t('Insufficient stock.', 'مخزون غير كافٍ.'))

      let executionPlan: OutboundExecutionPlan | undefined
      if (executionMode === 'admin') {
        if (!effectiveWarehouseId.trim()) throw new Error(t('Set a warehouse first.', 'عيّن مستودعاً أولاً.'))
        if (requiresPacking && !packingLocationId.trim()) throw new Error(t('Select a packing location.', 'اختر موقع التغليف.'))
        if (!dispatchDockId.trim()) throw new Error(t('Select a dispatch dock.', 'اختر رصيف الإرسال.'))
        executionPlan = {
          warehouseId: effectiveWarehouseId,
          requiresPacking,
          packingLocationId: requiresPacking ? packingLocationId.trim() : undefined,
          dispatchDockId: dispatchDockId.trim(),
          lines: validLines.map((l) => ({ productId: l.productId, expectedQty: Number(l.requestedQuantity) })),
          planUpdatedAt: new Date().toISOString(),
        }
        const issues = outboundAdminPlanReadinessIssues(executionPlan, validLines)
        if (issues.length) throw new Error(issues[0]!)
      }

      if (isEdit) {
        return OutboundApi.updatePlan(editId!, {
          executionMode,
          executionPlan,
          requiredShipDate: shipDate,
          notes: notes.trim() || undefined,
          destinationAddress: destination.trim(),
          requiresPacking,
        })
      }

      const input: CreateOutboundOrderInput = {
        companyId,
        destinationAddress: destination.trim(),
        requiredShipDate: shipDate,
        notes: notes.trim() || undefined,
        requiresPacking,
        executionMode,
        executionPlan,
        lines: validLines.map((l) => ({
          productId: l.productId,
          requestedQuantity: Number(l.requestedQuantity),
        })),
      }
      return OutboundApi.create(input)
    },
    onSuccess: (order) => {
      toast.success(isEdit ? t('Plan updated.', 'تم تحديث الخطة.') : t('Outbound order created.', 'تم إنشاء طلب الصادر.'))
      void qc.invalidateQueries({ queryKey: QK.outboundOrders })
      navigate(`/orders/outbound/${order.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isEdit && existing.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('Loading…', 'جارٍ التحميل…')}
      </div>
    )
  }

  const warehouseOptions = warehouses.filter((w) => w.status === 'active').map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <Link to="/orders/outbound" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t('Back to outbound orders', 'العودة إلى طلبات الصادر')}
      </Link>

      <PageHeader
        title={isEdit ? t('Edit outbound plan', 'تعديل خطة الصادر') : t('New outbound order', 'طلب صادر جديد')}
        description={t('Plan lines, packing, and execution before warehouse work.', 'خطّط البنود والتغليف والتنفيذ قبل عمل المستودع.')}
      />

      <form className="space-y-6" onSubmit={(e: FormEvent) => { e.preventDefault(); saveMut.mutate() }}>
        <Card>
          <CardHeader>
            <CardTitle>{t('Execution mode', 'وضع التنفيذ')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ModeOption
              selected={executionMode === 'admin'}
              onSelect={() => setExecutionMode('admin')}
              icon={<User className="size-5" aria-hidden />}
              title={t('Execute by admin', 'تنفيذ بواسطة المسؤول')}
              bullets={[
                t('Complete each warehouse stage on the order page.', 'أكمل كل مرحلة من صفحة الطلب.'),
                t('Pick, pack (if required), shipping, dispatch.', 'التقاط، تعبئة، شحن، إرسال.'),
              ]}
            />
            <ModeOption
              selected={executionMode === 'workers'}
              onSelect={() => setExecutionMode('workers')}
              icon={<Users className="size-5" aria-hidden />}
              title={t('Execute by workers', 'تنفيذ بواسطة العمال')}
              bullets={[
                t('Release to workers after the plan is ready.', 'أطلِق للعمال بعد جاهزية الخطة.'),
                t('Monitor progress from the order page.', 'تابع التقدم من صفحة الطلب.'),
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('General', 'عام')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('Client', 'العميل')}</Label>
              <Combobox
                value={companyId}
                onChange={setCompanyId}
                options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                disabled={isEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Required ship date', 'تاريخ الشحن المطلوب')}</Label>
              <Input type="date" min={localCalendarDateYmd()} value={shipDate} onChange={(e) => setShipDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('Destination address', 'عنوان الوجهة')}</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('Notes', 'ملاحظات')}</Label>
              <Textarea value={notes} maxLength={NOTES_MAX} rows={3} onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('Products', 'المنتجات')}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((prev) => [...prev, { key: `n-${Date.now()}`, productId: '', requestedQuantity: '' }])}
            >
              <Plus className="size-4" aria-hidden />
              {t('Add line', 'إضافة بند')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line) => {
              const p = productById.get(line.productId)
              const avail = line.productId ? availabilityByProduct.get(line.productId) : undefined
              const options = activeProducts
                .filter((pr) => pr.id === line.productId || !usedProductIds.has(pr.id))
                .map((pr) => ({ value: pr.id, label: `${pr.sku} — ${pr.name}` }))
              return (
                <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <Combobox value={line.productId} onChange={(id) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, productId: id } : l)))} options={options} disabled={!companyId} />
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={line.requestedQuantity}
                    onChange={(e) => setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, requestedQuantity: e.target.value } : l)))}
                    disabled={!line.productId}
                  />
                  <Button type="button" variant="ghost" size="icon" disabled={lines.length <= 1} onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                  {p && avail !== undefined ? (
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      {t('Available', 'المتاح')}: <span className="font-mono font-semibold">{avail.toLocaleString()}</span> {p.uom}
                    </p>
                  ) : null}
                </div>
              )
            })}
            {shortages.length > 0 ? (
              <Alert className="border-tone-danger-border bg-tone-danger-bg">
                <AlertTitle>{t('Insufficient stock', 'مخزون غير كافٍ')}</AlertTitle>
                <AlertDescription>{t('Reduce quantities before saving.', 'قلّل الكميات قبل الحفظ.')}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Packing & dispatch', 'التغليف والإرسال')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={requiresPacking} onChange={(e) => { setRequiresPacking(e.target.checked); if (!e.target.checked) setPackingLocationId('') }} className="mt-1 size-4 rounded border" />
              <span className="text-sm">{t('Packing required before dispatch', 'التغليف مطلوب قبل الإرسال')}</span>
            </label>
            {executionMode === 'admin' ? (
              <>
                {warehouses.length > 1 ? (
                  <div className="space-y-1.5">
                    <Label>{t('Warehouse', 'المستودع')}</Label>
                    <Combobox value={effectiveWarehouseId} onChange={(id) => { setSelectedWarehouseId(id); setPackingLocationId(''); setDispatchDockId('') }} options={warehouseOptions} />
                  </div>
                ) : null}
                {effectiveWarehouseId ? (
                  <>
                    {requiresPacking ? (
                      <OutboundLocationCombobox
                        warehouseId={effectiveWarehouseId}
                        value={packingLocationId}
                        onChange={setPackingLocationId}
                        label={t('Packing location', 'موقع التغليف')}
                        locationType="packing"
                        required
                      />
                    ) : null}
                    <OutboundLocationCombobox
                      warehouseId={effectiveWarehouseId}
                      value={dispatchDockId}
                      onChange={setDispatchDockId}
                      label={t('Dispatch dock', 'رصيف الإرسال')}
                      locationType="output"
                      required
                    />
                  </>
                ) : (
                  <Alert>
                    <AlertTitle>{t('Warehouse required', 'المستودع مطلوب')}</AlertTitle>
                  </Alert>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(isEdit ? `/orders/outbound/${editId}` : '/orders/outbound')}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={saveMut.isPending || shortages.length > 0}>
            {saveMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Save plan', 'حفظ الخطة')}
          </Button>
        </div>
      </form>
    </div>
  )
}
