import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, Skeleton } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import type { PeriodKey } from './dashboard-utils';
import { DashboardWidget, WidgetEmpty, WidgetError, WidgetLink } from './DashboardWidget';

export type OpsTab = 'orders' | 'tasks' | 'inbound' | 'outbound';

export type OpsPoint = {
  date: string;
  label: string;
  inbound?: number;
  outbound?: number;
  tasks?: number;
};

const TABS: OpsTab[] = ['orders', 'tasks', 'inbound', 'outbound'];

const TAB_LABEL: Record<OpsTab, string> = {
  orders: 'Orders',
  tasks: 'Tasks',
  inbound: 'Inbound',
  outbound: 'Outbound',
};

function ChartTooltip({
  active,
  payload,
  label,
  isArabic,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  isArabic: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border bg-surface-panel px-3 py-2 shadow-md">
      <p className="mb-1 text-[11px] font-medium text-text-muted">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-text-body">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{dashboardLabel(p.name, isArabic)}</span>
          <span className="ms-auto font-semibold tabular-nums text-text-strong">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function OperationsOverview({
  data,
  taskData,
  period,
  onPeriodChange,
  isArabic,
  isLoading,
  isError,
  onRetry,
}: {
  data: OpsPoint[];
  taskData?: OpsPoint[];
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  isArabic: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const [tab, setTab] = useState<OpsTab>('orders');

  const series = useMemo(() => {
    if (tab === 'inbound') return [{ key: 'inbound', name: 'Inbound Orders', color: 'var(--color-brand-500)' }];
    if (tab === 'outbound') return [{ key: 'outbound', name: 'Outbound Orders', color: 'var(--color-warning-500)' }];
    if (tab === 'tasks') return [{ key: 'tasks', name: 'Tasks', color: 'var(--color-accent-500)' }];
    return [
      { key: 'inbound', name: 'Inbound Orders', color: 'var(--color-brand-500)' },
      { key: 'outbound', name: 'Outbound Orders', color: 'var(--color-warning-500)' },
    ];
  }, [tab]);

  const chartData = tab === 'tasks' && taskData && taskData.length > 0 ? taskData : data;

  const hasData = chartData.some((d) =>
    series.some((s) => Number(d[s.key as keyof OpsPoint] ?? 0) > 0),
  );

  return (
    <DashboardWidget
      title={t('Operations Overview')}
      action={<WidgetLink to="/reports">{t('View full report')}</WidgetLink>}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-[10px] bg-surface-sunken p-0.5">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'h-8 rounded-[8px] px-3 text-xs font-semibold transition-colors',
                tab === id
                  ? 'bg-surface-panel text-text-strong shadow-sm'
                  : 'text-text-muted hover:text-text-body',
              )}
            >
              {t(TAB_LABEL[id])}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-[10px] border border-border p-0.5">
          {(['7', '30', '90'] as PeriodKey[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={cn(
                'h-7 rounded-[8px] px-2.5 text-[11px] font-semibold tabular-nums transition-colors',
                period === p
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400'
                  : 'text-text-muted hover:text-text-body',
              )}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <WidgetError
          message={t('Unable to load this data.')}
          retryLabel={t('Try again')}
          onRetry={onRetry ?? (() => undefined)}
        />
      ) : isLoading ? (
        <Skeleton height={240} className="rounded-xl" />
      ) : !hasData ? (
        <WidgetEmpty>{t('No chart data for this period.')}</WidgetEmpty>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`ops-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip
                content={<ChartTooltip isArabic={isArabic} />}
                cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }}
              />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#ops-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-panel)', fill: s.color }}
                  isAnimationActive
                  animationDuration={700}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasData && !isLoading && !isError ? (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {t(s.name)}
            </span>
          ))}
        </div>
      ) : null}
    </DashboardWidget>
  );
}
