import { Link } from 'react-router-dom';

import type { DashboardOverview } from '../../api/dashboard';
import { cn, Skeleton } from '@ds';

type TaskRow = DashboardOverview['openTasksByType'][number];

const BAR_COLOR = '#10B981';
const AXIS_TICKS = [0, 20, 40, 60, 80, 100] as const;

function rowMetrics(row: TaskRow) {
  const total = row.openCount + row.completedCount;
  const done = row.completedCount;
  const percent = total > 0 ? (done / total) * 100 : 0;
  return { total, done, percent };
}

function aggregateMetrics(rows: TaskRow[]) {
  const open = rows.reduce((s, r) => s + r.openCount, 0);
  const completed = rows.reduce((s, r) => s + r.completedCount, 0);
  const grand = open + completed;
  return {
    open,
    completed,
    completedPct: grand > 0 ? (completed / grand) * 100 : 0,
    pendingPct: grand > 0 ? (open / grand) * 100 : 0,
  };
}

function ChartRow({
  row,
  translateLabel,
}: {
  row: TaskRow;
  translateLabel: (label: string) => string;
}) {
  const { total, done, percent } = rowMetrics(row);
  const barWidth = Math.min(100, Math.max(0, percent));
  const fractionLabel = `${done} / ${total}`;
  const labelFitsInside = barWidth >= 24 && done > 0;

  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3 sm:grid-cols-[6.5rem_1fr]">
      <span className="truncate text-xs font-medium text-slate-700 sm:text-sm">
        {translateLabel(row.label)}
      </span>
      <div className="relative h-7">
        <div className="absolute inset-y-0 left-0 right-0 rounded-sm bg-slate-100" />
        {total > 0 && (
          <>
            {barWidth > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: BAR_COLOR,
                }}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'absolute inset-y-0 left-0 z-[1] flex items-center px-2 text-[11px] font-semibold tabular-nums sm:text-xs',
                labelFitsInside ? 'overflow-hidden text-white' : 'text-slate-700',
              )}
              style={labelFitsInside ? { width: `${barWidth}%`, maxWidth: '100%' } : undefined}
            >
              {fractionLabel}
            </span>
            {barWidth > 0 && (
              <div
                className="absolute top-0 bottom-0 z-[2] w-px bg-slate-900"
                style={{ left: `${barWidth}%`, transform: 'translateX(-1px)' }}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function OpenTasksByTypeChartCard({
  title,
  rows,
  to,
  translateLabel,
  formatPercent,
}: {
  title: string;
  rows: TaskRow[];
  to: string;
  translateLabel: (label: string) => string;
  formatPercent: (value: number) => string;
}) {
  const { completedPct, pendingPct } = aggregateMetrics(rows);
  const visibleRows = rows.filter((r) => r.openCount + r.completedCount > 0);

  return (
    <Link
      to={to}
      className={cn(
        'block rounded-2xl border border-slate-100 bg-white p-5 shadow-sm',
        'transition-[box-shadow,border-color,transform] duration-fast ease-standard',
        'hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
      )}
    >
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>

      <div className="mt-5 space-y-3">
        {(visibleRows.length > 0 ? visibleRows : rows).map((row) => (
          <ChartRow key={row.key} row={row} translateLabel={translateLabel} />
        ))}
      </div>

      <div className="mt-4 flex justify-between gap-1 px-0.5 text-[10px] tabular-nums text-slate-400 sm:text-xs">
        {AXIS_TICKS.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-full border border-brand-500/40 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          +{formatPercent(completedPct)} {translateLabel('completed')}
        </span>
        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
          +{formatPercent(pendingPct)} {translateLabel('pending')}
        </span>
      </div>
    </Link>
  );
}

export function OpenTasksByTypeChartCardSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[5.5rem_1fr] gap-3">
            <Skeleton height={14} width="80%" />
            <Skeleton height={28} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-3">
        <Skeleton height={28} width={140} className="rounded-full" />
        <Skeleton height={28} width={120} className="rounded-full" />
      </div>
    </div>
  );
}
