import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';
import type { Size, Variant } from './types';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders the loading spinner and disables the button. */
  loading?: boolean;
  /** Icon rendered before the label (in the inline-start position). */
  startIcon?: ReactNode;
  /** Icon rendered after the label (in the inline-end position). */
  endIcon?: ReactNode;
  /** Take full width of parent. */
  block?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white border border-brand-600 ' +
    'hover:bg-brand-700 hover:border-brand-700 ' +
    'active:bg-brand-800 active:scale-[0.97] ' +
    'disabled:bg-brand-300 disabled:border-brand-300 disabled:text-white/80',
  secondary:
    'bg-white text-neutral-800 border border-neutral-300 ' +
    'hover:bg-neutral-50 hover:border-neutral-400 ' +
    'active:bg-neutral-100 active:scale-[0.97] ' +
    'disabled:bg-neutral-50 disabled:text-neutral-400',
  subtle:
    'bg-neutral-100 text-neutral-800 border border-transparent ' +
    'hover:bg-neutral-200 ' +
    'active:bg-neutral-300 active:scale-[0.97] ' +
    'disabled:bg-neutral-50 disabled:text-neutral-400',
  ghost:
    'bg-transparent text-neutral-700 border border-transparent ' +
    'hover:bg-neutral-100 ' +
    'active:bg-neutral-200 active:scale-[0.97] ' +
    'disabled:text-neutral-400',
  danger:
    'bg-danger-600 text-white border border-danger-600 ' +
    'hover:bg-danger-700 hover:border-danger-700 ' +
    'active:bg-danger-800 active:scale-[0.97] ' +
    'disabled:bg-danger-200 disabled:border-danger-200 disabled:text-white/80',
};

const SIZE_STYLES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

/**
 * Button — primary interactive primitive.
 *
 * Variants follow the action-emphasis ladder (primary → secondary → subtle →
 * ghost → danger). The brand-green primary is reserved for the single most
 * important action on a page; use secondary or subtle for everything else.
 *
 * - Logical spacing (`ms-*` / `me-*`) keeps icons on the correct side in RTL.
 * - `loading` swaps the start icon for a spinner and disables the button.
 * - Touch target stays ≥ 32px (sm) but `md` and `lg` satisfy the 44/48 px
 *   tablet rule from Section G.2 of the spec.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      startIcon,
      endIcon,
      block,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center select-none',
          'font-medium whitespace-nowrap',
          'shadow-xs',
          /* Separate transitions so color and transform can have different speeds */
          'transition-[colors,transform,opacity] duration-fast ease-standard',
          'active:duration-[80ms] active:ease-spring',
          'focus-visible:outline-none focus-visible:shadow-focus',
          'disabled:cursor-not-allowed',
          SIZE_STYLES[size],
          VARIANT_STYLES[variant],
          block && 'w-full',
          className,
        )}
        style={{ borderRadius: 'var(--radius-button)' }}
        {...rest}
      >
        {loading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} aria-hidden="true" />
        ) : startIcon ? (
          <span className="shrink-0" aria-hidden="true">{startIcon}</span>
        ) : null}
        {children !== undefined && children !== null && <span>{children}</span>}
        {endIcon && !loading ? (
          <span className="shrink-0" aria-hidden="true">{endIcon}</span>
        ) : null}
      </button>
    );
  },
);
