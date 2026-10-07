import { getReportById } from './registry';
import type { ReportRow } from './types';

export function sortReportRows(
  rows: ReportRow[],
  columnId: string,
  direction: 'asc' | 'desc',
  reportId: string,
): ReportRow[] {
  const def = getReportById(reportId);
  const col = def?.columns.find((c) => c.id === columnId);
  if (!col?.sortValue) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = col.sortValue!(a);
    const bv = col.sortValue!(b);
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  });
  return direction === 'desc' ? sorted.reverse() : sorted;
}
