import type { ReportColumnDef, ReportRow } from './types';

export const cell = (key: string) => (row: ReportRow) => row[key] ?? '—';
export const csv = (key: string) => (row: ReportRow) => String(row[key] ?? '');
export const sort = (key: string) => (row: ReportRow): string | number => {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v ?? '');
};

export function col(
  id: string,
  header: string,
  headerAr: string,
  opts?: Partial<Pick<ReportColumnDef, 'sortable' | 'className' | 'width'>>,
): ReportColumnDef {
  return {
    id,
    header,
    headerAr,
    csv: csv(id),
    cell: cell(id),
    sortValue: opts?.sortable ? sort(id) : undefined,
    ...opts,
  };
}
