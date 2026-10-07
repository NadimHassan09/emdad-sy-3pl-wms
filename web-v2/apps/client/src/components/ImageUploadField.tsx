import { useEffect, useId, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'

type Props = {
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

/** Product / profile image picker — controlled file or immediate upload. */
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
}: Props) {
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
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 transition-colors',
            'hover:border-primary hover:bg-primary/5 disabled:opacity-50',
          )}
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-6 w-6 text-muted-foreground" />
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
          e.target.value = ''
          void handlePick(f)
        }}
      />
    </div>
  )
}
