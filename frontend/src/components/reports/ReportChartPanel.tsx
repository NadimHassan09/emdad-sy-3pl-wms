import { useMemo } from 'react';

import { PieChart, type PieSlice } from '../PieChart';
import { buildReportChartData, buildTimelineChartData, chartColor } from '../../lib/reports/chart-data';
import type { ReportChartKind, ReportDefinition, ReportRow } from '../../lib/reports/types';

type Props = {
  report: ReportDefinition;
  rows: ReportRow[];
  isArabic: boolean;
  chartKind?: ReportChartKind;
};

export function ReportChartPanel({ report, rows, isArabic, chartKind = 'bar' }: Props) {
  const labelKey = report.chartLabelKey ?? report.columns[0]?.id ?? 'id';
  const valueKey = report.chartValueKey ?? 'quantity';

  const chart = useMemo(() => {
    if (labelKey === 'date' || labelKey === 'created') {
      return buildTimelineChartData(rows, labelKey, valueKey, report.title);
    }
    return buildReportChartData(rows, labelKey, valueKey, report.title);
  }, [rows, labelKey, valueKey, report.title]);

  const max = Math.max(...chart.bars.map((b) => b.value), 1);

  const pieSlices: PieSlice[] = chart.bars.map((b, i) => ({
    label: b.label,
    count: b.value,
    color: chartColor(i),
  }));

  if (chartKind === 'pie') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <PieChart
          title={isArabic ? 'توزيع تشغيلي' : 'Operational distribution'}
          slices={pieSlices}
          size={220}
        />
      </div>
    );
  }

  if (chartKind === 'line') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          {isArabic ? 'اتجاه النشاط' : 'Activity trend'}
        </h3>
        <svg viewBox="0 0 400 160" className="h-52 w-full" role="img" aria-label={chart.title}>
          {chart.lines.length < 2 ? (
            <text x="200" y="80" textAnchor="middle" className="fill-slate-400 text-xs">
              {isArabic ? 'بيانات غير كافية للرسم' : 'Insufficient points for trend'}
            </text>
          ) : (
            <>
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                points={chart.lines
                  .map((p, i) => {
                    const x = 20 + (i / Math.max(chart.lines.length - 1, 1)) * 360;
                    const y = 150 - (p.value / max) * 130;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {chart.lines.map((p, i) => {
                const x = 20 + (i / Math.max(chart.lines.length - 1, 1)) * 360;
                const y = 150 - (p.value / max) * 130;
                return <circle key={p.label} cx={x} cy={y} r="4" fill="#059669" />;
              })}
            </>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          {isArabic ? 'توزيع تشغيلي' : 'Operational distribution'}
        </h3>
        <div className="flex h-56 items-end gap-2 border-b border-slate-100 pb-2">
          {chart.bars.length === 0 ? (
            <p className="text-sm text-slate-500">{isArabic ? 'لا توجد بيانات' : 'No data'}</p>
          ) : (
            chart.bars.map((b, i) => (
              <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-slate-600 tabular-nums">{b.value}</span>
                <div
                  className="w-full max-w-[2.5rem] rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(8, (b.value / max) * 160)}px`,
                    backgroundColor: chartColor(i),
                  }}
                  title={`${b.label}: ${b.value}`}
                />
                <span className="max-w-full truncate text-[9px] text-slate-500" title={b.label}>
                  {b.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          {isArabic ? 'اتجاه النشاط' : 'Activity trend'}
        </h3>
        <svg viewBox="0 0 400 160" className="h-44 w-full" role="img" aria-label={chart.title}>
          {chart.lines.length < 2 ? (
            <text x="200" y="80" textAnchor="middle" className="fill-slate-400 text-xs">
              {isArabic ? 'بيانات غير كافية للرسم' : 'Insufficient points for trend'}
            </text>
          ) : (
            <polyline
              fill="none"
              stroke="#059669"
              strokeWidth="2"
              points={chart.lines
                .map((p, i) => {
                  const x = 20 + (i / Math.max(chart.lines.length - 1, 1)) * 360;
                  const y = 150 - (p.value / max) * 130;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
