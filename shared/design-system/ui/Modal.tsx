import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { Portal } from './Portal';
import { useFocusTrap } from './useFocusTrap';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Visible title — renders as the dialog's accessible name. */
  title?: ReactNode;
  /** Optional secondary description rendered below the title. */
  description?: ReactNode;
  /** Footer slot — actions (Cancel + primary). */
  footer?: ReactNode;
  /** Maximum dialog width. */
  size?: ModalSize;
  /** Close when the overlay is clicked. Defaults to true. */
  dismissOnOverlay?: boolean;
  /** Close on Escape key. Defaults to true. */
  dismissOnEscape?: boolean;
  /** Hide the built-in close button (rare — only when title is omitted). */
  hideCloseButton?: boolean;
  /** Additional className on the dialog panel. */
  className?: string;
  children?: ReactNode;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Modal — accessible dialog (role="dialog", aria-modal).
 *
 * - Renders into a top-level portal so it escapes stacking contexts.
 * - Focus is trapped while open and returned to the trigger on close.
 * - Escape closes (unless disabled).
 * - Body scroll is locked while open.
 *
 * Composition:
 *   <Modal open={...} onClose={...} title="Confirm order" footer={<Actions />}>
 *     ...body...
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  dismissOnOverlay = true,
  dismissOnEscape = true,
  hideCloseButton,
  className,
  children,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  // Escape to close + body scroll lock while open
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

  return (
    <Portal>
      <div
        className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-0 sm:p-4"
        aria-hidden="false"
      >
        {/* Overlay */}
        <button
          type="button"
          aria-label="Close dialog"
          tabIndex={-1}
          onClick={dismissOnOverlay ? onClose : undefined}
          className={cn(
            'absolute inset-0 cursor-default',
            'bg-[var(--surface-overlay)]',
            'animate-[fadein_var(--duration-fast)_var(--ease-standard)]',
          )}
          style={{ border: 0 }}
        />

        {/* Panel */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'relative w-full bg-white shadow-xl',
            'rounded-t-2xl sm:rounded-2xl',
            'max-h-[calc(100vh-2rem)] flex flex-col',
            'animate-[modalEnter_var(--duration-base)_var(--ease-emphasis)]',
            SIZE[size],
            className,
          )}
          style={{ borderRadius: 'var(--radius-modal)' }}
        >
          {(title || !hideCloseButton) && (
            <ModalHeader
              titleId={titleId}
              descId={descId}
              title={title}
              description={description}
              onClose={!hideCloseButton ? onClose : undefined}
            />
          )}

          <div className="flex-1 overflow-auto px-5 py-4 text-sm text-neutral-700">
            {children}
          </div>

          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-neutral-200 bg-neutral-50 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

interface ModalHeaderProps {
  titleId: string;
  descId: string;
  title?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
}

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  function ModalHeader({ titleId, descId, title, description, onClose }, ref) {
    return (
      <div
        ref={ref}
        className="flex items-start gap-3 px-5 py-3 border-b border-neutral-200"
      >
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
        {onClose && (
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
    );
  },
);
