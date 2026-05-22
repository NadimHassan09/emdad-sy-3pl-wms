import { Spinner } from './Spinner';
import { cn } from './cn';

export interface LanguageSwitchOverlayProps {
  open: boolean;
  /** Target language (shown on the overlay while switching). */
  language: 'EN' | 'AR';
  className?: string;
}

/**
 * Full-screen loading layer while the UI remounts for a new language (no document reload).
 */
export function LanguageSwitchOverlay({ open, language, className }: LanguageSwitchOverlayProps) {
  if (!open) return null;

  const isArabic = language === 'AR';
  const title = isArabic ? 'جاري تحميل اللغة…' : 'Loading language…';
  const hint = isArabic ? 'يتم تحديث الواجهة' : 'Updating interface';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'fixed inset-0 z-[var(--z-max)] flex flex-col items-center justify-center gap-3',
        'bg-[var(--surface-page)]/92 backdrop-blur-[2px]',
        className,
      )}
    >
      <Spinner size="lg" className="text-brand-600" label={title} />
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  );
}
