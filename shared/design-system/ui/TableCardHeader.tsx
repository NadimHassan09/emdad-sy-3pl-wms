/**
 * TableCardHeader — title block inside a table card, above column headers.
 *
 * Matches docs/style.html: page title + optional subtitle + actions sit in the
 * white rounded card, separated from the data grid by a bottom border.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface TableCardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Heading level for the title — defaults to h1 for list pages. */
  titleAs?: 'h1' | 'h2' | 'h3';
}

export function TableCardHeader({
  title,
  description,
  actions,
  titleAs: TitleTag = 'h1',
  className,
  ...rest
}: TableCardHeaderProps) {
  if (!title && !description && !actions) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-slate-100 px-3 py-3 sm:px-4 md:flex-row md:items-start md:justify-between',
        className,
      )}
      {...rest}
    >
      {(title || description) && (
        <div className="min-w-0">
          {title && (
            <TitleTag className="text-base font-semibold text-slate-900 sm:text-lg">{title}</TitleTag>
          )}
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
          )}
        </div>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
      )}
    </div>
  );
}
