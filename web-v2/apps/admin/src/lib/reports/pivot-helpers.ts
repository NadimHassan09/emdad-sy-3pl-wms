import type { ReportColumnDef, ReportRow } from './types';

export type PivotGroup = {
  key: string;
  label: string;
  rows: ReportRow[];
  subtotal: Record<string, number>;
};

export function groupReportRows(
  rows: ReportRow[],
  groupByKey: string,
  measureKeys: string[],
): PivotGroup[] {
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const label = String(row[groupByKey] ?? '—').trim() || '—';
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }

  return [...groups.entries()]
    .map(([label, groupRows]) => {
      const subtotal: Record<string, number> = {};
      for (const mk of measureKeys) {
        subtotal[mk] = groupRows.reduce((sum, r) => {
          const n = Number(String(r[mk] ?? '0').replace(/,/g, ''));
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
      }
      return { key: label, label, rows: groupRows, subtotal };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function defaultPivotGroupKey(columns: ReportColumnDef[]): string {
  const preferred = ['client', 'status', 'movement', 'taskType', 'sku', 'location'];
  for (const p of preferred) {
    if (columns.some((c) => c.id === p)) return p;
  }
  return columns[0]?.id ?? 'id';
}

export function numericColumnIds(columns: ReportColumnDef[]): string[] {
  return columns
    .filter((c) =>
      ['onHand', 'available', 'reserved', 'quantity', 'lines', 'totalQty', 'inboundOrders', 'outboundOrders', 'totalOrders', 'completedTasks', 'avgMinutes', 'projectedQty', 'movementCount'].includes(
        c.id,
      ),
    )
    .map((c) => c.id);
}
