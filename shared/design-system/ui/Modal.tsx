/**
 * Modal — accessible dialog (role="dialog", aria-modal).
 *
 * Architecture:
 *   Portal
 *     ├── Backdrop div (dark + blur, role="presentation")
 *     └── Panel div (flex-col, max-height, scroll-in-body)
 *           ├── ModalHeader (sticky, z-10)
 *           ├── Body (flex-1 overflow-y-auto — the ONE scroll zone)
 *           └── Footer (sticky, bg-neutral-50)
 *
 * Design rules:
 *   - Exactly ONE scrollbar — the panel body is the only scroll zone.
 *     Children MUST NOT add overflow-y-auto / max-height on their root element.
 *   - Backdrop uses bg-neutral-900/50 + backdrop-blur-sm — never a CSS variable
 *     that could be redefined (avoids the white-backdrop token conflict).
 *   - Body scroll lock while open (document.body.overflow = 'hidden').
 *   - Focus trapped inside the panel while open.
 *   - Escape to close (dismissOnEscape=true, default).
 *   - Panel enters with modalEnter animation (opacity + subtle translateY + scale).
 *   - widthClass overrides the size prop for custom widths (e.g. widthClass="max-w-3xl").
 *
 * Composition:
 *   <Modal open={...} onClose={...} title="Confirm order" footer={<Actions />}>
 *     ...body content (NO overflow wrappers in children)...
 *   </Modal>
 */

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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'form';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Visible title — renders as the dialog's accessible name. */
  title?: ReactNode;
  /** Optional secondary description rendered below the title. */
  description?: ReactNode;
  /** Footer slot — actions (Cancel + primary CTA). */
  footer?: ReactNode;
  /** Named size preset. */
  size?: ModalSize;
  /**
   * Custom max-width class — overrides `size`.
   * Used by legacy callers: widthClass="max-w-3xl"
   */
  widthClass?: string;
  /** Close when the overlay is clicked. Defaults to true. */
  dismissOnOverlay?: boolean;
  /** Close on Escape key. Defaults to true. */
  dismissOnEscape?: boolean;
  /** Hide the built-in close button. */
  hideCloseButton?: boolean;
  /** Additional className on the dialog panel. */
  className?: string;
  children?: ReactNode;
}

const SIZE: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  form: 'max-w-3xl',  // use for data-entry forms
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  widthClass,
  dismissOnOverlay = true,
  dismissOnEscape = true,
  hideCloseButton,
  className,
  children,
}: ModalProps) {
  const titleId  = useId();
  const descId   = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  // Escape key handler + body scroll lock
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

  const effectiveWidth = widthClass ?? SIZE[size];

  return (
    <Portal>
      {/* Outer positioner */}
      <div
        className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-0 sm:p-4"
        aria-hidden="false"
      >
        {/* ── Dark backdrop ───────────────────────────────────────── */}
        {/* Using bg-neutral-900/50 directly avoids the --surface-overlay
            token conflict where section 13 redefines it as white. */}
        <div
          role="presentation"
          aria-label="Close dialog"
          onClick={dismissOnOverlay ? onClose : undefined}
          className={cn(
            'absolute inset-0 cursor-default',
            'bg-neutral-900/50 backdrop-blur-[2px]',
            'animate-[fadein_var(--duration-fast)_var(--ease-standard)]',
          )}
        />

        {/* ── Dialog panel ────────────────────────────────────────── */}
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'relative w-full',
            // Premium card surface
            'bg-white',
            // Shadow hierarchy: elevated over all other surfaces
            'shadow-2xl',
            // Mobile: sheet slides up from bottom
            'rounded-t-2xl sm:rounded-2xl',
            // Height control: header + body(scrollable) + footer
            'max-h-[90dvh] sm:max-h-[calc(100vh-2rem)]',
            'flex flex-col overflow-hidden',
            // Enter animation
            'animate-[modalEnter_var(--duration-base)_var(--ease-decelerate)]',
            effectiveWidth,
            className,
          )}
        >
          {/* Header — sticky */}
          {(title || !hideCloseButton) && (
            <ModalHeader
              titleId={titleId}
              descId={descId}
              title={title}
              description={description}
              onClose={!hideCloseButton ? onClose : undefined}
            />
          )}

          {/* Body — the ONLY scroll zone in the modal */}
          <div
            className={cn(
              'flex-1 overflow-y-auto',
              'px-5 py-5 text-sm text-neutral-700',
              /* Thin scrollbar on webkit for premium look */
              '[scrollbar-width:thin] [scrollbar-color:var(--color-neutral-300)_transparent]',
            )}
          >
            {children}
          </div>

          {/* Footer — sticky */}
          {footer && (
            <div
              className={cn(
                'flex flex-wrap items-center justify-end gap-2',
                'px-5 py-3.5',
                'border-t border-neutral-200 bg-neutral-50/80',
                'rounded-b-2xl',
              )}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ModalHeader
// ─────────────────────────────────────────────────────────────────────────────

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
        className={cn(
          'flex items-start gap-3 shrink-0',
          'px-5 py-4',
          'border-b border-neutral-200 bg-white',
        )}
      >
        <div className="flex-1 min-w-0">
          {title && (
            <h2
              id={titleId}
              className="text-base font-semibold leading-snug text-neutral-900 m-0"
            >
              {title}
            </h2>
          )}
          {description && (
            <p id={descId} className="mt-1 text-xs text-neutral-500">
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <IconButton
            aria-label="Close"
            size="sm"
            variant="ghost"
            className="shrink-0 text-neutral-500 hover:text-neutral-700"
            onClick={onClose}
            icon={
              <svg
                width="16" height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            }
          />
        )}
      </div>
    );
  },
);
