import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { type AddAdjustmentLineInput } from '@/api/adjustments'
import { InventoryApi, type StockRow } from '@/api/inventory'
import { ProductsApi, type ProductListQuery } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { buildAdjustmentStockLocationOptions } from '@/lib/inventory-location-options'
import { fmtQty } from './inventory-shared'

type ProductSearchCategory = 'name' | 'sku' | 'barcode'

function productListQuery(companyId: string, category: ProductSearchCategory, query: string): ProductListQuery {
  const q = query.trim()
  const base: ProductListQuery = { companyId, limit: 200 }
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

export function AddAdjustmentLineForm({
  scope,
  loading,
  onAdd,
}: {
  scope: { warehouseId: string; companyId: string }
  loading: boolean
  onAdd: (payload: {
    body: AddAdjustmentLineInput
    display: {
      sku: string
      productName: string
      locationPath: string
      lotLabel?: string
      quantityBefore: string
    }
  }) => void
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [productSearchCategory, setProductSearchCategory] = useState<ProductSearchCategory>('name')
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [lotId, setLotId] = useState('')
  const [qtyAfter, setQtyAfter] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [productSearch])

  const products = useQuery({
    queryKey: [...QK.products, scope.companyId, 'adj-form', productSearchCategory, debouncedProductSearch],
    queryFn: () =>
      ProductsApi.list(productListQuery(scope.companyId, productSearchCategory, debouncedProductSearch)),
    enabled: !!scope.companyId,
    staleTime: 60_000,
  })

  const productMeta = useMemo(
    () => (products.data?.items ?? []).find((p) => p.id === productId),
    [products.data?.items, productId],
  )

  useEffect(() => {
    setLotId('')
    setLocationId('')
  }, [productId])

  useEffect(() => {
    setLotId('')
  }, [locationId])

  const lots = useQuery({
    queryKey: [...QK.products, productId, 'lots'],
    queryFn: () => ProductsApi.listLots(productId),
    enabled: !!productId && productMeta?.trackingType === 'lot',
    staleTime: 60_000,
  })

  const stockByProduct = useQuery({
    queryKey: [...QK.inventoryStock, 'adj-line-form-stock', scope.warehouseId, scope.companyId, productId],
    queryFn: () =>
      InventoryApi.stock({
        warehouseId: scope.warehouseId,
        companyId: scope.companyId,
        productId,
        limit: 500,
        offset: 0,
      }),
    enabled: !!productId,
    staleTime: 30_000,
  })

  const adjustmentLocationsWithProduct = useMemo(
    () => buildAdjustmentStockLocationOptions(stockByProduct.data?.items ?? []),
    [stockByProduct.data?.items],
  )

  const validProductLocationIds = useMemo(
    () => new Set(adjustmentLocationsWithProduct.map((l) => l.id)),
    [adjustmentLocationsWithProduct],
  )

  useEffect(() => {
    if (!productId || !locationId) return
    if (!stockByProduct.isFetched) return
    if (!validProductLocationIds.has(locationId)) setLocationId('')
  }, [productId, locationId, stockByProduct.isFetched, validProductLocationIds])

  const stockRow = useMemo((): StockRow | null => {
    const items = stockByProduct.data?.items ?? []
    if (!productId || !locationId) return null
    if (productMeta?.trackingType === 'lot') {
      if (!lotId) return null
      return (
        items.find(
          (r) =>
            r.productId === productId &&
            r.locationId === locationId &&
            (r.lotId === lotId || r.lot?.id === lotId),
        ) ?? null
      )
    }
    return (
      items.find(
        (r) => r.productId === productId && r.locationId === locationId && !(r.lotId ?? r.lot?.id),
      ) ??
      items.find((r) => r.productId === productId && r.locationId === locationId) ??
      null
    )
  }, [stockByProduct.data?.items, productId, locationId, lotId, productMeta?.trackingType])

  const isLotTracked = productMeta?.trackingType === 'lot'
  const showOnHandPanel = !!productId && !!locationId && (!isLotTracked || !!lotId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!productMeta) return
    const qty = Number(qtyAfter)
    const body: AddAdjustmentLineInput = { productId, locationId, quantityAfter: qty }
    if (productMeta.trackingType === 'lot') {
      if (!lotId) {
        toast.error(t('Select an existing lot.', 'اختر دفعة موجودة.'))
        return
      }
      body.lotId = lotId
    }
    const loc = adjustmentLocationsWithProduct.find((l) => l.id === locationId)
    const lotLabel =
      productMeta.trackingType === 'lot' && lotId
        ? (lots.data ?? []).find((lot) => lot.id === lotId)?.lotNumber
        : undefined

    onAdd({
      body,
      display: {
        sku: productMeta.sku,
        productName: productMeta.name,
        locationPath: loc?.label ?? locationId,
        lotLabel,
        quantityBefore: stockRow?.quantityOnHand ?? '0',
      },
    })
    setQtyAfter('')
    setLotId('')
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm font-semibold">{t('Add line', 'إضافة بند')}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adj-prod-search">{t('Search products', 'بحث المنتجات')}</Label>
            <Input
              id="adj-prod-search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={t('Contains…', 'يحتوي على…')}
            />
          </div>
          <div className="space-y-1.5">
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
                <SelectItem value="sku">{t('SKU', 'رمز الصنف')}</SelectItem>
                <SelectItem value="barcode">{t('Barcode', 'الباركود')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('Product', 'المنتج')}</Label>
            <Combobox
              value={productId}
              onChange={setProductId}
              options={(products.data?.items ?? []).map((p) => ({
                value: p.id,
                label: `${p.sku} — ${p.name}`,
              }))}
              placeholder={t('Select product…', 'اختر المنتج…')}
              disabled={!scope.companyId}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Location', 'الموقع')}</Label>
            <Combobox
              value={locationId}
              onChange={setLocationId}
              disabled={!productId || stockByProduct.isPending}
              options={adjustmentLocationsWithProduct.map((l) => ({
                value: l.id,
                label: l.label,
              }))}
              placeholder={t('Pick location…', 'اختر الموقع…')}
            />
          </div>
        </div>
        {isLotTracked ? (
          <div className="space-y-1.5">
            <Label>{t('Lot (required)', 'الدفعة (مطلوب)')}</Label>
            <Combobox
              value={lotId}
              onChange={setLotId}
              options={(lots.data ?? []).map((lot) => ({ value: lot.id, label: lot.lotNumber }))}
              placeholder={t('Pick lot', 'اختر الدفعة')}
              disabled={lots.isLoading}
            />
          </div>
        ) : null}
        {showOnHandPanel ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t('On hand', 'المتوفر')}:{' '}
            <span className="font-mono font-semibold text-foreground">
              {stockRow ? fmtQty(stockRow.quantityOnHand) : '—'}
            </span>
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="adj-qty">{t('Qty after approve', 'الكمية بعد الاعتماد')}</Label>
          <Input id="adj-qty" type="number" min={0} step={0.0001} required value={qtyAfter} onChange={(e) => setQtyAfter(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {t('Add line', 'إضافة بند')}
        </Button>
      </form>
    </div>
  )
}
