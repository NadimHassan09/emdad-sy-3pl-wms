import type { ReactNode } from 'react'
import { useUiPreferences } from '@emdad/core'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import type { Product } from '@/api/products'
import { productUomLabel } from '@/lib/product-labels'
import { ProductStatusBadge } from './products-ui'

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const s = String(v).trim()
  return s.length ? s : '—'
}

export function ProductDetailsCard({ product }: { product: Product }) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const dims = [product.lengthCm, product.widthCm, product.heightCm]
  const dimsText =
    dims.every((d) => d == null || String(d).trim() === '')
      ? '—'
      : `${display(product.lengthCm)} × ${display(product.widthCm)} × ${display(product.heightCm)} ${t('cm', 'سم')}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{product.name}</CardTitle>
        <p className="text-sm text-muted-foreground font-mono">
          {product.sku}
          {product.company?.name ? ` · ${product.company.name}` : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('Status', 'الحالة')} value={<ProductStatusBadge status={product.status} isArabic={isArabic} />} />
          <Field label="UOM" value={productUomLabel(product.uom, isArabic)} />
          <Field label={t('Barcode', 'الباركود')} value={display(product.barcode)} mono />
          <Field label={t('On hand', 'المتوفر')} value={display(product.totalOnHand)} mono />
          <Field label={t('Reserved', 'محجوز')} value={display(product.totalReserved)} mono />
          <Field label={t('Min stock', 'حد أدنى')} value={String(product.minStockThreshold ?? 0)} mono />
          <Field label={t('Dimensions', 'الأبعاد')} value={dimsText} />
          <Field label={t('Weight', 'الوزن')} value={product.weightKg != null ? `${display(product.weightKg)} kg` : '—'} />
          <Field
            label={t('Tracking', 'التتبع')}
            value={
              product.trackingType === 'lot'
                ? t('Lot', 'دفعة')
                : product.trackingType === 'package'
                  ? t('Package', 'حزمة')
                  : t('None', 'لا شيء')
            }
          />
        </div>
        {product.description?.trim() ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('Description', 'الوصف')}</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{product.description}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
