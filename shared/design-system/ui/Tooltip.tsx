import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from './cn';

type Side = 'top' | 'bottom' | 'start' | 'end';

interface TooltipProps {
  /** Content shown when the trigger is hovered or focused. */
  content: ReactNode;
  /** The trigger element — must be a single focusable element. */
  children: ReactElement;
  /** Preferred side; defaults to `top`. */
  side?: Side;
  /** Disable the tooltip but keep the trigger interactive. */
  disabled?: boolean;
  /** Class applied to the bubble. */
  className?: string;
}

const SIDE_POSITION: Record<Side, string> = {
  top: 'bottom-full mb-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2',
  bottom: 'top-full mt-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2',
  start: 'end-full me-2 top-1/2 -translate-y-1/2',
  end: 'start-full ms-2 top-1/2 -translate-y-1/2',
};

/**
 * Tooltip — lightweight hover/focus tooltip.
 *
 * Pure CSS positioning (good for short labels). For longer tooltips with
 * collision detection we'll add a Popover primitive in a later phase.
 *
 * Accessibility:
 *   - Trigger gets `aria-describedby` pointing to the bubble.
 *   - Tooltip is not focusable itself.
 *   - Both hover and keyboard focus show the tooltip.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  disabled,
  className,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  if (!isValidElement(children)) return children as ReactNode;

  if (disabled || content == null || content === '') return children;

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': open ? id : (children.props as { 'aria-describedby'?: string })['aria-describedby'],
    onMouseEnter: (e: React.MouseEvent) => {
      setOpen(true);
      (children.props as { onMouseEnter?: (e: React.MouseEvent) => void }).onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      setOpen(false);
      (children.props as { onMouseLeave?: (e: React.MouseEvent) => void }).onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      setOpen(true);
      (children.props as { onFocus?: (e: React.FocusEvent) => void }).onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      setOpen(false);
      (children.props as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e);
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-tooltip pointer-events-none whitespace-nowrap',
            'px-2 py-1 text-xs font-medium text-white',
            'bg-neutral-900 shadow-md',
            SIDE_POSITION[side],
            className,
          )}
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
