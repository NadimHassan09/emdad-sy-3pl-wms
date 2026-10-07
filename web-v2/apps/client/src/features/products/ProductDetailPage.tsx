import { isAxiosError } from 'axios'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import { ErrorState, Link, PageHeader, StatusBadge, type Tone, useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { useAuth } from '@/auth/AuthContext'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { clientMediaSrc } from '@/lib/client-media'
import { isClientAdmin } from '@/lib/rbac'
import { fetchClientProduct } from '@/services/clientProductsService'
import {
  DetailField,
  MetricCard,
  fmtQty,
  productUomLabel,
} from './products-ui'

const CATALOG_STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  suspended: 'warning',
  archived: 'neutral',
}

function catalogStatusLabel(status: string, isArabic: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    active: { en: 'Active', ar: 'نشط' },
    suspended: { en: 'Suspended', ar: 'موقوف' },
    archived: { en: 'Archived', ar: 'مؤرشف' },
  }
  const row = map[status]
  return row ? (isArabic ? row.ar : row.en) : status
}

export function ProductDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = isClientAdmin(user?.role)
  const billingAccess = useClientOperationalAccess(isArabic)

  const productQuery = useQuery({
    queryKey: ['client', 'products', id],
    queryFn: () => fetchClientProduct(id),
    enabled: !!id,
  })

  const data = productQuery.data
  const notFound =
    productQuery.error && isAxiosError(productQuery.error) && productQuery.error.response?.status === 404

  const dimensions =
    data && (data.lengthCm || data.widthCm || data.heightCm)
      ? [data.lengthCm, data.widthCm, data.heightCm].filter(Boolean).join(' × ')
      : null

  const imageSrc = clientMediaSrc(data?.imageUrl)

  return (
    <div className="space-y-5 pb-8">
      <Link
        to="/products"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t('Back to products', 'العودة إلى المنتجات')}
      </Link>

      {notFound ? (
        <ErrorState title={t('Product not found.', 'المنتج غير موجود.')} />
      ) : productQuery.isError ? (
        <ErrorState
          title={t('Could not load product.', 'تعذر تحميل المنتج.')}
          description={(productQuery.error as Error).message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void productQuery.refetch()}
        />
      ) : null}

      {productQuery.isPending ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-8 w-2/5 max-w-sm" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-52 w-full" />
        </div>
      ) : null}

      {data ? (
        <>
          <PageHeader
            title={
              <span className="inline-flex max-w-full flex-wrap items-center gap-3">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt=""
                    className="size-10 shrink-0 rounded-lg border object-cover"
                  />
                ) : null}
                <span className="min-w-0 truncate">{data.name}</span>
                <StatusBadge tone={CATALOG_STATUS_TONE[data.status] ?? 'neutral'}>
                  {catalogStatusLabel(data.status, isArabic)}
                </StatusBadge>
              </span>
            }
            description={t('Stock and catalog fields for this SKU', 'مخزون وحقول الكتالوج لهذا الصنف')}
            actions={
              canManage ? (
                <Button
                  variant="outline"
                  disabled={!billingAccess.operationalAllowed}
                  title={
                    !billingAccess.operationalAllowed
                      ? billingAccess.actionBlockedReason
                      : undefined
                  }
                  onClick={() => navigate(`/products/${data.id}/edit`)}
                >
                  <Pencil className="size-4" aria-hidden />
                  {t('Edit', 'تعديل')}
                </Button>
              ) : null
            }
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label={t('Available for sale', 'متاح للبيع')}
              value={fmtQty(data.totalAvailable)}
              emphasis
            />
            <MetricCard label={t('Reserved', 'محجوز')} value={fmtQty(data.totalReserved)} />
            <MetricCard label={t('Total on hand', 'إجمالي المتوفر')} value={fmtQty(data.totalOnHand)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('Identity & classification', 'الهوية والتصنيف')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailField label={t('SKU', 'رمز SKU')} value={data.sku} mono />
                  <DetailField
                    label={t('Barcode', 'الباركود')}
                    value={data.barcode ?? '—'}
                    mono
                  />
                  <DetailField label={t('UoM', 'وحدة القياس')} value={productUomLabel(data.uom, isArabic)} />
                  <DetailField
                    label={t('Expiry tracking', 'تتبع انتهاء الصلاحية')}
                    value={data.expiryTracking ? t('Yes', 'نعم') : t('No', 'لا')}
                  />
                  {data.description ? (
                    <DetailField
                      label={t('Description', 'الوصف')}
                      value={<span className="whitespace-pre-wrap">{data.description}</span>}
                      className="sm:col-span-2"
                    />
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('Dimensions & weight', 'الأبعاد والوزن')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailField
                    label={t('Min stock threshold', 'حد المخزون الأدنى')}
                    value={`${fmtQty(data.minStockThreshold)} ${t('units', 'وحدة')}`}
                    mono
                  />
                  {dimensions ? (
                    <DetailField
                      label={t('Dimensions', 'الأبعاد')}
                      value={`${dimensions} ${t('cm', 'سم')}`}
                      mono
                    />
                  ) : null}
                  {data.weightKg ? (
                    <DetailField
                      label={t('Weight', 'الوزن')}
                      value={`${data.weightKg} ${t('kg', 'كغ')}`}
                      mono
                    />
                  ) : null}
                  <DetailField
                    label={t('Created', 'تاريخ الإنشاء')}
                    value={formatDateTime(data.createdAt, locale)}
                  />
                  <DetailField
                    label={t('Updated', 'تاريخ التحديث')}
                    value={formatDateTime(data.updatedAt, locale)}
                  />
                </dl>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
