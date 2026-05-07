import { ReactNode, useEffect, useMemo, useState } from 'react';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, rowKey, empty, loading, onRowClick }: DataTableProps<T>) {
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [page, setPage] = useState(1);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [page, rows, rowsPerPage]);

  const startDisplay = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endDisplay = totalRows === 0 ? 0 : Math.min(page * rowsPerPage, totalRows);

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${c.className ?? ''}`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-slate-500">
                Loading…
              </td>
            </tr>
          ) : pagedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-slate-500">
                {empty ?? 'No data.'}
              </td>
            </tr>
          ) : (
            pagedRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer transition hover:bg-slate-50' : 'transition hover:bg-slate-50'}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`px-3 py-2 align-middle ${c.className ?? ''}`}>
                    {c.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <select
            aria-label="Rows per page"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition focus:border-[#1a7a44] focus:ring-2 focus:ring-[#1a7a44]/20"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-600">
            {startDisplay}-{endDisplay} of {totalRows} results
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-[#1a7a44] bg-white px-3 py-1.5 text-sm font-medium text-[#1a7a44] transition hover:bg-[#e9f5ee] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading || totalRows === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-[#1a7a44] bg-[#1a7a44] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#146135] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading || totalRows === 0}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
