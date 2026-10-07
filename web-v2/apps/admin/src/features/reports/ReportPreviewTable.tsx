import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, type DataTablePagination } from '@emdad/ui'
import { sortReportRows } from '@/lib/reports/report-engine'
import type { ReportColumnDef, ReportRow } from '@/lib/reports/types'

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null

type Props = {
  reportId: string
  columns: ReportColumnDef[]
  rows: ReportRow[]
  loading?: boolean
  empty?: string
  isArabic: boolean
  serverPagination?: Omit<DataTablePagination, 'pageSizeOptions'> & { pageSizeOptions?: number[] }
}

export function ReportPreviewTable({
  reportId,
  columns,
  rows,
  loading,
  empty,
  isArabic,
  serverPagination,
}: Props) {
  const [sort, setSort] = useState<SortState>(null)

  const sortedRows = useMemo(() => {
    if (!sort || serverPagination) return rows
    return sortReportRows(rows, sort.columnId, sort.direction, reportId)
  }, [rows, sort, reportId, serverPagination])

  const tableColumns = useMemo<ColumnDef<ReportRow>[]>(
    () =>
      columns.map((c, index) => ({
        id: c.id,
        accessorKey: c.id,
        header: () => {
          const label = isArabic ? c.headerAr : c.header
          if (!c.sortable || !c.sortValue || serverPagination) return label
          const active = sort?.columnId === c.id
          const dir = active ? sort.direction : 'asc'
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium hover:text-foreground"
              onClick={() =>
                setSort({
                  columnId: c.id,
                  direction: active && dir === 'asc' ? 'desc' : 'asc',
                })
              }
            >
              {label}
              <span className="text-xs font-normal text-muted-foreground">
                {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
              </span>
            </button>
          )
        },
        cell: ({ row }) => c.cell(row.original),
        meta: {
          priority: (index < 4 ? 1 : index < 8 ? 2 : 3) as 1 | 2 | 3,
          align: c.className?.includes('text-end') ? 'end' : 'start',
          className: c.className,
        },
      })),
    [columns, isArabic, sort, serverPagination],
  )

  const pagination: DataTablePagination | undefined = serverPagination
    ? {
        page: serverPagination.page,
        pageSize: serverPagination.pageSize,
        total: serverPagination.total,
        pageSizeOptions: serverPagination.pageSizeOptions ?? [25, 50, 100, 200],
        onPageChange: serverPagination.onPageChange,
        onPageSizeChange: serverPagination.onPageSizeChange,
      }
    : undefined

  return (
    <DataTable
      columns={tableColumns}
      data={serverPagination ? rows : sortedRows}
      getRowId={(r) => String(r.id ?? `${r.sku}-${r.location}-${r.orderNumber ?? ''}`)}
      loading={loading}
      empty={empty}
      pagination={pagination}
      labels={{
        rowsPerPage: isArabic ? 'صفوف لكل صفحة' : 'Rows per page',
        of: isArabic ? 'من' : 'of',
        noResults: empty ?? (isArabic ? 'لا توجد نتائج' : 'No results'),
      }}
      density="compact"
    />
  )
}
