/**
 * TableFooterPagination — 1-based page footer for chunked server lists.
 */

import { cn } from './cn';

export interface ServerPaginationLike {
  total: number;
  /** 1-based page index. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export interface TableFooterPaginationProps {
  pagination: ServerPaginationLike;
  isArabic?: boolean;
  className?: string;
}

export function TableFooterPagination({
  pagination,
  isArabic,
  className,
}: TableFooterPaginationProps) {
  const { total, page, pageSize, onPageChange } = pagination;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-border-subtle px-5 py-3 text-xs text-text-muted',
        className,
      )}
    >
      <span>
        {isArabic ? 'عرض' : 'Showing'}{' '}
        <span className="font-semibold text-text-body">
          {start}-{end}
        </span>{' '}
        {isArabic ? 'من' : 'of'} <span className="font-semibold text-text-body">{total}</span>{' '}
        {isArabic ? 'نتيجة' : 'results'}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            'rounded-md border border-border px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:shadow-focus',
            canPrev ? 'text-text-body hover:bg-surface-hover' : 'cursor-not-allowed text-text-faint',
          )}
        >
          {isArabic ? 'السابق' : 'Previous'}
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            'rounded-md border border-border px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:shadow-focus',
            canNext ? 'text-text-body hover:bg-surface-hover' : 'cursor-not-allowed text-text-faint',
          )}
        >
          {isArabic ? 'التالي' : 'Next'}
        </button>
      </div>
    </div>
  );
}
