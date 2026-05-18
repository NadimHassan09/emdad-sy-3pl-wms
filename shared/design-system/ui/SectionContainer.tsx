import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface SectionContainerProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Section heading — renders as <h2> for canonical document outline. */
  title?: ReactNode;
  /** Optional sub-line below the title. */
  description?: ReactNode;
  /** Slot rendered on the inline-end side of the header (typically actions). */
  actions?: ReactNode;
  /** Gap between consecutive children (vertical rhythm). */
  gap?: 'sm' | 'md' | 'lg';
  /** Hide the visible section card around children. */
  flat?: boolean;
}

const GAP = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

/**
 * SectionContainer — page section wrapper.
 *
 * Use within a PageContainer to group related content (filters + table,
 * form fieldsets, dashboard panel). Owns the title/description/action
 * triad so individual pages stop reinventing this layout.
 */
export function SectionContainer({
  title,
  description,
  actions,
  gap = 'md',
  flat,
  className,
  children,
  ...rest
}: SectionContainerProps) {
  return (
    <section
      className={cn(
        'flex flex-col',
        GAP[gap],
        !flat && 'bg-white border border-neutral-200 shadow-xs',
        className,
      )}
      style={!flat ? { borderRadius: 'var(--radius-card)' } : undefined}
      {...rest}
    >
      {(title || actions) && (
        <header
          className={cn(
            'flex flex-wrap items-start justify-between gap-3',
            !flat && 'px-4 sm:px-5 pt-4 sm:pt-5',
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-neutral-900 m-0 truncate">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-neutral-500 mt-1 m-0">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(!flat && 'px-4 sm:px-5 pb-4 sm:pb-5', 'flex flex-col', GAP[gap])}>
        {children}
      </div>
    </section>
  );
}
