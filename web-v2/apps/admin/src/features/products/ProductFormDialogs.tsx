import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Combobox } from '@emdad/ui/ui/combobox'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import { CompaniesApi } from '@/api/companies'
import {
  type CreateProductInput,
  type Product,
  type ProductUom,
  type UpdateProductInput,
  ProductsApi,
} from '@/api/products'
import { QK } from '@/constants/query-keys'
import { generateSku } from '@/lib/identifiers'
import { PRODUCT_UOM_VALUES, productUomLabel } from '@/lib/product-labels'

function parseOptionalCreateDim(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function parseDimUpdate(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type CreateProps = {
  open: boolean
  onClose: () => void
  loading: boolean
  onSubmit: (input: CreateProductInput) => void
}

export function CreateProductDialog({ open, onClose, loading, onSubmit }: CreateProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [companyId, setCompanyId] = useState('')
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [uom, setUom] = useState<ProductUom>('piece')
  const [minStock, setMinStock] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [expiryTracking, setExpiryTracking] = useState(false)

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    enabled: open,
  })

  const companyOptions = useMemo(
    () => (companies.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companies.data],
  )

  useEffect(() => {
    if (!open) return
    if (!companyId && companies.data?.length) setCompanyId(companies.data[0]!.id)
  }, [open, companyId, companies.data])

  useEffect(() => {
    if (!open) {
      setCompanyId('')
      setName('')
      setSku('')
      setBarcode('')
      setDescription('')
      setUom('piece')
      setMinStock('')
      setLengthCm('')
      setWidthCm('')
      setHeightCm('')
      setWeightKg('')
      setExpiryTracking(false)
    }
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const input: CreateProductInput = {
      companyId,
      name,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      uom,
      expiryTracking,
      minStockThreshold: minStock.trim() === '' ? undefined : Math.max(0, parseInt(minStock, 10) || 0),
    }
    const l = parseOptionalCreateDim(lengthCm)
    const w = parseOptionalCreateDim(widthCm)
    const h = parseOptionalCreateDim(heightCm)
    const wt = parseOptionalCreateDim(weightKg)
    if (l !== undefined) input.lengthCm = l
    if (w !== undefined) input.widthCm = w
    if (h !== undefined) input.heightCm = h
    if (wt !== undefined) input.weightKg = wt
    onSubmit(input)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('New product', 'منتج جديد')}</DialogTitle>
          <DialogDescription>{t('Add a catalog item for a client.', 'إضافة منتج لعميل.')}</DialogDescription>
        </DialogHeader>
        <form id="create-product" onSubmit={submit} className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto pe-1">
          <div className="space-y-1.5">
            <Label>{t('Client', 'العميل')} *</Label>
            <Combobox value={companyId} onChange={setCompanyId} options={companyOptions} placeholder={t('Pick a client…', 'اختر عميلاً…')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Name', 'الاسم')} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label>{t('SKU (optional)', 'SKU (اختياري)')}</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSku(generateSku())}>
              {t('Generate SKU', 'إنشاء SKU')}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Barcode (optional)', 'Barcode (اختياري)')}</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
            <p className="text-sm text-muted-foreground">{t('Leave blank to auto-generate.', 'اتركه فارغاً للإنشاء التلقائي.')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Description (optional)', 'الوصف (اختياري)')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>UOM</Label>
            <Select value={uom} onValueChange={(v) => setUom(v as ProductUom)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_UOM_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {productUomLabel(value, isArabic)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={expiryTracking} onCheckedChange={(v) => setExpiryTracking(v === true)} />
            {t('Product has an expiry date', 'المنتج له تاريخ انتهاء')}
          </label>
          <div className="space-y-1.5">
            <Label>{t('Min stock threshold', 'حد المخزون الأدنى')}</Label>
            <Input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>{t('Length (cm)', 'الطول')}</Label>
              <Input type="number" min={0} step="0.01" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Width (cm)', 'العرض')}</Label>
              <Input type="number" min={0} step="0.01" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Height (cm)', 'الارتفاع')}</Label>
              <Input type="number" min={0} step="0.01" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Weight (kg)', 'الوزن (كغ)')}</Label>
            <Input type="number" min={0} step="0.0001" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={loading} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="create-product" disabled={loading || !companyId || !name.trim()}>
            {t('Create', 'إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type EditProps = {
  open: boolean
  product: Product | null
  loading: boolean
  onClose: () => void
  onSubmit: (input: UpdateProductInput) => void
}

export function EditProductDialog({ open, product, loading, onClose, onSubmit }: EditProps) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [uom, setUom] = useState<ProductUom>('piece')
  const [minStock, setMinStock] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [expiryTracking, setExpiryTracking] = useState(false)

  useEffect(() => {
    if (!product || !open) return
    setName(product.name)
    setSku(product.sku)
    setBarcode(product.barcode ?? '')
    setDescription(product.description ?? '')
    setUom(product.uom)
    setMinStock(String(product.minStockThreshold ?? ''))
    setLengthCm(product.lengthCm != null ? String(product.lengthCm) : '')
    setWidthCm(product.widthCm != null ? String(product.widthCm) : '')
    setHeightCm(product.heightCm != null ? String(product.heightCm) : '')
    setWeightKg(product.weightKg != null ? String(product.weightKg) : '')
    setExpiryTracking(product.expiryTracking)
  }, [product, open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      description: description.trim() || undefined,
      uom,
      expiryTracking,
      minStockThreshold: minStock.trim() === '' ? 0 : Math.max(0, parseInt(minStock, 10) || 0),
      lengthCm: parseDimUpdate(lengthCm),
      widthCm: parseDimUpdate(widthCm),
      heightCm: parseDimUpdate(heightCm),
      weightKg: parseDimUpdate(weightKg),
    })
  }

  return (
    <Dialog open={open && !!product} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Edit product', 'تعديل المنتج')}</DialogTitle>
          <DialogDescription>{product?.sku}</DialogDescription>
        </DialogHeader>
        <form id="edit-product" onSubmit={submit} className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto pe-1">
          <div className="space-y-1.5">
            <Label>{t('Name', 'الاسم')} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Barcode</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Description', 'الوصف')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>UOM</Label>
            <Select value={uom} onValueChange={(v) => setUom(v as ProductUom)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_UOM_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {productUomLabel(value, isArabic)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={expiryTracking} onCheckedChange={(v) => setExpiryTracking(v === true)} />
            {t('Expiry tracking', 'تتبع تاريخ الانتهاء')}
          </label>
          <div className="space-y-1.5">
            <Label>{t('Min stock threshold', 'حد المخزون الأدنى')}</Label>
            <Input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>{t('Length (cm)', 'الطول')}</Label>
              <Input type="number" min={0} step="0.01" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Width (cm)', 'العرض')}</Label>
              <Input type="number" min={0} step="0.01" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Height (cm)', 'الارتفاع')}</Label>
              <Input type="number" min={0} step="0.01" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('Weight (kg)', 'الوزن (كغ)')}</Label>
            <Input type="number" min={0} step="0.0001" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={loading} onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="edit-product" disabled={loading || !name.trim()}>
            {t('Save', 'حفظ')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
