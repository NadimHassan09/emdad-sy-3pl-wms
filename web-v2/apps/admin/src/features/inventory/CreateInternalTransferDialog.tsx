import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScanLine } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { CompaniesApi } from '@/api/companies'
import { InventoryApi } from '@/api/inventory'
import type { LocationType } from '@/api/locations'
import { ProductsApi, type ProductListQuery } from '@/api/products'
import { BarcodeScanModal } from '@/features/tasks/components/BarcodeScanModal'
import { WedgeScanField } from '@/features/tasks/components/WedgeScanField'
import { QK } from '@/constants/query-keys'
import { useResolvedLocations } from '@/hooks/useResolvedLocations'
import {
  buildStockSourceLocationOptions,
  transferableQtyAtRow,
  uniqueStockLocationIds,
} from '@/lib/inventory-location-options'
import { resolveLocationByScan } from '@/lib/location-resolve'
import { AdjustmentStockLocationPicker } from './AdjustmentStockLocationPicker'

type TransferLocationTypeFilter = '' | 'internal' | 'fridge' | 'quarantine' | 'scrap'
type ProductSearchCategory = 'name' | 'sku' | 'barcode'

function productListQuery(
  companyId: string | undefined,
  category: ProductSearchCategory,
  query: string,
): ProductListQuery {
  const q = query.trim()
  const base: ProductListQuery = { limit: 200, ...(companyId ? { companyId } : {}) }
  if (!q) return base
  switch (category) {
    case 'name':
      return { ...base, productName: q }
    case 'sku':
      return { ...base, sku: q }
    case 'barcode':
      return { ...base, productBarcode: q }
    default:
      return base
  }
}

