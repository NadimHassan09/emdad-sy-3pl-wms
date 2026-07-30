/**
 * ListPageHeader — list / catalog page title with FA icon chip and primary actions.
 * Emerald Client Portal recipe (shared list chrome).
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface ListPageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Font Awesome solid icon class without the `fa-solid` prefix, e.g. `fa-boxes-stacked`. */
  icon: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function ListPageHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
  ...rest
}: ListPageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...rest}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
          <i className={`fa-solid ${icon} text-emerald-600`} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
