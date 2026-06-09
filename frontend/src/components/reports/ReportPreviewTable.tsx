import { useMemo, useState, type ReactNode } from 'react';

import type { ReportColumnDef, ReportRow } from '../../lib/reports/types';
import { sortReportRows } from '../../lib/reports/report-engine';
import { Column, DataTable } from '../DataTable';

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null;

type ServerPagination = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

type ReportPreviewTableProps = {
  reportId: string;
  columns: ReportColumnDef[];
  rows: ReportRow[];
  loading?: boolean;
  empty?: string;
  isArabic: boolean;
  serverPagination?: ServerPagination;
};

export function ReportPreviewTable({
  reportId,
  columns,
  rows,
  loading,
  empty,
  isArabic,
  serverPagination,
}: ReportPreviewTableProps) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return sortReportRows(rows, sort.columnId, sort.direction, reportId);
  }, [rows, sort, reportId]);

  const dataColumns: Column<ReportRow>[] = useMemo(
    () =>
      columns.map((c) => ({
        header: sortableHeader(c, isArabic, sort, setSort),
        accessor: (row) => c.cell(row),
        className: c.className,
        width: c.width,
      })),
    [columns, isArabic, sort],
  );

  return (
    <div className="report-preview-table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50">
    <DataTable
      columns={dataColumns}
      rows={serverPagination ? rows : sortedRows}
      rowKey={(r) => String(r.id ?? `${r.sku}-${r.location}`)}
      loading={loading}
      empty={empty}
      serverPagination={serverPagination}
      labels={{
        rowsSuffix: isArabic ? 'صف' : 'rows',
        resultsSuffix: isArabic ? 'نتيجة' : 'results',
        ofWord: isArabic ? 'من' : 'of',
        previous: isArabic ? 'السابق' : 'Previous',
        next: isArabic ? 'التالي' : 'Next',
        rowsPerPageAria: isArabic ? 'عدد الصفوف' : 'Rows per page',
      }}
    />
    </div>
  );
}

function sortableHeader(
  col: ReportColumnDef,
  isArabic: boolean,
  sort: SortState,
  setSort: (s: SortState) => void,
): ReactNode {
  const label = isArabic ? col.headerAr : col.header;
  if (!col.sortable || !col.sortValue) return label;
  const active = sort?.columnId === col.id;
  const dir = active ? sort.direction : 'asc';
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800"
      onClick={() =>
        setSort({
          columnId: col.id,
          direction: active && dir === 'asc' ? 'desc' : 'asc',
        })
      }
    >
      {label}
      <span className="text-[10px] font-normal normal-case text-slate-400">
        {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}
