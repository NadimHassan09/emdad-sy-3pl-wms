import { useMemo, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type OnChangeFn,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@ui/lib/utils'
import { Button } from '@ui/components/ui/button'
import { Checkbox } from '@ui/components/ui/checkbox'
import { Skeleton } from '@ui/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui/components/ui/select'

/** Column metadata understood by <DataTable>. */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** 1 = always, 2 = container ≥ 56rem, 3 = container ≥ 72rem. Lower-priority columns are hidden when the table is narrow. */
    priority?: 1 | 2 | 3
    align?: 'start' | 'end' | 'center'
    /** Label used in the mobile row-card (defaults to the header string). */
    mobileLabel?: string
    /** Render this column at the end of the title row in the mobile row-card (e.g. a row-actions menu). */
    cardAction?: boolean
    /** Hide this column entirely in the mobile row-card. */
    hideInCard?: boolean
    /** Fixed/min width classes, e.g. `w-32 min-w-32` — the column contract. */
    className?: string
  }
}

export type DataTablePagination = {
  /** 1-based */
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export type DataTableLabels = {
  rowsPerPage: string
  of: string
  noResults: string
  select: string
  selectAll: string
}

const DEFAULT_LABELS: DataTableLabels = {
  rowsPerPage: 'Rows per page',
  of: 'of',
  noResults: 'No results',
  select: 'Select row',
  selectAll: 'Select all rows',
}

const priorityClass = (p?: 1 | 2 | 3) =>
  p === 2 ? 'hidden @4xl:table-cell' : p === 3 ? 'hidden @6xl:table-cell' : undefined

const alignClass = (a?: 'start' | 'end' | 'center') =>
  a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start'

export type DataTableProps<T> = {
  columns: ColumnDef<T, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[]
  getRowId: (row: T) => string
  loading?: boolean
  /** Rendered instead of the table when set (error / needs-scope states) */
  stateOverride?: ReactNode
  empty?: ReactNode
  pagination?: DataTablePagination
  /** Enables a checkbox column; controlled. */
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  onRowClick?: (row: T) => void
  /** Custom mobile card; default auto-renders first column as title + priority≤2 fields. */
  renderCard?: (row: T) => ReactNode
  density?: 'comfortable' | 'compact'
  labels?: Partial<DataTableLabels>
  skeletonRows?: number
  className?: string
}

/**
 * Server-driven data table (TanStack Table, manual pagination).
 * Column contract: every column declares `meta.priority/align/className`.
 * Below `md` the same columns render as row cards (no horizontal page scroll).
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  loading,
  stateOverride,
  empty,
  pagination,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  renderCard,
  density = 'comfortable',
  labels,
  skeletonRows = 8,
  className,
}: DataTableProps<T>) {
  const L = { ...DEFAULT_LABELS, ...labels }
  const selectable = !!onRowSelectionChange

  const allColumns = useMemo<ColumnDef<T, any>[]>(() => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!selectable) return columns
    const sel: ColumnDef<T, any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
      id: '__select',
      header: ({ table }) => (
        <Checkbox
          aria-label={L.selectAll}
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={L.select}
          checked={row.getIsSelected()}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
        />
      ),
      meta: { className: 'w-10 min-w-10', hideInCard: true },
    }
    return [sel, ...columns]
  }, [columns, selectable, L.select, L.selectAll])

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: selectable,
    state: { rowSelection: rowSelection ?? {} },
    onRowSelectionChange,
  })

  const rows = table.getRowModel().rows
  const visibleCols = table.getVisibleLeafColumns()
  const rowPad = density === 'compact' ? 'py-1.5' : 'py-3'

  if (stateOverride) {
    return <div className={cn('rounded-xl border bg-card', className)}>{stateOverride}</div>
  }

  const actionCol = visibleCols.find((c) => c.columnDef.meta?.cardAction)
  const cardColumns = visibleCols.filter((c) => !c.columnDef.meta?.hideInCard && !c.columnDef.meta?.cardAction && c.id !== '__select')
  const [titleCol, ...restCols] = cardColumns

  return (
    <div className={cn('@container overflow-hidden rounded-xl border bg-card', className)}>
      {/* ≥ @2xl (container width, not viewport): real table */}
      <div className="hidden @2xl:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/70 hover:bg-muted/70">
                {hg.headers.map((h) => {
                  const m = h.column.columnDef.meta
                  return (
                    <TableHead
                      key={h.id}
                      className={cn('h-11 text-[0.8125rem] font-semibold text-foreground/80', alignClass(m?.align), priorityClass(m?.priority), m?.className)}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {visibleCols.map((c) => (
                      <TableCell key={c.id} className={cn(rowPad, priorityClass(c.columnDef.meta?.priority))}>
                        <Skeleton className="h-4 w-4/5" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(onRowClick && 'cursor-pointer', 'data-[state=selected]:bg-brand-100 hover:bg-brand-50')}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const m = cell.column.columnDef.meta
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(rowPad, 'text-sm', alignClass(m?.align), priorityClass(m?.priority), m?.className)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {/* < md: row cards from the same column definitions */}
      <ul className="divide-y @2xl:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : rows.map((row) => (
              <li
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn('p-4', onRowClick && 'cursor-pointer active:bg-brand-50')}
              >
                {renderCard ? (
                  renderCard(row.original)
                ) : (
                  <div className="flex items-start gap-3">
                    {selectable ? (
                      <div className="pt-0.5">
                        {flexRender(table.getAllColumns()[0].columnDef.cell, row.getAllCells()[0].getContext())}
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-2">
                      {titleCol ? (
                        <div className="flex items-center justify-between gap-2 text-sm font-medium">
                          <div className="min-w-0 break-words">
                            {flexRender(titleCol.columnDef.cell, row.getAllCells().find((c) => c.column.id === titleCol.id)!.getContext())}
                          </div>
                          {actionCol ? (
                            <div className="-my-2 shrink-0">
                              {flexRender(actionCol.columnDef.cell, row.getAllCells().find((c) => c.column.id === actionCol.id)!.getContext())}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        {restCols
                          .filter((c) => (c.columnDef.meta?.priority ?? 1) <= 2)
                          .map((c) => {
                            const cell = row.getAllCells().find((x) => x.column.id === c.id)!
                            const label = c.columnDef.meta?.mobileLabel ?? (typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)
                            return (
                              <div key={c.id} className="min-w-0">
                                <dt className="text-xs text-muted-foreground">{label}</dt>
                                <dd className="min-w-0 break-words">{flexRender(c.columnDef.cell, cell.getContext())}</dd>
                              </div>
                            )
                          })}
                      </dl>
                    </div>
                  </div>
                )}
              </li>
            ))}
      </ul>

      {!loading && rows.length === 0 ? (
        <div className="p-8">{empty ?? <p className="text-center text-sm text-muted-foreground">{L.noResults}</p>}</div>
      ) : null}

      {pagination ? <DataTablePager p={pagination} labels={L} /> : null}
    </div>
  )
}

function DataTablePager({ p, labels }: { p: DataTablePagination; labels: DataTableLabels }) {
  const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize))
  const from = p.total === 0 ? 0 : (p.page - 1) * p.pageSize + 1
  const to = Math.min(p.page * p.pageSize, p.total)
  const options = p.pageSizeOptions ?? [10, 25, 50, 100]

  const pages: number[] = []
  const win = 5
  let start = Math.max(1, p.page - Math.floor(win / 2))
  const end = Math.min(totalPages, start + win - 1)
  start = Math.max(1, end - win + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hidden sm:inline">{labels.rowsPerPage}</span>
        <Select value={String(p.pageSize)} onValueChange={(v) => p.onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-9 w-20" aria-label={labels.rowsPerPage}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={String(o)}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="tabular" dir="ltr">
          {from}–{to} {labels.of} {p.total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="First page" disabled={p.page <= 1} onClick={() => p.onPageChange(1)}>
          <ChevronsLeft className="rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Previous page" disabled={p.page <= 1} onClick={() => p.onPageChange(p.page - 1)}>
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <div className="mx-1 hidden items-center gap-1 sm:flex">
          {pages.map((n) => (
            <Button key={n} variant={n === p.page ? 'default' : 'outline'} size="icon" aria-current={n === p.page ? 'page' : undefined} onClick={() => p.onPageChange(n)}>
              {n}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="icon" aria-label="Next page" disabled={p.page >= totalPages} onClick={() => p.onPageChange(p.page + 1)}>
          <ChevronRight className="rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Last page" disabled={p.page >= totalPages} onClick={() => p.onPageChange(totalPages)}>
          <ChevronsRight className="rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}
