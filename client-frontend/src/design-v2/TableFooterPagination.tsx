import type { ReactElement } from 'react';

import { cx } from './cx';

export interface ServerPaginationLike {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TableFooterPagination({
  pagination,
  isArabic,
}: {
  pagination: ServerPaginationLike;
  isArabic?: boolean;
}): ReactElement {
  const { total, page, pageSize, onPageChange } = pagination;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  return (
    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
      <span>
        {isArabic ? 'عرض' : 'Showing'} <span className="font-semibold text-slate-700">{start}-{end}</span>{' '}
        {isArabic ? 'من' : 'of'} <span className="font-semibold text-slate-700">{total}</span>{' '}
        {isArabic ? 'نتيجة' : 'results'}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className={cx(
            'px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors',
            canPrev ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed',
          )}
        >
          {isArabic ? 'السابق' : 'Previous'}
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className={cx(
            'px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors',
            canNext ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 cursor-not-allowed',
          )}
        >
          {isArabic ? 'التالي' : 'Next'}
        </button>
      </div>
    </div>
  );
}
