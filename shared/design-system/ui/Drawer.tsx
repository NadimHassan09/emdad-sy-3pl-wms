import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { Portal } from './Portal';
import { useFocusTrap } from './useFocusTrap';

type DrawerSide = 'start' | 'end';
type DrawerSize = 'sm' | 'md' | 'lg';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Logical side — `start` flips to right in RTL, `end` flips to left in RTL.
   * Default `end` (right in LTR).
   */
  side?: DrawerSide;
  size?: DrawerSize;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Close on overlay click. Default true. */
  dismissOnOverlay?: boolean;
  /** Close on Escape. Default true. */
  dismissOnEscape?: boolean;
  hideCloseButton?: boolean;
  className?: string;
  children?: ReactNode;
}

const SIZE: Record<DrawerSize, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-2xl',
};

/**
 * Drawer — side-anchored panel (forms, contextual details, filter trays).
 *
 * Direction-aware via `side="start" | "end"`:
 *   - `end` (default) sits on the inline-end edge (right in LTR / left in RTL).
 *   - `start` sits on the inline-start edge.
 *
 * Same a11y guarantees as Modal: focus trap, Escape-to-close, body scroll lock.
 */
export function Drawer({
  open,
  onClose,
  side = 'end',
  size = 'md',
  title,
  description,
  footer,
  dismissOnOverlay = true,
  dismissOnEscape = true,
  hideCloseButton,
  className,
  children,
}: DrawerProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissOnEscape) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissOnEscape, onClose]);

  if (!open) return null;

  const anchor =
    side === 'end'
      ? 'end-0 animate-[drawerInRight_var(--duration-base)_var(--ease-emphasis)]'
      : 'start-0 animate-[drawerInLeft_var(--duration-base)_var(--ease-emphasis)]';

  return (
    <Portal>
      <div className="fixed inset-0 z-drawer">
        <button
          type="button"
          aria-label="Close drawer"
          tabIndex={-1}
          onClick={dismissOnOverlay ? onClose : undefined}
          className="absolute inset-0 cursor-default bg-[var(--surface-overlay)] animate-[fadein_var(--duration-fast)_var(--ease-standard)]"
          style={{ border: 0 }}
        />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'absolute inset-y-0 bg-white shadow-xl flex flex-col',
            anchor,
            SIZE[size],
            className,
          )}
        >
          {(title || !hideCloseButton) && (
            <div className="flex items-start gap-3 px-5 py-3 border-b border-neutral-200 shrink-0">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 id={titleId} className="text-base font-semibold text-neutral-900 m-0 truncate">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="text-xs text-neutral-500 mt-1">
                    {description}
                  </p>
                )}
              </div>
              {!hideCloseButton && (
                <IconButton
                  aria-label="Close"
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  }
                />
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto px-5 py-4 text-sm text-neutral-700">
            {children}
          </div>

          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
