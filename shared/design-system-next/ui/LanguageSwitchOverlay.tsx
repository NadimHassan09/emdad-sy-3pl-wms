import { UiSwitchOverlay } from './UiSwitchOverlay';

export interface LanguageSwitchOverlayProps {
  open: boolean;
  /** Target language (shown on the overlay while switching). */
  language: 'EN' | 'AR';
  className?: string;
  /** Optional override for the primary title. */
  title?: string;
  /** Optional override for the secondary hint. */
  hint?: string;
}

/**
 * Full-screen loading layer while the UI remounts for a new language (no document reload).
 */
export function LanguageSwitchOverlay({
  open,
  language,
  className,
  title,
  hint,
}: LanguageSwitchOverlayProps) {
  const isArabic = language === 'AR';
  return (
    <UiSwitchOverlay
      open={open}
      className={className}
      title={title ?? (isArabic ? 'جاري تحميل اللغة…' : 'Loading language…')}
      hint={hint ?? (isArabic ? 'يتم تحديث الواجهة' : 'Updating interface')}
    />
  );
}
