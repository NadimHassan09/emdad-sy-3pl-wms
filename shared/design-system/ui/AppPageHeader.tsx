/**
 * AppPageHeader — page title block below the Topbar (Client Portal hierarchy).
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface AppPageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  /** Optional Font Awesome icon class (e.g. `fa-boxes-stacked`). */
  icon?: string;
}

export function AppPageHeader({
  title,
  description,
  actions,
  meta,
  icon,
  className,
  ...rest
}: AppPageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...rest}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <i className={`fa-solid ${icon} text-emerald-600`} aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold leading-snug tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
          ) : null}
          {meta ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
