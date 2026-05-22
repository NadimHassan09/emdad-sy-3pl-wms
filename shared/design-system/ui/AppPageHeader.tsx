/**
 * AppPageHeader — the top section of a page, below the Topbar.
 *
 * Phase 4.5 improvements:
 *   - Bottom border separator (border-b border-neutral-100) creates a clean
 *     visual break between the page title and the page content.
 *   - Title is now `text-xl font-bold` at sm+ — stronger, premium hierarchy.
 *   - Added `pb-4 mb-6` for more comfortable page header spacing.
 *   - Description text slightly darker for better readability.
 *
 * Provides a consistent layout for:
 *   - Page title (h1)
 *   - Optional description / subtitle
 *   - Optional action buttons (inline-end aligned)
 *   - Optional metadata slot (badges, status, workflow context)
 *
 * Design rules:
 *   - NOT sticky — pages scroll past the header
 *   - Actions are end-aligned (works in RTL)
 *   - Title stays on one line (truncate) at all sizes
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface AppPageHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Metadata row below the title — status badges, last-updated, workflow stage. */
  meta?: ReactNode;
}

export function AppPageHeader({
  title,
  description,
  actions,
  meta,
  className,
  ...rest
}: AppPageHeaderProps) {
  return (
    <div
      className={cn(
        /* Flex layout for title + actions */
        'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3',
        'pb-3 mb-4 border-b border-neutral-100',
        className,
      )}
      {...rest}
    >
      {/* Title block */}
      <div className="min-w-0">
        <h1 className="text-base font-bold leading-snug tracking-tight text-neutral-900 sm:text-lg">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-neutral-500 leading-relaxed">{description}</p>
        )}
        {meta && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {meta}
          </div>
        )}
      </div>

      {/* Actions block */}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
