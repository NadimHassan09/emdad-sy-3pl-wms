/**
 * Admin Button — thin adapter over `@ds` Button with legacy variant aliases.
 * `primary` / `brand` → DS primary; keeps existing Admin call sites stable.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button as DsButton, cn } from '@ds';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'brand';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const VARIANT_MAP: Record<Variant, 'primary' | 'secondary' | 'danger' | 'ghost'> = {
  primary: 'primary',
  brand: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest }, ref) => (
    <DsButton
      ref={ref}
      variant={VARIANT_MAP[variant]}
      size={size === 'sm' ? 'sm' : 'md'}
      loading={loading}
      disabled={disabled}
      className={cn(className)}
      {...rest}
    >
      {children}
    </DsButton>
  ),
);
Button.displayName = 'Button';
