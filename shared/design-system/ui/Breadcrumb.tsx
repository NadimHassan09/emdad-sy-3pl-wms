/**
 * Breadcrumb — navigation trail.
 *
 * Usage:
 *   <Breadcrumb
 *     items={[
 *       { label: 'Orders', href: '/orders/inbound', onClick: ... },
 *       { label: 'IN-2024-00123' },   // current page — no href
 *     ]}
 *   />
 *
 * The last item is always the current page (aria-current="page").
 *
 * RTL: separator chevrons flip automatically via `transform: scaleX(-1)`
 * when `dir="rtl"` is applied to the document.
 *
 * Operational note (§A.7): order numbers / codes should be wrapped in
 * `<span dir="ltr">` at the call site to stay visually LTR even in RTL UIs.
 */

import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /** Separator character or element. Default is a chevron SVG. */
  separator?: React.ReactNode;
  /** Compact: truncate middle items when many levels deep. Default false. */
  compact?: boolean;
}

const ChevronSeparator = () => (
  <svg
    width="12" height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    className="shrink-0 text-neutral-300 rtl:scale-x-[-1]"
  >
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function Breadcrumb({
  items,
  separator,
  compact: _compact,
  className,
  ...rest
}: BreadcrumbProps) {
  const sep = separator ?? <ChevronSeparator />;

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...rest}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1 min-w-0">
              {index > 0 && (
                <span className="flex shrink-0 items-center">{sep}</span>
              )}
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-neutral-900"
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href ?? '#'}
                  onClick={item.onClick}
                  className={cn(
                    'truncate text-neutral-500',
                    'transition-colors duration-fast hover:text-neutral-800',
                    'focus-visible:outline-none focus-visible:shadow-focus rounded-sm',
                  )}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
