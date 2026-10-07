import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@emdad/ui'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@emdad/ui/ui/card'

export interface Column<T> {
  header: ReactNode
  accessor: (row: T) => ReactNode
  className?: string
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  titleAs?: 'h1' | 'h2' | 'h3'
  empty?: ReactNode
  loading?: boolean
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string | undefined
  serverPagination?: {
    total: number
    page: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    pageSizeOptions?: number[]
  }
  labels?: {
    rowsSuffix?: string
    resultsSuffix?: string
    ofWord?: string
    previous?: string
    next?: string
    rowsPerPageAria?: string
  }
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  title,
  description,
  actions,
  empty,
  loading,
  onRowClick,
  getRowClassName,
  serverPagination,
  labels,
}: DataTableProps<T>) {
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [page, setPage] = useState(1)
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'

  const isServer = !!serverPagination
  const effectivePageSize = isServer ? serverPagination.pageSize : rowsPerPage
  const effectivePage = isServer ? serverPagination.page : page
  const totalRows = isServer ? serverPagination.total : rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize))
  const pageSizeOptions = serverPagination?.pageSizeOptions ?? [10, 20, 50, 100]

  useEffect(() => {
    if (!isServer && page > totalPages) setPage(totalPages)
  }, [page, totalPages, isServer])

  const pagedRows = useMemo(() => {
    if (isServer) return rows
    const start = (page - 1) * rowsPerPage
    return rows.slice(start, start + rowsPerPage)
  }, [isServer, page, rows, rowsPerPage])

  const startDisplay = totalRows === 0 ? 0 : (effectivePage - 1) * effectivePageSize + 1
  const endDisplay = totalRows === 0 ? 0 : Math.min(effectivePage * effectivePageSize, totalRows)

  const TitleTag = title ? 'h2' : 'div'

  return (
    <Card className="overflow-visible py-0">
      {title ? (
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b">
          <div>
            <CardTitle className="text-base">
              <TitleTag>{title}</TitleTag>
            </CardTitle>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </CardHeader>
      ) : null}
      <CardContent className="px-0 pb-0">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((c, colIdx) => (
                  <th
                    key={colIdx}
                    scope="col"
                    className={`whitespace-nowrap bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${isRtl ? 'text-end' : 'text-start'} ${c.className ?? ''}`}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, rowIdx) => (
                  <tr key={`skeleton-${rowIdx}`} className="border-t">
                    {columns.map((c, colIdx) => (
                      <td key={colIdx} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>
                        <Skeleton className="h-3.5 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6">
                    {typeof empty === 'string' || empty == null ? (
                      <EmptyState title={String(empty ?? 'No data.')} />
                    ) : (
                      empty
                    )}
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={[
                      onRowClick ? 'cursor-pointer border-t transition hover:bg-muted/30' : 'border-t transition hover:bg-muted/30',
                      getRowClassName?.(row),
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {columns.map((c, colIdx) => (
                      <td key={colIdx} className={`px-4 py-3 align-middle text-sm ${c.className ?? ''}`}>
                        {c.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label={labels?.rowsPerPageAria ?? 'Rows per page'}
              className="rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none"
              value={effectivePageSize}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (isServer) serverPagination!.onPageSizeChange(n)
                else {
                  setRowsPerPage(n)
                  setPage(1)
                }
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} {labels?.rowsSuffix ?? 'rows'}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {startDisplay}-{endDisplay} {labels?.ofWord ?? 'of'} {totalRows} {labels?.resultsSuffix ?? 'results'}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              onClick={() => {
                if (isServer) serverPagination!.onPageChange(Math.max(1, effectivePage - 1))
                else setPage((p) => Math.max(1, p - 1))
              }}
              disabled={effectivePage <= 1 || loading || totalRows === 0}
            >
              {labels?.previous ?? 'Previous'}
            </button>
            <button
              type="button"
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              onClick={() => {
                if (isServer) serverPagination!.onPageChange(Math.min(totalPages, effectivePage + 1))
                else setPage((p) => Math.min(totalPages, p + 1))
              }}
              disabled={effectivePage >= totalPages || loading || totalRows === 0}
            >
              {labels?.next ?? 'Next'}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export type { Column as LegacyColumn }
