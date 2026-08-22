/**
 * Soft surface card used across client pages (reference Card equivalent).
 */

import type { ReactElement, ReactNode } from 'react';

export function ClientSurfaceCard({
  children,
  className = '',
  hover = false,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: boolean;
}): ReactElement {
  return (
    <div
      className={[
        'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-xs)]',
        hover
          ? 'transition duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-md)]'
          : '',
        padding ? 'p-4 sm:p-5' : 'overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
