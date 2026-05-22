import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional decorative icon — keep it monochrome and small. */
  icon?: ReactNode;
  /** Single sentence primary message. */
  title: ReactNode;
  /** Optional secondary description (kept short — operators scan, not read). */
  description?: ReactNode;
  /** Primary call-to-action (use Button or Link). */
  action?: ReactNode;
  /** Secondary action (e.g., Clear filters). */
  secondaryAction?: ReactNode;
  /** Visual density — `sm` for inline empty states, `md` for full panels. */
  size?: 'sm' | 'md';
}

/**
 * EmptyState — canonical "no data" presentation.
 *
 * Use contextual copy (Section D.5):
 *   - No inbound orders yet → action: "New Inbound Order"
 *   - No orders match these filters → action: "Clear Filters"
 *
 * Always include an action where possible; empty states without next steps
 * leave operators stuck.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'py-4 px-3 gap-2' : 'py-8 px-4 gap-2.5',
        className,
      )}
      {...rest}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex items-center justify-center text-neutral-400',
            size === 'sm' ? 'mb-1' : 'mb-2',
          )}
        >
          {icon}
        </span>
      )}
      <p
        className={cn(
          'font-semibold text-neutral-900 m-0',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            'text-neutral-500 m-0 max-w-md',
            size === 'sm' ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
