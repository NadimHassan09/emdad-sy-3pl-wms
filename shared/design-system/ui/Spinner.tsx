import { cn } from './cn';
import type { Size } from './types';

interface SpinnerProps {
  size?: Size | number;
  className?: string;
  label?: string;
}

const SIZE_PX: Record<Size, number> = { sm: 12, md: 16, lg: 20 };

/**
 * Spinner — accessible loading indicator.
 *
 * Always announce its purpose to AT via `label` when used in isolation;
 * buttons handle this themselves so the inline spinner is decorative there.
 */
export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size];
  return (
    <span
      role={label ? 'status' : 'presentation'}
      aria-live={label ? 'polite' : undefined}
      aria-label={label}
      className={cn('inline-block animate-spin', className)}
      style={{
        width: px,
        height: px,
        borderRadius: '9999px',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
      }}
    />
  );
}
