import { useEffect, useId, useRef, useState, type ReactElement } from 'react';

type Props = {
  label: string;
  hint?: string;
  previewUrl?: string | null;
  disabled?: boolean;
  /** Controlled pending file (create flows). */
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  /** Immediate upload (profile / product detail). */
  onUpload?: (file: File) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  uploading?: boolean;
  isArabic?: boolean;
  rounded?: 'xl' | '2xl' | 'full';
  size?: 'sm' | 'lg';
};

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
  rounded = 'xl',
  size = 'lg',
}: Props): ReactElement {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = localPreview || previewUrl || null;
  const box =
    size === 'sm'
      ? 'w-16 h-16'
      : 'w-28 h-28';
  const radius = rounded === 'full' ? 'rounded-full' : rounded === '2xl' ? 'rounded-2xl' : 'rounded-xl';

  async function handlePick(selected: File | null) {
    setError(null);
    if (!selected) {
      onFileChange?.(null);
      return;
    }
    if (!selected.type.startsWith('image/')) {
      setError(isArabic ? 'يرجى اختيار صورة صالحة.' : 'Please choose a valid image file.');
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      setError(isArabic ? 'الحد الأقصى لحجم الصورة 8 ميغابايت.' : 'Image must be 8 MB or smaller.');
      return;
    }
    if (onUpload) {
      try {
        await onUpload(selected);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
      return;
    }
    onFileChange?.(selected);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-text-body">{label}</div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={`${box} ${radius} border border-dashed border-border-strong bg-surface-sunken overflow-hidden flex items-center justify-center shrink-0 hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-white/5 transition-colors disabled:opacity-50`}
        >
          {shown ? (
            <img src={shown} alt="" className="w-full h-full object-cover" />
          ) : (
            <i className="fa-solid fa-camera text-text-faint" />
          )}
        </button>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cta text-on-brand hover:bg-cta-hover disabled:opacity-50"
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
            </button>
            {shown && onRemove ? (
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => void onRemove()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-strong text-text-body hover:bg-surface-hover disabled:opacity-50"
              >
                {isArabic ? 'إزالة' : 'Remove'}
              </button>
            ) : null}
            {shown && onFileChange && !onUpload ? (
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onFileChange(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-strong text-text-body hover:bg-surface-hover disabled:opacity-50"
              >
                {isArabic ? 'إزالة' : 'Remove'}
              </button>
            ) : null}
          </div>
          {hint ? <p className="text-[11px] text-text-faint">{hint}</p> : null}
          {error ? <p className="text-[11px] text-danger-600 dark:text-status-danger-fg">{error}</p> : null}
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
          const f = e.target.files?.[0] ?? null;
          e.target.value = '';
          void handlePick(f);
        }}
      />
    </div>
  );
}
