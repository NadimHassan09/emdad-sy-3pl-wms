import { Spinner } from './Spinner';
import { cn } from './cn';

export interface UiSwitchOverlayProps {
  open: boolean;
  title: string;
  hint?: string;
  className?: string;
  /** Logo shown above the spinner. Defaults to the shared EMDAD mark. */
  logoSrc?: string;
}

/**
 * Full-screen solid loading layer that covers language / theme transitions.
 */
export function UiSwitchOverlay({
  open,
  title,
  hint,
  className,
  logoSrc = '/emdad-logo.png',
}: UiSwitchOverlayProps) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
      className={cn(
        'fixed inset-0 z-[var(--z-max)] flex flex-col items-center justify-center gap-6',
        className,
      )}
      style={{ backgroundColor: '#1A1C1E' }}
    >
      <img
        src={logoSrc}
        alt="EMDAD"
        className="h-12 w-auto object-contain sm:h-14"
      />
      <Spinner size={36} className="text-[#7CB342]" label={title} />
      <div className="flex flex-col items-center gap-1.5 px-6 text-center">
        <p className="text-sm font-semibold text-white">{title}</p>
        {hint ? <p className="text-xs text-white/55">{hint}</p> : null}
      </div>
    </div>
  );
}
