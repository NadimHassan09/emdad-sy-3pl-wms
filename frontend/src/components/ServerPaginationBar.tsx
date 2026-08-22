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
      className={`flex flex-col gap-2 rounded-lg border border-border bg-surface-panel px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-body">
        <select
          aria-label={labels?.rowsPerPageAria ?? 'Rows per page'}
          className="rounded-md border border-border bg-surface-panel px-2 py-1 text-sm text-text-body outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} {labels?.rowsSuffix ?? 'rows'}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted">
          {startDisplay}-{endDisplay} {labels?.ofWord ?? 'of'} {total}{' '}
          {labels?.resultsSuffix ?? 'results'}
        </span>
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <button
          type="button"
          className="flex-1 rounded-md border border-brand-600 bg-surface-panel px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-border disabled:text-text-faint disabled:hover:bg-surface-panel dark:border-brand-500 dark:text-brand-400 dark:hover:bg-brand-950/40 sm:flex-none"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading || total === 0}
        >
          {labels?.previous ?? 'Previous'}
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-cta bg-cta px-3 py-1.5 text-sm font-medium text-white transition hover:border-cta-hover hover:bg-cta-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-text-faint sm:flex-none"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading || total === 0}
        >
          {labels?.next ?? 'Next'}
        </button>
      </div>
    </div>
  );
}
