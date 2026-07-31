import { useMemo, useState } from 'react';

import { cn } from '@ds';
import {
  defaultPivotGroupKey,
  groupReportRows,
  numericColumnIds,
} from '../../lib/reports/pivot-helpers';
import type { ReportColumnDef, ReportDefinition, ReportFilterValues, ReportRow } from '../../lib/reports/types';

type Props = {
  report: ReportDefinition;
  rows: ReportRow[];
  filters: ReportFilterValues;
  columns: ReportColumnDef[];
  isArabic: boolean;
};

export function ReportPivotPanel({ report, rows, filters, columns, isArabic }: Props) {
  const defaultKey =
    filters.groupBy ||
    report.groupByOptions?.[0]?.value ||
    defaultPivotGroupKey(columns);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const measureKeys = numericColumnIds(columns);
  const groups = useMemo(
    () => groupReportRows(rows, defaultKey, measureKeys),
    [rows, defaultKey, measureKeys],
  );

  const groupLabel =
    report.groupByOptions?.find((o) => o.value === defaultKey)?.label ??
    columns.find((c) => c.id === defaultKey)?.header ??
    defaultKey;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-panel shadow-soft">
      <div className="border-b border-border-subtle bg-surface-card-muted/80 px-4 py-3 text-sm text-text-body">
        {isArabic ? `تجميع حسب: ${groupLabel}` : `Grouped by: ${groupLabel}`}
        <span className="ms-2 text-text-faint">· {groups.length} groups</span>
      </div>
      <div className="max-h-[32rem] overflow-auto">
        {groups.map((g) => {
          const open = expanded.has(g.key);
          return (
            <div key={g.key} className="border-b border-border-subtle last:border-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 bg-surface-panel px-4 py-3 text-start hover:bg-surface-hover"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(g.key)) next.delete(g.key);
                    else next.add(g.key);
                    return next;
                  })
                }
              >
                <span className="font-semibold text-text-strong">{g.label}</span>
                <span className="text-xs text-text-muted">
                  {g.rows.length} {isArabic ? 'صف' : 'rows'}
                  {measureKeys[0] != null && (
                    <> · Σ {Math.round(g.subtotal[measureKeys[0]!] ?? 0)}</>
                  )}
                </span>
              </button>
              {open && (
                <div className="overflow-x-auto bg-surface-card-muted/50 px-2 pb-2">
                  <table className="w-full min-w-[40rem] text-xs">
                    <thead>
                      <tr className="text-text-muted">
                        {columns.slice(0, 6).map((c) => (
                          <th
                            key={c.id}
                            className="sticky top-0 bg-surface-card-muted px-2 py-2 text-start font-semibold"
                          >
                            {isArabic ? c.headerAr : c.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.slice(0, 50).map((row, i) => (
                        <tr
                          key={String(row.id ?? i)}
                          className={cn('border-t border-border-subtle hover:bg-surface-panel')}
                        >
                          {columns.slice(0, 6).map((c) => (
                            <td key={c.id} className="px-2 py-2 text-text-body">
                              {c.cell(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
