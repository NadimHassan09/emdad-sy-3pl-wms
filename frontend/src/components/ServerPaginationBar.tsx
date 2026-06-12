import type { ServerPagination } from '../hooks/useServerPagination';

type Props = {
  pagination: ServerPagination;
  loading?: boolean;
  labels?: {
    previous?: string;
    next?: string;
    rowsPerPageAria?: string;
    rowsSuffix?: string;
    ofWord?: string;
    resultsSuffix?: string;
  };
  className?: string;
};

export function ServerPaginationBar({ pagination, loading, labels, className = '' }: Props) {
  const { total, page, pageSize, onPageChange, onPageSizeChange, pageSizeOptions } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startDisplay = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endDisplay = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <select
          aria-label={labels?.rowsPerPageAria ?? 'Rows per page'}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition focus:border-[#1a7a44] focus:ring-2 focus:ring-[#1a7a44]/20"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} {labels?.rowsSuffix ?? 'rows'}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-600">
          {startDisplay}-{endDisplay} {labels?.ofWord ?? 'of'} {total}{' '}
          {labels?.resultsSuffix ?? 'results'}
        </span>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          className="flex-1 rounded-md border border-[#1a7a44] bg-white px-3 py-1.5 text-sm font-medium text-[#1a7a44] transition hover:bg-[#e9f5ee] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white sm:flex-none"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading || total === 0}
        >
          {labels?.previous ?? 'Previous'}
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-[#1a7a44] bg-[#1a7a44] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#156635] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 sm:flex-none"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading || total === 0}
        >
          {labels?.next ?? 'Next'}
        </button>
      </div>
    </div>
  );
}
