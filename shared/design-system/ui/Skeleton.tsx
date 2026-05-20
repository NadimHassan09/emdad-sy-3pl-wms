import { type CSSProperties, type HTMLAttributes } from 'react';
import { cn } from './cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Height — pixels or any valid CSS length. */
  height?: number | string;
  /** Width — defaults to 100%. */
  width?: number | string;
  /** Round shape — circle, default rect with radius, or pill. */
  shape?: 'rect' | 'pill' | 'circle';
  /** Disable the shimmer animation (for reduced-motion contexts). */
  static?: boolean;
}

/**
 * Skeleton — content placeholder used during initial loads.
 *
 * Render the same shape as the eventual content (text line, avatar,
 * table cell) so the layout doesn't jump when data arrives.
 *
 * Respects `prefers-reduced-motion` automatically through the global
 * media query in globals.css.
 */
export function Skeleton({
  height = 16,
  width = '100%',
  shape = 'rect',
  static: isStatic,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const radius =
    shape === 'circle' ? '9999px' : shape === 'pill' ? 'var(--radius-pill)' : 'var(--radius-sm)';
  const inline: CSSProperties = {
    width,
    height,
    borderRadius: radius,
    ...style,
  };
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'bg-neutral-200 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200',
        !isStatic && 'animate-[shimmer_1.6s_linear_infinite]',
        'bg-[length:200%_100%]',
        className,
      )}
      style={inline}
      {...rest}
    />
  );
}
