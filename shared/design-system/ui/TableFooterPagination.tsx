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
        'flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500',
        className,
      )}
    >
      <span>
        {isArabic ? 'عرض' : 'Showing'}{' '}
        <span className="font-semibold text-slate-700">
          {start}-{end}
        </span>{' '}
        {isArabic ? 'من' : 'of'} <span className="font-semibold text-slate-700">{total}</span>{' '}
        {isArabic ? 'نتيجة' : 'results'}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            'rounded-md border border-slate-200 px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:shadow-focus',
            canPrev ? 'text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed text-slate-400',
          )}
        >
          {isArabic ? 'السابق' : 'Previous'}
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            'rounded-md border border-slate-200 px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:shadow-focus',
            canNext ? 'text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed text-slate-400',
          )}
        >
          {isArabic ? 'التالي' : 'Next'}
        </button>
      </div>
    </div>
  );
}
