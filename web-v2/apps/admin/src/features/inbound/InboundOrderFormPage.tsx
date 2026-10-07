import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Plus, Trash2, TriangleAlert, User, Users } from 'lucide-react'
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
import { CreateInboundOrderInput, InboundApi } from '@/api/inbound'
import { CompaniesApi } from '@/api/companies'
import { LocationsApi } from '@/api/locations'
import { ProductsApi, type Product } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useTenantCompanyId } from '@/hooks/useTenantCompanyId'
import type { InboundExecutionPlan, OrderExecutionMode } from '@/lib/execution-plan'
import { inboundAdminPlanReadinessIssues } from '@/lib/execution-plan'
import { isAllowedPutawayDestination } from '@/lib/location-types'
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '@/lib/order-planning-dates'

const NOTES_MAX = 500

/** White field surface (matches product picker / avoids light-green select fill). */
const FIELD_SURFACE = 'bg-white hover:bg-white dark:bg-white dark:text-foreground dark:hover:bg-white'

/** Soft-danger icon button (delete / clear filters). */
const DANGER_ICON_BTN =
  'border border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg'

/** Soft-danger text button (Cancel). */
const DANGER_TEXT_BTN =
  'border border-transparent text-tone-danger-fg hover:border-tone-danger-border hover:bg-tone-danger-bg hover:text-tone-danger-fg'

type PutawayRow = { key: string; locationId: string; qty: string }
type DraftLine = {
  key: string
  productId: string
  expectedQuantity: string
  putaway: PutawayRow[]
}

function formatOnHand(p: Product): string {
  const n = Number(p.totalOnHand ?? 0)
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'
}

