/**
 * Card — generic surface container.
 *
 * Phase 4.5 improvements:
 *   - Elevation tiers refined: `flat` uses a more subtle border tint,
 *     `raised` uses shadow-sm (slightly richer than before), `overlay` uses
 *     shadow-xl for maximum pop on modals/popovers
 *   - `interactive` variant adds hover-lift transform and border brightening
 *   - Card.Header background slightly differentiated from body (neutral-50/60)
 *   - Card.Footer strengthened: muted border, consistent with Modal footer
 *   - Card.Title slightly larger and bolder for premium hierarchy
 *   - Card radius is always via inline style so CSS var wins over Tailwind
 *
 * Compose with Card.Header / Card.Body / Card.Footer for structured layouts.
 * For free-form contents, use padding="md" directly.
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';
type Elevation = 'none' | 'flat' | 'raised' | 'overlay';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  elevation?: Elevation;
  borderless?: boolean;
  /** Hoverable container — adds hover-lift transition, used for clickable cards. */
  interactive?: boolean;
}

const PADDING: Record<Padding, string> = {
  none: 'p-0',
  sm:   'p-2',
  md:   'p-3 sm:p-3.5',
  lg:   'p-4',
};

const ELEVATION: Record<Elevation, string> = {
  none:    '',
  flat:    'shadow-none',
  raised:  'shadow-sm',
  overlay: 'shadow-xl',
};

interface CardSlotProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const CardComponent = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    padding = 'md',
    elevation = 'raised',
    borderless,
    interactive,
    className,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-white text-neutral-900',
        !borderless && 'border border-neutral-200',
        ELEVATION[elevation],
        PADDING[padding],
        interactive && [
          'transition-[border-color,box-shadow,transform] duration-fast ease-standard',
          'hover:border-brand-200 hover:shadow-md hover:-translate-y-px',
          'focus-within:shadow-focus',
          'cursor-pointer',
        ],
        className,
      )}
      style={{ borderRadius: 'var(--radius-card)' }}
      {...rest}
    />
  );
});

function CardHeader({ className, children, ...rest }: CardSlotProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3',
        'px-3 py-2.5',
        /* Phase 4.5: slightly tinted header to differentiate from card body */
        'border-b border-neutral-100 bg-neutral-50/60',
        'rounded-t-card',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-sm font-semibold text-neutral-900 m-0 leading-snug', className)}
      {...rest}
    >
      {children}
    </h3>
  );
}

function CardBody({ className, children, ...rest }: CardSlotProps) {
  return (
    <div className={cn('px-3 py-3', className)} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...rest }: CardSlotProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2',
        'px-3 py-2',
        'border-t border-neutral-100 bg-neutral-50/70',
        'rounded-b-card',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export const Card = Object.assign(CardComponent, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
  Footer: CardFooter,
});
