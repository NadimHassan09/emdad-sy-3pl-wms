import { useEffect, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Navigate, useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { ErrorState, Link, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Textarea } from '@emdad/ui/ui/textarea'
import { useAuth } from '@/auth/AuthContext'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { clientMediaSrc } from '@/lib/client-media'
import { isClientAdmin } from '@/lib/rbac'
import {
  deleteClientProductImage,
  fetchClientProduct,
  updateClientProduct,
  uploadClientProductImage,
} from '@/services/clientProductsService'
import { ImageUploadField, SectionHeading } from './products-ui'

export function ProductEditPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canEdit = isClientAdmin(user?.role)
  const billingAccess = useClientOperationalAccess(isArabic)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [minStockThreshold, setMinStockThreshold] = useState('0')
  const [imageVersion, setImageVersion] = useState(() => Date.now())
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const productQuery = useQuery({
    queryKey: ['client', 'products', id],
    queryFn: () => fetchClientProduct(id),
    enabled: Boolean(id) && canEdit,
  })

  useEffect(() => {
    if (!productQuery.data || hydrated) return
    setName(productQuery.data.name)
    setDescription(productQuery.data.description ?? '')
    setMinStockThreshold(String(Number(productQuery.data.minStockThreshold) || 0))
    setImageUrl(productQuery.data.imageUrl ?? null)
    setHydrated(true)
  }, [productQuery.data, hydrated])

  const saveMut = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim()
      if (!trimmedName) {
        throw new Error(t('Name is required.', 'الاسم مطلوب.'))
      }
      const thresholdRaw = minStockThreshold.trim()
      const threshold = thresholdRaw === '' ? 0 : Number(thresholdRaw)
      if (!Number.isFinite(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
        throw new Error(
          t(
            'Min stock threshold must be a whole number ≥ 0.',
            'حد المخزون الأدنى يجب أن يكون عدداً صحيحاً ≥ 0.',
          ),
        )
      }
      return updateClientProduct(id, {
        name: trimmedName,
        description: description.trim(),
        minStockThreshold: threshold,
      })
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] })
      navigate(`/products/${updated.id}`)
    },
    onError: (err: Error) => setError(err.message),
  })

  const imageUploadMut = useMutation({
    mutationFn: (file: File) => uploadClientProductImage(id, file),
    onSuccess: (res) => {
      setImageUrl(res.imageUrl)
      setImageVersion(Date.now())
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] })
    },
  })

  const imageDeleteMut = useMutation({
    mutationFn: () => deleteClientProductImage(id),
    onSuccess: () => {
      setImageUrl(null)
      setImageVersion(Date.now())
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] })
    },
  })

  if (!canEdit) {
    return <Navigate to="/products" replace />
  }

  if (!id) {
    return <Navigate to="/products" replace />
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t(
            'Editing products is not available for your account right now.',
            'تعديل المنتجات غير متاح لحسابك حالياً.',
          ),
      )
      return
    }
    setError(null)
    saveMut.mutate()
  }

  const loading = saveMut.isPending
  const fieldsDisabled =
    loading ||
    !billingAccess.operationalAllowed ||
    imageUploadMut.isPending ||
    imageDeleteMut.isPending

  if (productQuery.isLoading && !hydrated) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (productQuery.isError) {
    const notFound = isAxiosError(productQuery.error) && productQuery.error.response?.status === 404
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to="/products"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to inventory', 'العودة إلى المخزون')}
        </Link>
        <ErrorState
          title={
            notFound
              ? t('Product not found.', 'المنتج غير موجود.')
              : t('Could not load product.', 'تعذر تحميل المنتج.')
          }
          retryLabel={notFound ? undefined : t('Retry', 'إعادة المحاولة')}
          onRetry={notFound ? undefined : () => void productQuery.refetch()}
        />
      </div>
    )
  }

  const previewUrl = clientMediaSrc(imageUrl, imageVersion)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          to={`/products/${id}`}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to product', 'العودة إلى المنتج')}
        </Link>
        <PageHeader
          title={t('Edit product', 'تعديل المنتج')}
          description={t(
            'Update name, description, photo, and min stock threshold',
            'حدّث الاسم والوصف والصورة وحد المخزون الأدنى',
          )}
        />
      </div>

      {!billingAccess.operationalAllowed ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Action blocked', 'الإجراء محظور')}</AlertTitle>
          <AlertDescription>
            {billingAccess.actionBlockedReason ||
              t(
                'Editing products is not available for your account right now.',
                'تعديل المنتجات غير متاح لحسابك حالياً.',
              )}
          </AlertDescription>
        </Alert>
      ) : null}

      <form id="edit-client-product" onSubmit={submit} className="space-y-8">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-5 rounded-xl border bg-card p-5">
          <SectionHeading title={t('Details', 'التفاصيل')} />

          <ImageUploadField
            label={t('Product photo', 'صورة المنتج')}
            hint={t('Optional', 'اختياري')}
            previewUrl={previewUrl}
            disabled={fieldsDisabled}
            uploading={imageUploadMut.isPending || imageDeleteMut.isPending}
            isArabic={isArabic}
            onUpload={async (file) => {
              await imageUploadMut.mutateAsync(file)
            }}
            onRemove={
              imageUrl
                ? async () => {
                    await imageDeleteMut.mutateAsync()
                  }
                : undefined
            }
          />

          <div className="space-y-1.5">
            <Label htmlFor="edit-product-name">
              {t('Name', 'الاسم')}
              <span className="ms-0.5 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="edit-product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={fieldsDisabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-product-description">{t('Description', 'الوصف')}</Label>
            <Textarea
              id="edit-product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={fieldsDisabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-min-stock">{t('Min stock threshold', 'حد المخزون الأدنى')}</Label>
            <Input
              id="edit-min-stock"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={minStockThreshold}
              onChange={(e) => setMinStockThreshold(e.target.value)}
              disabled={fieldsDisabled}
            />
            <p className="text-xs text-muted-foreground">{t('units', 'وحدة')}</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate(`/products/${id}`)}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={fieldsDisabled}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Save', 'حفظ')}
          </Button>
        </div>
      </form>
    </div>
  )
}
