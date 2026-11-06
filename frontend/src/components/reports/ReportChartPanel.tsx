import { useMemo } from 'react';

import { PieChart, type PieSlice } from '../PieChart';
import { buildReportChartData, buildTimelineChartData, chartColor } from '../../lib/reports/chart-data';
import type { ReportChartKind, ReportDefinition, ReportRow } from '../../lib/reports/types';

const CHART_PANEL_CLASS = 'rounded-2xl border border-border bg-surface-panel p-5 shadow-soft';
const CHART_TITLE_CLASS = 'mb-4 text-sm font-semibold text-text-strong';
const CHART_STROKE = 'var(--color-brand-600)';

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
      <div className={CHART_PANEL_CLASS}>
        <PieChart
          title={isArabic ? 'توزيع تشغيلي' : 'Operational distribution'}
          slices={pieSlices}
          size={220}
        />
      </div>
    );
  }

  if (chartKind === 'line') {
    const GRID_TICKS = 4;
    return (
      <div className={CHART_PANEL_CLASS}>
        <h3 className={CHART_TITLE_CLASS}>
          {isArabic ? 'اتجاه النشاط' : 'Activity trend'}
        </h3>
        <svg viewBox="0 0 420 180" className="h-52 w-full" role="img" aria-label={chart.title}>
          {chart.lines.length < 2 ? (
            <text x="210" y="90" textAnchor="middle" className="fill-text-faint text-xs">
              {isArabic ? 'بيانات غير كافية للرسم' : 'Insufficient points for trend'}
            </text>
          ) : (
            <>
              {Array.from({ length: GRID_TICKS + 1 }, (_, i) => {
                const y = 20 + (i / GRID_TICKS) * 130;
                const val = Math.round(max * (1 - i / GRID_TICKS));
                return (
                  <g key={i}>
                    <line x1="40" x2="410" y1={y} y2={y} stroke="var(--color-border-subtle)" strokeWidth="0.5" />
                    <text x="36" y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-text-muted)">{val}</text>
                  </g>
                );
              })}
              <polyline
                fill="none"
                stroke={CHART_STROKE}
                strokeWidth="2"
                points={chart.lines
                  .map((p, i) => {
                    const x = 40 + (i / Math.max(chart.lines.length - 1, 1)) * 370;
                    const y = 150 - (p.value / max) * 130;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {chart.lines.map((p, i) => {
                const x = 40 + (i / Math.max(chart.lines.length - 1, 1)) * 370;
                const y = 150 - (p.value / max) * 130;
                const showLabel = chart.lines.length <= 12 || i % Math.ceil(chart.lines.length / 12) === 0;
                return (
                  <g key={p.label}>
                    <circle cx={x} cy={y} r="3.5" fill={CHART_STROKE} />
                    <title>{`${p.label}: ${p.value}`}</title>
                    {showLabel && (
                      <text x={x} y="172" textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">
                        {p.label.length > 6 ? p.label.slice(0, 6) : p.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={CHART_PANEL_CLASS}>
        <h3 className={CHART_TITLE_CLASS}>
          {isArabic ? 'توزيع تشغيلي' : 'Operational distribution'}
        </h3>
        <div className="flex h-56 items-end gap-2 border-b border-border-subtle pb-2">
          {chart.bars.length === 0 ? (
            <p className="text-sm text-text-muted">{isArabic ? 'لا توجد بيانات' : 'No data'}</p>
          ) : (
            chart.bars.map((b, i) => (
              <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-text-body tabular-nums">{b.value}</span>
                <div
                  className="w-full max-w-[2.5rem] rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(8, (b.value / max) * 160)}px`,
                    backgroundColor: chartColor(i),
                  }}
                  title={`${b.label}: ${b.value}`}
                />
                <span className="max-w-full truncate text-[9px] text-text-muted" title={b.label}>
                  {b.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={CHART_PANEL_CLASS}>
        <h3 className={CHART_TITLE_CLASS}>
          {isArabic ? 'اتجاه النشاط' : 'Activity trend'}
        </h3>
        <svg viewBox="0 0 400 170" className="h-44 w-full" role="img" aria-label={chart.title}>
          {chart.lines.length < 2 ? (
            <text x="200" y="80" textAnchor="middle" className="fill-text-faint text-xs">
              {isArabic ? 'بيانات غير كافية للرسم' : 'Insufficient points for trend'}
            </text>
          ) : (
            <>
              {[0, 0.5, 1].map((frac, i) => {
                const y = 20 + frac * 120;
                return (
                  <g key={i}>
                    <line x1="30" x2="395" y1={y} y2={y} stroke="var(--color-border-subtle)" strokeWidth="0.5" />
                    <text x="26" y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-text-muted)">{Math.round(max * (1 - frac))}</text>
                  </g>
                );
              })}
              <polyline
                fill="none"
                stroke={CHART_STROKE}
                strokeWidth="2"
                points={chart.lines
                  .map((p, i) => {
                    const x = 30 + (i / Math.max(chart.lines.length - 1, 1)) * 365;
                    const y = 140 - (p.value / max) * 120;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {chart.lines.map((p, i) => {
                const x = 30 + (i / Math.max(chart.lines.length - 1, 1)) * 365;
                const y = 140 - (p.value / max) * 120;
                return (
                  <g key={p.label}>
                    <circle cx={x} cy={y} r="3" fill={CHART_STROKE} />
                    <title>{`${p.label}: ${p.value}`}</title>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