export function CreateInternalTransferDialog({
  open,
  onClose,
  warehouseId,
}: {
  open: boolean
  onClose: () => void
  warehouseId: string
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const [companyId, setCompanyId] = useState('')
  const [productSearchCategory, setProductSearchCategory] = useState<ProductSearchCategory>('name')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [sourceScan, setSourceScan] = useState('')
  const [destScan, setDestScan] = useState('')
  const [locCameraTarget, setLocCameraTarget] = useState<'from' | 'to' | null>(null)
  const [productId, setProductId] = useState('')
  const [lotId, setLotId] = useState('')
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<TransferLocationTypeFilter>('')
  const [destTypeFilter, setDestTypeFilter] = useState<TransferLocationTypeFilter>('')
  const [quantity, setQuantity] = useState('')

  useEffect(() => {
    if (!open) return
    setCompanyId('')
    setProductSearchCategory('name')
    setProductSearch('')
    setDebouncedProductSearch('')
    setProductId('')
    setLotId('')
    setFromLocationId('')
    setToLocationId('')
    setSourceTypeFilter('')
    setDestTypeFilter('')
    setQuantity('')
    setSourceScan('')
    setDestScan('')
    setLocCameraTarget(null)
  }, [open])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [productSearch])

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: open,
  })

  const products = useQuery({
    queryKey: [
      ...QK.products,
      'internal-transfer-create',
      companyId,
      productSearchCategory,
      debouncedProductSearch,
    ],
    queryFn: () =>
      ProductsApi.list(
        productListQuery(companyId.trim() || undefined, productSearchCategory, debouncedProductSearch),
      ),
    enabled: open,
    staleTime: 60_000,
  })

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  )

  const stockCompanyId = productMeta?.companyId || companyId.trim()
  const lotTracked = productMeta?.trackingType === 'lot'

  useEffect(() => {
    if (productMeta?.companyId && productMeta.companyId !== companyId) {
      setCompanyId(productMeta.companyId)
    }
  }, [productMeta?.companyId, companyId])

  useEffect(() => {
    setLotId('')
    setFromLocationId('')
    setToLocationId('')
  }, [productId])

  useEffect(() => {
    setFromLocationId('')
    setToLocationId('')
  }, [lotId])

  useEffect(() => {
    setFromLocationId('')
  }, [sourceTypeFilter])

  useEffect(() => {
    setToLocationId('')
  }, [destTypeFilter])

  const lots = useQuery({
    queryKey: [...QK.products, productId, 'lots', 'internal-transfer-create'],
    queryFn: () => ProductsApi.listLots(productId),
    enabled: !!productId && productMeta?.trackingType === 'lot' && open,
    staleTime: 60_000,
  })

  const stockByProduct = useQuery({
    queryKey: [...QK.inventoryStock, 'internal-transfer-create', warehouseId, stockCompanyId, productId],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId,
        companyId: stockCompanyId,
        productId,
        limit: 500,
      }),
    enabled: !!warehouseId && !!stockCompanyId && !!productId && open,
    staleTime: 30_000,
  })

  const stockLocationIds = useMemo(
    () => uniqueStockLocationIds(stockByProduct.data?.items ?? []),
    [stockByProduct.data?.items],
  )

  const { locationById } = useResolvedLocations(
    open && productId && stockByProduct.isFetched ? stockLocationIds : [],
  )

  const eligibleLocationIds = useMemo(() => new Set([...locationById.keys()]), [locationById])

  const lotOptionsWithStock = useMemo(() => {
    if (!lotTracked || !productId) return []

    const byLot = new Map<string, { id: string; lotNumber: string; expiryDate: string | null }>()

    for (const row of stockByProduct.data?.items ?? []) {
      if (!eligibleLocationIds.has(row.locationId)) continue
      const id = row.lotId ?? row.lot?.id
      if (!id) continue
      const onHand = Number(row.quantityOnHand)
      if (!Number.isFinite(onHand) || onHand <= 0) continue

      if (!byLot.has(id)) {
        const catalog = (lots.data ?? []).find((l) => l.id === id)
        byLot.set(id, {
          id,
          lotNumber: row.lot?.lotNumber ?? catalog?.lotNumber ?? id.slice(0, 8),
          expiryDate: row.lot?.expiryDate ?? catalog?.expiryDate ?? null,
        })
      }
    }

    return [...byLot.values()].sort((a, b) => a.lotNumber.localeCompare(b.lotNumber))
  }, [lotTracked, productId, eligibleLocationIds, stockByProduct.data?.items, lots.data])

  const sourceLocationOptions = useMemo(
    () =>
      buildStockSourceLocationOptions({
        stockItems: stockByProduct.data?.items ?? [],
        locationById,
        productId,
        lotId,
        lotTracked,
        sourceTypeFilter: sourceTypeFilter || undefined,
        isArabic,
        availWord: t('avail', 'متاح'),
      }),
    [stockByProduct.data?.items, locationById, productId, lotId, lotTracked, sourceTypeFilter, isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const availableQty = useMemo(() => {
    if (!productId || !fromLocationId) return null
    if (lotTracked && !lotId) return null

    const items = stockByProduct.data?.items ?? []
    let total = 0
    for (const row of items) {
      if (row.productId !== productId || row.locationId !== fromLocationId) continue
      const rowLot = row.lotId ?? row.lot?.id ?? null
      if (lotTracked) {
        if (rowLot !== lotId) continue
      } else if (rowLot) {
        continue
      }
      total += transferableQtyAtRow(row)
    }
    return total > 0 ? total : null
  }, [stockByProduct.data?.items, productId, fromLocationId, lotId, lotTracked])

  const transferMut = useMutation({
    mutationFn: InventoryApi.internalTransfer,
    onSuccess: () => {
      toast.success(t('Internal transfer recorded.', 'تم تسجيل النقل الداخلي.'))
      qc.invalidateQueries({ queryKey: QK.inventoryStock })
      qc.invalidateQueries({ queryKey: QK.inventoryStockByProduct })
      qc.invalidateQueries({ queryKey: QK.ledger })
      setQuantity('')
      setProductId('')
      setLotId('')
      setProductSearch('')
      setDebouncedProductSearch('')
      setProductSearchCategory('name')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function applyLocationScan(target: 'from' | 'to', code: string) {
    const trimmed = code.trim()
    if (!trimmed || !warehouseId) return
    try {
      const hit = await resolveLocationByScan(warehouseId, trimmed)
      if (!hit) {
        toast.error(t('No location matches this barcode.', 'لا يوجد موقع مطابق لهذا الباركود.'))
        return
      }
      if (target === 'from') {
        setFromLocationId(hit.id)
        setSourceScan('')
        toast.success(`${t('Source', 'المصدر')}: ${hit.fullPath || hit.name}`)
      } else {
        setToLocationId(hit.id)
        setDestScan('')
        toast.success(`${t('Destination', 'الوجهة')}: ${hit.fullPath || hit.name}`)
      }
      setLocCameraTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Location scan failed.', 'فشل مسح الموقع.'))
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!productMeta || !warehouseId) return
    const transferCompanyId = productMeta.companyId

    const qtyNum = Number(quantity)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error(t('Enter a positive quantity.', 'أدخل كمية موجبة.'))
      return
    }
    if (fromLocationId === toLocationId) {
      toast.error(t('Destination must differ from source.', 'يجب أن تختلف الوجهة عن المصدر.'))
      return
    }
    if (productMeta.trackingType === 'lot' && !lotId) {
      toast.error(t('Select a lot for this product.', 'اختر دفعة لهذا المنتج.'))
      return
    }
    if (availableQty != null && qtyNum > availableQty) {
      toast.error(
        t('Quantity exceeds available stock at the source location.', 'الكمية تتجاوز المخزون المتاح في موقع المصدر.'),
      )
      return
    }

    transferMut.mutate({
      companyId: transferCompanyId,
      productId,
      fromLocationId,
      toLocationId,
      quantity: qtyNum,
      ...(productMeta.trackingType === 'lot' && lotId ? { lotId } : {}),
    })
  }

  const formReady =
    !!productMeta &&
    !!productId &&
    !!fromLocationId &&
    !!toLocationId &&
    !!quantity.trim() &&
    (!lotTracked || !!lotId)

  const typeOptions: { value: TransferLocationTypeFilter; en: string; ar: string }[] = [
    { value: '', en: 'All types', ar: 'كل الأنواع' },
    { value: 'internal', en: 'Storage', ar: 'تخزين' },
    { value: 'fridge', en: 'Fridge', ar: 'تبريد' },
    { value: 'quarantine', en: 'Quarantine', ar: 'حجر' },
    { value: 'scrap', en: 'Scrap', ar: 'إتلاف' },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && !transferMut.isPending && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Create internal transfer', 'إنشاء نقل داخلي')}</DialogTitle>
          </DialogHeader>
          <form id="internal-transfer-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('Client (optional)', 'العميل (اختياري)')}</Label>
              <Combobox
                value={companyId}
                onChange={(v) => {
                  setCompanyId(v)
                  setProductId('')
                }}
                options={[
                  { value: '', label: t('All clients', 'كل العملاء') },
                  ...(companies.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                ]}
                placeholder={companies.isLoading ? t('Loading…', 'جارٍ التحميل…') : t('All clients', 'كل العملاء')}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('Find product', 'البحث عن منتج')}
              </p>
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <div className="space-y-2">
                  <Label>{t('Search', 'بحث')}</Label>
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={t('Contains…', 'يحتوي على…')}
                    className={productSearchCategory !== 'name' ? 'font-mono' : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('Search by', 'البحث حسب')}</Label>
                  <Select
                    value={productSearchCategory}
                    onValueChange={(v) => setProductSearchCategory(v as ProductSearchCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">{t('Product name', 'اسم المنتج')}</SelectItem>
                      <SelectItem value="sku">SKU</SelectItem>
                      <SelectItem value="barcode">{t('Barcode', 'الباركود')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="secondary" className="h-10" onClick={() => setScanOpen(true)}>
                  <ScanLine className="size-5" aria-hidden />
                  <span className="sr-only">{t('Scan barcode', 'مسح الباركود')}</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('Product', 'المنتج')} *</Label>
              <Combobox
                value={productId}
                onChange={setProductId}
                options={(products.data?.items ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.sku} - ${p.name}`,
                }))}
                placeholder={products.isLoading ? t('Loading…', 'جارٍ التحميل…') : t('Select product…', 'اختر المنتج…')}
                emptyLabel={t('No products match the filters.', 'لا توجد منتجات مطابقة.')}
              />
            </div>

            {productMeta?.trackingType === 'lot' ? (
              <div className="space-y-2">
                <Label>{t('Lot', 'الدفعة')} *</Label>
                <Combobox
                  value={lotId}
                  onChange={setLotId}
                  options={lotOptionsWithStock.map((lot) => ({
                    value: lot.id,
                    label: lot.lotNumber,
                  }))}
                  placeholder={stockByProduct.isPending ? t('Loading stock…', 'جاري تحميل المخزون…') : t('Select lot…', 'اختر الدفعة…')}
                  disabled={!productId || stockByProduct.isPending}
                />
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('Source location type', 'نوع موقع المصدر')}</Label>
                <Select
                  value={sourceTypeFilter || '__all__'}
                  onValueChange={(v) => setSourceTypeFilter((v === '__all__' ? '' : v) as TransferLocationTypeFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((o) => (
                      <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>
                        {t(o.en, o.ar)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('Destination location type', 'نوع موقع الوجهة')}</Label>
                <Select
                  value={destTypeFilter || '__all__'}
                  onValueChange={(v) => setDestTypeFilter((v === '__all__' ? '' : v) as TransferLocationTypeFilter)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((o) => (
                      <SelectItem key={`d-${o.value || '__all__'}`} value={o.value || '__all__'}>
                        {t(o.en, o.ar)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('Source location', 'موقع المصدر')} *</Label>
                <Combobox
                  value={fromLocationId}
                  onChange={setFromLocationId}
                  disabled={!productId || stockByProduct.isPending || (lotTracked && !lotId)}
                  options={sourceLocationOptions.map((o) => ({ value: o.id, label: o.label }))}
                  placeholder={
                    !productId
                      ? t('Select product…', 'اختر المنتج…')
                      : lotTracked && !lotId
                        ? t('Select lot first…', 'اختر الدفعة أولاً…')
                        : t('Where stock is now…', 'حيث يوجد المخزون…')
                  }
                />
                <WedgeScanField
                  label={t('Scan source location', 'مسح موقع المصدر')}
                  value={sourceScan}
                  onChange={setSourceScan}
                  onScan={(code) => void applyLocationScan('from', code)}
                  onCameraClick={() => setLocCameraTarget('from')}
                  placeholder={t('Location barcode + Enter', 'باركود الموقع + Enter')}
                  disabled={!warehouseId}
                />
              </div>
              <div className="space-y-2">
                <AdjustmentStockLocationPicker
                  label={t('Destination location', 'موقع الوجهة')}
                  required
                  warehouseId={warehouseId}
                  value={toLocationId}
                  onChange={setToLocationId}
                  typeFilter={(destTypeFilter || '') as LocationType | ''}
                  excludeId={fromLocationId}
                  disabled={!warehouseId || !fromLocationId}
                  placeholder={
                    !fromLocationId ? t('Pick source first…', 'اختر المصدر أولاً…') : t('Search destination bin…', 'ابحث عن bin الوجهة…')
                  }
                />
                <WedgeScanField
                  label={t('Scan destination location', 'مسح موقع الوجهة')}
                  value={destScan}
                  onChange={setDestScan}
                  onScan={(code) => void applyLocationScan('to', code)}
                  onCameraClick={() => setLocCameraTarget('to')}
                  placeholder={t('Location barcode + Enter', 'باركود الموقع + Enter')}
                  disabled={!warehouseId}
                />
              </div>
            </div>

            {fromLocationId && productId && (!lotTracked || !!lotId) ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <span className="font-medium">{t('Available at source', 'المتاح في المصدر')}:</span>{' '}
                {stockByProduct.isPending ? (
                  '…'
                ) : availableQty != null ? (
                  <span className="font-mono font-semibold">{availableQty.toLocaleString()}</span>
                ) : (
                  '—'
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t('Quantity to transfer', 'الكمية للنقل')} *</Label>
              <Input
                type="number"
                min={0.0001}
                step={0.0001}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={transferMut.isPending}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button type="submit" form="internal-transfer-form" disabled={!formReady || transferMut.isPending}>
              {t('Create transfer', 'إنشاء النقل')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          setProductSearchCategory('barcode')
          setProductSearch(text.trim())
          setScanOpen(false)
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
      <BarcodeScanModal
        open={locCameraTarget != null}
        onClose={() => setLocCameraTarget(null)}
        onScan={(text) => {
          if (locCameraTarget) void applyLocationScan(locCameraTarget, text)
        }}
        onCameraError={(msg) => toast.error(msg)}
      />
    </>
  )
}
