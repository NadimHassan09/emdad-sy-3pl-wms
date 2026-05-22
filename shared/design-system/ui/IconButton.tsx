import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';
import type { Size, Variant } from './types';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** REQUIRED — accessible label for screen readers; tooltip text. */
  'aria-label': string;
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50',
  subtle:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-900',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-9 w-9',
};

/**
 * IconButton — square button used for icon-only actions.
 *
 * Always requires `aria-label` because there is no visible text label.
 * Use `lg` size on touch/tablet surfaces to satisfy the 48px target.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      variant = 'ghost',
      size = 'md',
      loading,
      disabled,
      className,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center',
          'rounded-md transition-colors duration-fast ease-standard',
          'focus-visible:outline-none focus-visible:shadow-focus',
          'disabled:cursor-not-allowed disabled:opacity-60',
          SIZE[size],
          VARIANT[variant],
          className,
        )}
        {...rest}
      >
        {loading ? <Spinner size="sm" aria-hidden="true" /> : <span aria-hidden="true">{icon}</span>}
      </button>
    );
  },
);
