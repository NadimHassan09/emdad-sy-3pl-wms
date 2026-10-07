import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { ProductsApi } from '@/api/products'
import { QK } from '@/constants/query-keys'
import { ProductDetailsCard } from './ProductDetailsCard'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ProductDetailPage() {
  const { sku = '' } = useParams<{ sku: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const decoded = decodeURIComponent(sku)
  const loadById = UUID_RE.test(decoded)

  const productQuery = useQuery({
    queryKey: [...QK.products, loadById ? 'by-id' : 'by-sku', decoded],
    queryFn: async () => {
      if (loadById) return ProductsApi.get(decoded)
      const list = await ProductsApi.list({ sku: decoded, limit: 50 })
      const exact = list.items.filter((p) => p.sku.toLowerCase() === decoded.toLowerCase())
      if (exact.length === 1) return exact[0]!
      if (exact.length > 1) {
        return exact.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]!
      }
      return null
    },
    enabled: !!decoded,
  })

  const product = productQuery.data

  return (
    <div className="space-y-5 pb-8">
      <Button variant="ghost" size="sm" className="ps-0" asChild>
        <Link to="/products">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('Back to products', 'العودة إلى المنتجات')}
        </Link>
      </Button>

      <PageHeader
        title={product?.name ?? t('Product details', 'تفاصيل المنتج')}
        description={
          product?.sku
            ? `${product.sku}${product.company?.name ? ` · ${product.company.name}` : ''}`
            : t('Warehouse product catalog', 'كتالوج منتجات المستودع')
        }
      />

      {productQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Could not load product.', 'تعذّر تحميل المنتج.')}</AlertTitle>
          <AlertDescription>{(productQuery.error as Error).message}</AlertDescription>
        </Alert>
      ) : null}

      {productQuery.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-8 w-2/5 max-w-sm" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {!productQuery.isPending && !productQuery.isError && !product ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Product not found for this SKU.', 'لم يُعثر على منتج بهذا SKU.')}</AlertTitle>
        </Alert>
      ) : null}

      {product ? <ProductDetailsCard product={product} /> : null}

      {productQuery.isFetching && !productQuery.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('Refreshing…', 'جاري التحديث…')}
        </p>
      ) : null}
    </div>
  )
}
