import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Boxes, CalendarDays, Camera, Check } from 'lucide-react'
import { StatusBadge, type Tone, cn } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import type { ClientProductUom } from '@/services/clientProductsService'

export type StockHealth = 'available' | 'low' | 'out'

const STOCK_HEALTH_TONE: Record<StockHealth, Tone> = {
  available: 'success',
  low: 'warning',
  out: 'danger',
}

const UOM_LABELS: Record<ClientProductUom | string, { en: string; ar: string }> = {
  piece: { en: 'Piece', ar: 'قطعة' },
  kg: { en: 'Kilogram', ar: 'كيلوغرام' },
  litre: { en: 'Litre', ar: 'لتر' },
  carton: { en: 'Carton', ar: 'كرتون' },
  pallet: { en: 'Pallet', ar: 'باليت' },
  box: { en: 'Box', ar: 'صندوق' },
  roll: { en: 'Roll', ar: 'لفة' },
}

export const PRODUCT_UOM_OPTIONS: Array<{ value: ClientProductUom; en: string; ar: string }> = [
  { value: 'piece', en: 'Piece', ar: 'قطعة' },
  { value: 'kg', en: 'Kilogram', ar: 'كيلوغرام' },
  { value: 'litre', en: 'Litre', ar: 'لتر' },
  { value: 'carton', en: 'Carton', ar: 'كرتون' },
  { value: 'pallet', en: 'Pallet', ar: 'باليت' },
  { value: 'box', en: 'Box', ar: 'صندوق' },
  { value: 'roll', en: 'Roll', ar: 'لفة' },
]

export function stockHealth(available: number, threshold: number): StockHealth {
  if (available <= 0) return 'out'
  const lowAt = threshold > 0 ? threshold : 5
  if (available <= lowAt) return 'low'
  return 'available'
}

export function stockHealthLabel(health: StockHealth, isArabic: boolean): string {
  if (health === 'out') return isArabic ? 'نفد المخزون' : 'Out of stock'
  if (health === 'low') return isArabic ? 'مخزون منخفض' : 'Low stock'
  return isArabic ? 'متوفر' : 'In stock'
}

export function StockHealthBadge({
  health,
  isArabic,
}: {
  health: StockHealth
  isArabic: boolean
}) {
  return (
    <StatusBadge tone={STOCK_HEALTH_TONE[health]}>
      {stockHealthLabel(health, isArabic)}
    </StatusBadge>
  )
}

export function productUomLabel(uom: string, isArabic: boolean): string {
  const row = UOM_LABELS[uom]
  return row ? (isArabic ? row.ar : row.en) : uom
}

export function fmtQty(s: string | number | null | undefined): string {
  if (s == null || s === '') return '—'
  const n = Number(s)
  if (Number.isNaN(n)) return String(s)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export function productAvailableQty(row: {
  totalAvailable?: string
  totalOnHand?: string
  totalReserved?: string
}): number {
  if (row.totalAvailable != null) return Number(row.totalAvailable) || 0
  const onHand = Number(row.totalOnHand ?? 0) || 0
  const reserved = Number(row.totalReserved ?? 0) || 0
  return Math.max(0, onHand - reserved)
}

/** Debounces a value for search inputs. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider text-primary">{title}</h2>
  )
}

export function DetailField({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value?: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-sm text-foreground', mono && 'font-mono')}>{value ?? '—'}</dd>
    </div>
  )
}

export function MetricCard({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3.5',
        emphasis ? 'border-primary/25 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          emphasis ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-xl font-bold tabular-nums',
          emphasis ? 'text-primary' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function InventoryModeCards({
  expiryTracking,
  onChange,
  disabled,
  isArabic,
}: {
  expiryTracking: boolean
  onChange: (expiryTracking: boolean) => void
  disabled?: boolean
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const card = (selected: boolean, onClick: () => void, content: ReactNode) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-2xl border-2 p-5 text-start transition disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-muted-foreground/30',
      )}
    >
      {content}
    </button>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('Inventory mode', 'وضع المخزون')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {card(!expiryTracking, () => onChange(false), (
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                !expiryTracking ? 'border-primary' : 'border-muted-foreground/40',
              )}
              aria-hidden
            >
              {!expiryTracking ? <span className="size-2 rounded-full bg-primary" /> : null}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full',
                    !expiryTracking ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Boxes className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{t('FIFO', 'FIFO')}</span>
              </div>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{t('First In First Out', 'الوارد أولاً يخرج أولاً')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    {t(
                      'Recommended for products with no expiration dates',
                      'موصى به للمنتجات بلا تواريخ انتهاء',
                    )}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ))}

        {card(expiryTracking, () => onChange(true), (
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                expiryTracking ? 'border-primary' : 'border-muted-foreground/40',
              )}
              aria-hidden
            >
              {expiryTracking ? <span className="size-2 rounded-full bg-primary" /> : null}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full',
                    expiryTracking ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <CalendarDays className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{t('FEFO', 'FEFO')}</span>
              </div>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{t('First Expiry First Out', 'الأقرب انتهاءً يخرج أولاً')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>
                    {t(
                      'Recommended for products with expiration dates',
                      'موصى به للمنتجات ذات تواريخ انتهاء',
                    )}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type ImageUploadFieldProps = {
  label: string
  hint?: string
  previewUrl?: string | null
  disabled?: boolean
  file?: File | null
  onFileChange?: (file: File | null) => void
  onUpload?: (file: File) => Promise<void> | void
  onRemove?: () => Promise<void> | void
  uploading?: boolean
  isArabic?: boolean
}

export function ImageUploadField({
  label,
  hint,
  previewUrl,
  disabled,
  file,
  onFileChange,
  onUpload,
  onRemove,
  uploading,
  isArabic,
}: ImageUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shown = localPreview || previewUrl || null

  async function handlePick(selected: File | null) {
    setError(null)
    if (!selected) {
      onFileChange?.(null)
      return
    }
    if (!selected.type.startsWith('image/')) {
      setError(isArabic ? 'يرجى اختيار صورة صالحة.' : 'Please choose a valid image file.')
      return
    }
    if (selected.size > 8 * 1024 * 1024) {
      setError(isArabic ? 'الحد الأقصى لحجم الصورة 8 ميغابايت.' : 'Image must be 8 MB or smaller.')
      return
    }
    if (onUpload) {
      try {
        await onUpload(selected)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.')
      }
      return
    }
    onFileChange?.(selected)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-muted-foreground/40 bg-muted/40 transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          {shown ? (
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-5 text-muted-foreground" aria-hidden />
          )}
        </button>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading
                ? isArabic
                  ? 'جاري الرفع…'
                  : 'Uploading…'
                : shown
                  ? isArabic
                    ? 'تغيير الصورة'
                    : 'Change photo'
                  : isArabic
                    ? 'رفع صورة'
                    : 'Upload photo'}
            </Button>
            {shown && onRemove ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={disabled || uploading}
                onClick={() => void onRemove()}
              >
                {isArabic ? 'إزالة' : 'Remove'}
              </Button>
            ) : null}
            {shown && onFileChange && !onUpload ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={disabled || uploading}
                onClick={() => onFileChange(null)}
              >
                {isArabic ? 'إزالة' : 'Remove'}
              </Button>
            ) : null}
          </div>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          void handlePick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
