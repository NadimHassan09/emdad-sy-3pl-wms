import type { ReportRow } from './types';

export type ChartPoint = { label: string; value: number };

export type ReportChartData = {
  bars: ChartPoint[];
  lines: ChartPoint[];
  title: string;
};

const CHART_COLORS = [
  '#059669',
  '#0d9488',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#c026d3',
  '#e11d48',
  '#ea580c',
  '#ca8a04',
  '#65a30d',
];

export function chartColor(i: number): string {
  return CHART_COLORS[i % CHART_COLORS.length]!;
}

export function buildReportChartData(
  rows: ReportRow[],
  labelKey: string,
  valueKey: string,
  title: string,
  topN = 12,
): ReportChartData {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[labelKey] ?? '—').trim() || '—';
    const raw = row[valueKey];
    const n =
      typeof raw === 'number'
        ? raw
        : Number(String(raw ?? '0').replace(/,/g, ''));
    totals.set(label, (totals.get(label) ?? 0) + (Number.isFinite(n) ? n : 0));
  }

  const sorted = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const bars: ChartPoint[] = sorted.map(([label, value]) => ({ label, value }));
  const lines: ChartPoint[] = [...bars].reverse();

  return { bars, lines, title };
}

/** Time-series from rows when labelKey looks like a date bucket. */
export function buildTimelineChartData(
  rows: ReportRow[],
  dateKey: string,
  valueKey: string,
  title: string,
): ReportChartData {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const d = String(row[dateKey] ?? '').slice(0, 10);
    if (!d) continue;
    const raw = row[valueKey];
    const n =
      typeof raw === 'number'
        ? raw
        : Number(String(raw ?? '1').replace(/,/g, ''));
    byDate.set(d, (byDate.get(d) ?? 0) + (Number.isFinite(n) ? n : 1));
  }
  const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const bars = sorted.map(([label, value]) => ({ label, value }));
  return { bars, lines: bars, title };
}
