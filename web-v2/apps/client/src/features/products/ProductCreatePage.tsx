import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Navigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { Link, PageHeader, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@emdad/ui/ui/select'
import { Textarea } from '@emdad/ui/ui/textarea'
import { useAuth } from '@/auth/AuthContext'
import { useClientOperationalAccess } from '@/hooks/useClientOperationalAccess'
import { generateBarcode, generateSku } from '@/lib/identifiers'
import { isClientAdmin } from '@/lib/rbac'
import {
  createClientProduct,
  uploadClientProductImage,
  type ClientProductUom,
  type CreateClientProductInput,
} from '@/services/clientProductsService'
import {
  ImageUploadField,
  InventoryModeCards,
  PRODUCT_UOM_OPTIONS,
  SectionHeading,
} from './products-ui'

export function ProductCreatePage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canCreate = isClientAdmin(user?.role)
  const billingAccess = useClientOperationalAccess(isArabic)

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [uom, setUom] = useState<ClientProductUom>('piece')
  const [expiryTracking, setExpiryTracking] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: async ({
      input,
      imageFile: file,
    }: {
      input: CreateClientProductInput
      imageFile: File | null
    }) => {
      const created = await createClientProduct(input)
      if (file) {
        try {
          await uploadClientProductImage(created.id, file)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Image upload failed.'
          throw new Error(`${t('Product created.', 'تم إنشاء المنتج.')} ${msg}`)
        }
      }
      return created
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] })
      navigate(`/products/${created.id}`)
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!canCreate) {
    return <Navigate to="/products" replace />
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t(
            'Creating products is not available for your account right now.',
            'إنشاء المنتجات غير متاح لحسابك حالياً.',
          ),
      )
      return
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('Name is required.', 'الاسم مطلوب.'))
      return
    }
    const input: CreateClientProductInput = {
      name: trimmedName,
      expiryTracking,
      uom,
    }
    const skuTrim = sku.trim()
    if (skuTrim) input.sku = skuTrim
    const barcodeTrim = barcode.trim()
    if (barcodeTrim) input.barcode = barcodeTrim
    const descTrim = description.trim()
    if (descTrim) input.description = descTrim
    setError(null)
    createMut.mutate({ input, imageFile })
  }

  const loading = createMut.isPending
  const fieldsDisabled = loading || !billingAccess.operationalAllowed

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          to="/products"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back to inventory', 'العودة إلى المخزون')}
        </Link>
        <PageHeader
          title={t('New product', 'منتج جديد')}
          description={t(
            'Add a catalog product to track sellable stock',
            'أضف منتجاً في الكتالوج لتتبع المخزون القابل للبيع',
          )}
        />
      </div>

      {!billingAccess.operationalAllowed ? (
        <Alert variant="destructive">
          <AlertTitle>{t('Action blocked', 'الإجراء محظور')}</AlertTitle>
          <AlertDescription>
            {billingAccess.actionBlockedReason ||
              t(
                'Creating products is not available for your account right now.',
                'إنشاء المنتجات غير متاح لحسابك حالياً.',
              )}
          </AlertDescription>
        </Alert>
      ) : null}

      <form id="create-client-product" onSubmit={submit} className="space-y-8">
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
            file={imageFile}
            onFileChange={setImageFile}
            disabled={fieldsDisabled}
            isArabic={isArabic}
          />

          <div className="space-y-1.5">
            <Label htmlFor="product-name">
              {t('Name', 'الاسم')}
              <span className="ms-0.5 text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={fieldsDisabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-sku">{t('SKU', 'رمز SKU')}</Label>
            <div className="flex items-stretch">
              <Input
                id="product-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={fieldsDisabled}
                className="rounded-e-none font-mono text-sm"
                spellCheck={false}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                className="rounded-s-none border border-s-0"
                onClick={() => setSku(generateSku())}
                disabled={fieldsDisabled}
              >
                {t('Generate', 'إنشاء')}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-barcode">{t('Barcode', 'الباركود')}</Label>
            <div className="flex items-stretch">
              <Input
                id="product-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={fieldsDisabled}
                className="rounded-e-none font-mono text-sm"
                spellCheck={false}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                className="rounded-s-none border border-s-0"
                onClick={() => setBarcode(generateBarcode())}
                disabled={fieldsDisabled}
              >
                {t('Generate', 'إنشاء')}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-description">{t('Description', 'الوصف')}</Label>
            <Textarea
              id="product-description"
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
            <Label>{t('UoM', 'وحدة القياس')}</Label>
            <Select
              value={uom}
              onValueChange={(v) => setUom(v as ClientProductUom)}
              disabled={fieldsDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('Select unit…', 'اختر الوحدة…')} />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_UOM_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {isArabic ? opt.ar : opt.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <InventoryModeCards
            expiryTracking={expiryTracking}
            onChange={setExpiryTracking}
            disabled={fieldsDisabled}
            isArabic={isArabic}
          />
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/products')}
            disabled={loading}
          >
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={!billingAccess.operationalAllowed || loading}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Create', 'إنشاء')}
          </Button>
        </div>
      </form>
    </div>
  )
}
