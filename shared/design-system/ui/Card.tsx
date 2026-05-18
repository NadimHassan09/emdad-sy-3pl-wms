import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';
type Elevation = 'none' | 'flat' | 'raised' | 'overlay';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Internal padding. Use `none` when nesting Card.Header / Card.Body. */
  padding?: Padding;
  /** Shadow tier. `flat` = bordered only, no shadow. */
  elevation?: Elevation;
  /** When true, suppress the border (used when card sits on its own surface). */
  borderless?: boolean;
  /** Render as a hoverable container — useful for clickable cards/links. */
  interactive?: boolean;
}

const PADDING: Record<Padding, string> = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-4 sm:p-5',
  lg:   'p-5 sm:p-6',
};

const ELEVATION: Record<Elevation, string> = {
  none:    '',
  flat:    'shadow-none',
  raised:  'shadow-sm',
  overlay: 'shadow-lg',
};

interface CardSlotProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/**
 * Card — generic surface container. Anchors the page's visual rhythm.
 *
 * Compose with `Card.Header`, `Card.Body`, and `Card.Footer` for structured
 * layouts (page sections, modal bodies). For free-form contents, set
 * `padding="md"` directly.
 */
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
        interactive &&
          'transition-shadow duration-fast ease-standard hover:shadow-md focus-within:shadow-focus',
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
        'px-4 sm:px-5 py-3 border-b border-neutral-200',
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
      className={cn('text-base font-semibold text-neutral-900 m-0', className)}
      {...rest}
    >
      {children}
    </h3>
  );
}

function CardBody({ className, children, ...rest }: CardSlotProps) {
  return (
    <div className={cn('px-4 sm:px-5 py-4', className)} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...rest }: CardSlotProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2',
        'px-4 sm:px-5 py-3 border-t border-neutral-200 bg-neutral-50',
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
