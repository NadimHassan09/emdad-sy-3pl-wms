/**
 * Pagination — standalone pagination bar.
 *
 * Designed to sit below a DataTable. Supports:
 *   - Page size selector
 *   - "X–Y of N" count display
 *   - Previous / Next navigation
 *   - Compact mode (hides page size selector)
 *   - RTL-safe (uses logical classes throughout)
 *
 * Intentionally does NOT own page state — the parent drives `page`/`pageSize`
 * so state can live in the query key, URL, or local state as appropriate.
 */

import { cn } from './cn';
import { Button } from './Button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationProps {
  /** Zero-based page index. */
  page: number;
  /** Number of rows per page. */
  pageSize: number;
  /** Total number of rows across all pages. */
  total: number;
  /** Called when the user changes the page. Receives zero-based index. */
  onPageChange: (page: number) => void;
  /** Called when the user changes the page size. */
  onPageSizeChange?: (size: number) => void;
  /** Available page size options. Defaults to [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Hide the page size selector. */
  compact?: boolean;
  /** Whether data is currently loading (disables navigation). */
  loading?: boolean;
  /** Labels for i18n. All optional — defaults to English. */
  labels?: {
    rowsPerPage?: string;
    rowsSuffix?: string;
    ofWord?: string;
    previous?: string;
    next?: string;
    /** Renders instead of "X–Y of N [results]" — useful for Arabic right-to-left phrasing. */
    countTemplate?: (from: number, to: number, total: number) => string;
  };
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  compact,
  loading,
  labels = {},
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const isFirst = page <= 0;
  const isLast = page >= totalPages - 1;

  const countLabel = labels.countTemplate
    ? labels.countTemplate(from, to, total)
    : `${from}–${to} ${labels.ofWord ?? 'of'} ${total}`;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        'border-t border-neutral-200 bg-white',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className,
      )}
    >
      {/* Left slot: page size + count */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        {!compact && onPageSizeChange && (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <label className="text-xs text-neutral-500">
              {labels.rowsPerPage ?? 'Rows per page'}
            </label>
            <select
              aria-label={labels.rowsPerPage ?? 'Rows per page'}
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(0);
              }}
              className={cn(
                'h-8 rounded-md border border-neutral-300 bg-white px-2 py-0',
                'text-xs text-neutral-700',
                'transition-colors duration-fast focus:border-brand-600 focus:shadow-focus focus:outline-none',
              )}
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} {labels.rowsSuffix ?? 'rows'}
                </option>
              ))}
            </select>
          </span>
        )}
        <span className="text-xs text-neutral-500 tabular-nums">{countLabel}</span>
      </div>

      {/* Right slot: prev / next */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={isFirst || loading}
          onClick={() => onPageChange(page - 1)}
          aria-label={labels.previous ?? 'Previous page'}
        >
          {labels.previous ?? 'Previous'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={isLast || loading}
          onClick={() => onPageChange(page + 1)}
          aria-label={labels.next ?? 'Next page'}
        >
          {labels.next ?? 'Next'}
        </Button>
      </div>
    </div>
  );
}