function AllocationBadge({
  allocated,
  expected,
  complete,
  label,
}: {
  allocated: number
  expected: number
  complete: boolean
  label: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums',
        complete ? 'bg-primary/10 text-primary' : 'bg-tone-warning-bg text-tone-warning-fg',
      )}
    >
      {complete ? <Check className="size-3" aria-hidden /> : <TriangleAlert className="size-3" aria-hidden />}
      {allocated.toLocaleString(undefined, { maximumFractionDigits: 4 })} / {expected.toLocaleString(undefined, { maximumFractionDigits: 4 })} {label}
    </div>
  )
}

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
        <span
          className={cn(
            'mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-primary' : 'border-muted-foreground/40',
          )}
          aria-hidden
        >
          {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={cn('flex size-10 items-center justify-center rounded-full', selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
              {icon}
            </span>
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

export function InboundOrderFormPage() {
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
  const [arrival, setArrival] = useState(() => localCalendarDateYmd())
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<OrderExecutionMode>('admin')
  const [receivingDockId, setReceivingDockId] = useState('')
  const [receivingDockSearch, setReceivingDockSearch] = useState('')
  /** Keep labels for selected locations so Combobox still shows them after search changes. */
  const [locationLabelById, setLocationLabelById] = useState<Record<string, string>>({})
  const [locationSearchByLine, setLocationSearchByLine] = useState<Record<string, string>>({})
  const [lines, setLines] = useState<DraftLine[]>([
    { key: '1', productId: '', expectedQuantity: '', putaway: [{ key: '1a', locationId: '', qty: '' }] },
  ])

  const existing = useQuery({
    queryKey: [...QK.inboundOrders, editId],
    queryFn: () => InboundApi.get(editId!),
    enabled: isEdit && !!editId,
  })

  useEffect(() => {
    if (!existing.data) return
    const o = existing.data
    setCompanyId(o.companyId)
    setArrival(o.expectedArrivalDate.slice(0, 10))
    setNotes(o.notes ?? '')
    setMode(o.executionMode === 'workers' ? 'workers' : 'admin')
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
            : [{ key: `${i}-0`, locationId: '', qty: String(l.expectedQuantity) }]
        return {
          key: l.id,
          productId: l.productId,
          expectedQuantity: String(l.expectedQuantity),
          putaway,
        }
      }),
    )
  }, [existing.data])

  useEffect(() => {
    setSelectedWarehouseId((cur) => (cur && warehouses.some((w) => w.id === cur) ? cur : warehouseId))
  }, [warehouseId, warehouses])

  useEffect(() => {
    if (companyId || !tenantCompanyId) return
    setCompanyId(tenantCompanyId)
  }, [companyId, tenantCompanyId])

  const companies = useQuery({ queryKey: QK.companies, queryFn: () => CompaniesApi.list() })
  const products = useQuery({
    queryKey: [...QK.products, companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 200 }),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (companyId || !companies.data?.length) return
    const fallback = companies.data.find((c) => c.id === tenantCompanyId) ?? companies.data[0]
    if (fallback) setCompanyId(fallback.id)
  }, [companyId, companies.data, tenantCompanyId])

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

  const optionsForLine = (lineKey: string) => {
    const current = lines.find((l) => l.key === lineKey)?.productId
    return activeProducts
      .filter((p) => p.id === current || !usedProductIds.has(p.id))
      .map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))
  }

  const canAddLine = activeProducts.some((p) => !usedProductIds.has(p.id))

  const totalItems = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const n = Number(l.expectedQuantity)
        return sum + (Number.isFinite(n) && n > 0 ? n : 0)
      }, 0),
    [lines],
  )

  const dockLookup = useQuery({
    queryKey: [...QK.locations.lookup(effectiveWarehouseId, receivingDockSearch), 'input'] as const,
    queryFn: () =>
      LocationsApi.lookup({
        warehouseId: effectiveWarehouseId,
        search: receivingDockSearch || undefined,
        type: 'input',
        status: 'active',
        limit: 50,
      }),
    enabled: Boolean(effectiveWarehouseId) && mode === 'admin',
  })

  const dockOptions = useMemo(() => {
    const items =
      (dockLookup.data?.items ?? [])
        .filter((loc) => loc.type === 'input')
        .map((loc) => ({
          value: loc.id,
          label: loc.fullPath || loc.name,
        }))
    if (receivingDockId && !items.some((o) => o.value === receivingDockId)) {
      items.unshift({
        value: receivingDockId,
        label: locationLabelById[receivingDockId] || receivingDockId,
      })
    }
    return items
  }, [dockLookup.data, receivingDockId, locationLabelById])

  const addLine = () => {
    if (!canAddLine) {
      toast.error(t('All products are already on this order.', 'كل المنتجات مضافة مسبقاً إلى هذا الطلب.'))
      return
    }
    setLines((prev) => [
      ...prev,
      {
        key: `n-${Date.now()}`,
        productId: '',
        expectedQuantity: '',
        putaway: [{ key: `p-${Date.now()}`, locationId: '', qty: '' }],
      },
    ])
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!isYmdOnOrAfterLocalToday(arrival)) {
        throw new Error(t('Expected arrival date cannot be before today.', 'تاريخ الوصول المتوقع لا يمكن أن يكون قبل اليوم.'))
      }
      const validLines = lines.filter((l) => l.productId && Number(l.expectedQuantity) > 0)
      if (validLines.length === 0) {
        throw new Error(t('Add at least one product line.', 'أضف بند منتج واحد على الأقل.'))
      }

      const ids = validLines.map((l) => l.productId)
      if (new Set(ids).size !== ids.length) {
        throw new Error(t('Each product can only appear once on the order.', 'لا يمكن تكرار نفس المنتج أكثر من مرة في الطلب.'))
      }

      let executionPlan: InboundExecutionPlan | undefined
      if (mode === 'admin') {
        executionPlan = {
          warehouseId: effectiveWarehouseId,
          receivingDockId: receivingDockId.trim(),
          lines: validLines.map((l) => ({
            productId: l.productId,
            orderLineId: isEdit ? l.key : undefined,
            expectedQty: Number(l.expectedQuantity),
            putaway: l.putaway.map((r) => ({
              locationId: r.locationId.trim(),
              qty: Number(r.qty),
            })),
          })),
          planUpdatedAt: new Date().toISOString(),
        }
        const issues = inboundAdminPlanReadinessIssues(
          executionPlan,
          validLines.map((l) => ({
            id: isEdit ? l.key : undefined,
            productId: l.productId,
            expectedQuantity: l.expectedQuantity,
          })),
        )
        if (issues.length) throw new Error(issues[0]!)
      }

      const payload: CreateInboundOrderInput = {
        companyId,
        expectedArrivalDate: arrival,
        notes: notes.trim() || undefined,
        executionMode: mode,
        executionPlan,
        lines: validLines.map((l) => ({
          productId: l.productId,
          expectedQuantity: Number(l.expectedQuantity),
        })),
      }

      if (isEdit && editId) {
        return InboundApi.updatePlan(editId, {
          executionMode: mode,
          executionPlan,
          expectedArrivalDate: arrival,
          notes: notes.trim() || undefined,
        })
      }
      return InboundApi.create(payload)
    },
    onSuccess: (order) => {
      toast.success(isEdit ? t('Plan updated.', 'تم تحديث الخطة.') : t('Plan saved.', 'تم حفظ الخطة.'))
      void qc.invalidateQueries({ queryKey: QK.inboundOrders })
      navigate(`/orders/inbound/${order.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    saveMut.mutate()
  }

  if (isEdit && existing.isLoading) {
    return <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
  }

  if (isEdit && (existing.isError || !existing.data)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('Failed to load inbound order.', 'تعذر تحميل طلب الوارد.')}</AlertTitle>
      </Alert>
    )
  }

  const productLines = lines.filter((l) => l.productId)
  const loading = saveMut.isPending
  const warehouseOptions = warehouses.filter((w) => w.status === 'active').map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))

  return (
    <form className="mx-auto max-w-4xl space-y-6 pb-16" onSubmit={onSubmit}>
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to="/orders/inbound">
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t('Back to inbound orders', 'العودة إلى طلبات الوارد')}
        </Link>
      </Button>

      <PageHeader
        title={isEdit ? t('Edit inbound plan', 'تعديل خطة الوارد') : t('New inbound order', 'طلب وارد جديد')}
        description={
          isEdit
            ? t('Plan everything before execution.', 'خطّط كل شيء قبل التنفيذ.')
            : t('Create a warehouse receipt request.', 'إنشاء طلب إيصال وارد للمستودع.')
        }
      />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Execution mode', 'وضع التنفيذ')}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ModeOption
            selected={mode === 'admin'}
            onSelect={() => setMode('admin')}
            icon={<User className="size-5" aria-hidden />}
            title={t('Execute by Admin', 'تنفيذ بواسطة المسؤول')}
            bullets={[
              t('I will do the warehouse work myself, then Approve and complete each stage.', 'سأتولى عمل المستودع بنفسي، ثم أوافق وأكمل كل مرحلة.'),
              t('You will receive printable instructions', 'ستحصل على تعليمات قابلة للطباعة'),
              t('Saving the plan only configures the workflow — stages are completed on the order page.', 'حفظ الخطة يضبط سير العمل فقط — إكمال المراحل يتم من صفحة الطلب.'),
            ]}
          />
          <ModeOption
            selected={mode === 'workers'}
            onSelect={() => setMode('workers')}
            icon={<Users className="size-5" aria-hidden />}
            title={t('Execute by Workers', 'تنفيذ بواسطة العمال')}
            bullets={[
              t('Release to workers after the plan is ready. Workers execute Tasks.', 'أطلِق للعمل بعد جاهزية الخطة. ينفّذ العمال المهام.'),
              t('Workers will see tasks in their accounts', 'سيرى العمال المهام في حساباتهم'),
              t('You can monitor progress from the order page.', 'يمكنك متابعة التقدم من صفحة الطلب.'),
            ]}
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('General information', 'معلومات عامة')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('Client', 'العميل')}</Label>
              <Combobox
                value={companyId}
                onChange={setCompanyId}
                options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                disabled={isEdit}
                placeholder={t('Select client…', 'اختر العميل…')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inbound-arrival">{t('Expected arrival', 'تاريخ الوصول المتوقع')}</Label>
              <Input
                id="inbound-arrival"
                type="date"
                required
                min={localCalendarDateYmd()}
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inbound-notes">{t('Notes', 'ملاحظات')}</Label>
            <Textarea
              id="inbound-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              rows={4}
              maxLength={NOTES_MAX}
              placeholder={t('Add any notes about this inbound order…', 'أضف أي ملاحظات عن طلب الوارد…')}
            />
            <p className="text-end text-xs tabular-nums text-muted-foreground">
              {notes.length} / {NOTES_MAX}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Products', 'المنتجات')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line) => {
            const p = productById.get(line.productId)
            return (
              <div key={line.key} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]">
                <div className="min-w-0 space-y-1">
                  <Combobox
                    value={line.productId}
                    onChange={(id) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key !== line.key
                            ? l
                            : {
                                ...l,
                                productId: id,
                                putaway:
                                  l.putaway.length === 1 ? [{ ...l.putaway[0]!, qty: l.expectedQuantity }] : l.putaway,
                              },
                        ),
                      )
                    }
                    options={optionsForLine(line.key)}
                    placeholder={t('Search and select a product…', 'ابحث واختر منتجاً…')}
                    searchPlaceholder={t('Search products…', 'ابحث عن منتج…')}
                    disabled={!companyId}
                    emptyLabel={t('All products are already on this order.', 'كل المنتجات مضافة مسبقاً.')}
                    className={FIELD_SURFACE}
                  />
                  {p ? (
                    <p className="text-xs text-muted-foreground">
                      {t('Current quantity:', 'الكمية الحالية:')}{' '}
                      <span className="font-mono font-semibold">{formatOnHand(p)}</span> {p.uom}
                    </p>
                  ) : null}
                </div>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  aria-label={t('Quantity', 'الكمية')}
                  value={line.expectedQuantity}
                  onChange={(e) => {
                    const qty = e.target.value
                    setLines((prev) =>
                      prev.map((l) =>
                        l.key !== line.key
                          ? l
                          : {
                              ...l,
                              expectedQuantity: qty,
                              putaway: l.putaway.length === 1 ? [{ ...l.putaway[0]!, qty }] : l.putaway,
                            },
                      ),
                    )
                  }}
                  disabled={!line.productId}
                  placeholder={line.productId ? t('Enter qty', 'أدخل الكمية') : t('Select product first', 'اختر منتجاً أولاً')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length <= 1}
                  aria-label={t('Remove line', 'إزالة البند')}
                  className={DANGER_ICON_BTN}
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={!canAddLine} onClick={addLine}>
              <Plus aria-hidden />
              {t('Add line', 'إضافة بند')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t('Total items:', 'إجمالي القطع:')}{' '}
              <span className="font-semibold tabular-nums">{totalItems.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {mode === 'admin' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('Receiving dock', 'رصيف الاستلام')}</CardTitle>
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
                  <Combobox
                    value={receivingDockId}
                    onChange={(id) => {
                      setReceivingDockId(id)
                      const label = dockOptions.find((o) => o.value === id)?.label
                      if (id && label) setLocationLabelById((prev) => ({ ...prev, [id]: label }))
                    }}
                    options={dockOptions}
                    onSearchChange={setReceivingDockSearch}
                    placeholder={t('Search and select a receiving dock…', 'ابحث واختر رصيف استلام…')}
                    searchPlaceholder={t('Search by name or ID…', 'ابحث بالاسم أو المعرف…')}
                    emptyLabel={t('No docks found.', 'لا توجد أرصفة.')}
                    className={FIELD_SURFACE}
                  />
                </div>
              ) : (
                <Alert>
                  <AlertTitle>{t('Set a default warehouse first.', 'عيّن مستودعاً افتراضياً أولاً.')}</AlertTitle>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                {t(
                  'This is where the shipment will arrive. All items will be received at this dock first.',
                  'هنا ستصل الشحنة. ستُستلم جميع الأصناف في هذا الرصيف أولاً.',
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Putaway plan', 'خطة التخزين')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {t(
                  'Distribute quantities across storage locations. Total allocated must equal expected quantity for each product.',
                  'وزّع الكميات على مواقع التخزين. يجب أن يساوي المجموع الكمية المتوقعة لكل منتج.',
                )}
              </p>
              {productLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('Add products above to plan putaway.', 'أضف منتجات أعلاه لتخطيط التخزين.')}</p>
              ) : (
                productLines.map((line) => (
                  <PutawayBlock
                    key={line.key}
                    line={line}
                    product={productById.get(line.productId)}
                    warehouseId={effectiveWarehouseId}
                    search={locationSearchByLine[line.key] ?? ''}
                    onSearchChange={(v) => setLocationSearchByLine((prev) => ({ ...prev, [line.key]: v }))}
                    locationLabelById={locationLabelById}
                    onLocationLabel={(id, label) => setLocationLabelById((prev) => ({ ...prev, [id]: label }))}
                    onChange={(next) => setLines((prev) => prev.map((l) => (l.key === line.key ? next : l)))}
                    isArabic={isArabic}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{t('Next steps', 'الخطوات التالية')}: </span>
        {t(
          'Click Save plan to create a draft. Print and Approve (or Release) from the order page.',
          'اضغط حفظ الخطة لإنشاء مسودة. اطبع ووافق (أو أطلِق) من صفحة الطلب.',
        )}
      </p>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-6">
        <Button type="button" variant="ghost" disabled={loading} className={DANGER_TEXT_BTN} onClick={() => navigate('/orders/inbound')}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t('Save plan', 'حفظ الخطة')}
        </Button>
      </div>
    </form>
  )
}

function PutawayBlock({
  line,
  product,
  warehouseId,
  search,
  onSearchChange,
  locationLabelById,
  onLocationLabel,
  onChange,
  isArabic,
}: {
  line: DraftLine
  product?: Product
  warehouseId: string
  search: string
  onSearchChange: (v: string) => void
  locationLabelById: Record<string, string>
  onLocationLabel: (id: string, label: string) => void
  onChange: (line: DraftLine) => void
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const expected = Number(line.expectedQuantity) || 0
  const allocated = line.putaway.reduce((a, r) => (r.locationId.trim() ? a + (Number(r.qty) || 0) : a), 0)
  const complete = expected > 0 && Math.abs(allocated - expected) < 1e-6

  /**
   * Storage putaway destinations only (`internal` / fridge / quarantine / scrap).
   * Receiving docks (`input`) and other non-storage types are excluded.
   */
  const lookup = useQuery({
    queryKey: QK.locations.putawayLookup(warehouseId, 'inbound_putaway', search),
    queryFn: async () => {
      // Preload primary Storage type; also search across warehouse then filter client-side.
      if (!search.trim()) {
        return LocationsApi.lookup({
          warehouseId,
          type: 'internal',
          status: 'active',
          limit: 50,
        })
      }
      return LocationsApi.lookup({
        warehouseId,
        search: search.trim(),
        status: 'active',
        limit: 50,
      })
    },
    enabled: Boolean(warehouseId),
  })

  const options = useMemo(() => {
    const items = (lookup.data?.items ?? [])
      .filter((loc) => isAllowedPutawayDestination(loc.type, 'putaway'))
      .map((loc) => ({
        value: loc.id,
        label: loc.fullPath || loc.name,
      }))
    for (const row of line.putaway) {
      if (row.locationId && !items.some((o) => o.value === row.locationId)) {
        items.unshift({
          value: row.locationId,
          label: locationLabelById[row.locationId] || row.locationId,
        })
      }
    }
    return items
  }, [lookup.data, line.putaway, locationLabelById])

  return (
    <div className="space-y-3 border-b pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{product ? `${product.sku} — ${product.name}` : '—'}</div>
          <div className="text-xs text-muted-foreground">
            {t('Expected qty', 'الكمية المتوقعة')}: <span className="font-mono">{line.expectedQuantity || '—'}</span>
          </div>
        </div>
        <AllocationBadge allocated={allocated} expected={expected} complete={complete} label={t('Allocated', 'مخصص')} />
      </div>
      {line.putaway.map((row) => (
        <div key={row.key} className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_140px_40px]">
          {warehouseId ? (
            <Combobox
              value={row.locationId}
              onChange={(locationId) => {
                const label = options.find((o) => o.value === locationId)?.label
                if (locationId && label) onLocationLabel(locationId, label)
                onChange({
                  ...line,
                  putaway: line.putaway.map((r) => (r.key === row.key ? { ...r, locationId } : r)),
                })
              }}
              options={options}
              onSearchChange={onSearchChange}
              placeholder={t('Search and select a location…', 'ابحث واختر موقعاً…')}
              searchPlaceholder={t('Search by name or ID…', 'ابحث بالاسم أو المعرف…')}
              emptyLabel={t('No locations found.', 'لا توجد مواقع.')}
              className={FIELD_SURFACE}
            />
          ) : (
            <div />
          )}
          <Input
            type="number"
            min={0}
            step="0.0001"
            aria-label={t('Allocate qty', 'كمية التخصيص')}
            value={row.qty}
            onChange={(e) =>
              onChange({
                ...line,
                putaway: line.putaway.map((r) => (r.key === row.key ? { ...r, qty: e.target.value } : r)),
              })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={line.putaway.length <= 1}
            aria-label={t('Remove location', 'إزالة الموقع')}
            className={DANGER_ICON_BTN}
            onClick={() =>
              onChange({
                ...line,
                putaway: line.putaway.filter((r) => r.key !== row.key),
              })
            }
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...line,
            putaway: [...line.putaway, { key: `${Date.now()}`, locationId: '', qty: '' }],
          })
        }
      >
        <Plus aria-hidden />
        {t('Add location', 'إضافة موقع')}
      </Button>
    </div>
  )
}
