import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn, Skeleton } from '@ds';

import { KPISparkline } from './KPISparkline';

type Tone = 'green' | 'amber' | 'blue' | 'purple' | 'rose';

const TONE: Record<Tone, { wrap: string; icon: string; spark: string }> = {
  green: {
    wrap: 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
    icon: 'text-brand-600 dark:text-brand-400',
    spark: 'var(--color-brand-500)',
  },
  amber: {
    wrap: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
    spark: 'var(--color-warning-500)',
  },
  blue: {
    wrap: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
    icon: 'text-sky-600 dark:text-sky-400',
    spark: 'var(--color-accent-500)',
  },
  purple: {
    wrap: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    icon: 'text-violet-600 dark:text-violet-400',
    spark: '#8b5cf6',
  },
  rose: {
    wrap: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    icon: 'text-rose-600 dark:text-rose-400',
    spark: 'var(--color-danger-500)',
  },
};

export type KPICardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  to?: string;
  trend?: { value: number; label: string } | null;
  sparkline?: Array<{ value: number }>;
  breakdown?: Array<{ label: string; value: string | number }>;
  hint?: string;
};

export function KPICard({
  title,
  value,
  icon: Icon,
  tone = 'green',
  to,
  trend,
  sparkline,
  breakdown,
  hint,
}: KPICardProps) {
  const palette = TONE[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-xs font-medium text-text-muted">{title}</p>
          {hint ? (
            <span title={hint} className="text-text-faint">
              <Info className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            palette.wrap,
          )}
        >
          <Icon className={cn('h-4 w-4', palette.icon)} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>

      <p className="mt-3 text-[1.75rem] font-bold leading-none tracking-tight text-text-strong tabular-nums sm:text-[2rem]">
        {value}
      </p>

      {trend != null ? (
        <p
          className={cn(
            'mt-2 inline-flex items-center gap-0.5 text-xs font-medium',
            trend.value > 0
              ? 'text-status-success-fg'
              : trend.value < 0
                ? 'text-status-danger-fg'
                : 'text-text-muted',
          )}
        >
          {trend.value > 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : trend.value < 0 ? (
            <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : null}
          <span>
            {trend.value === 0
              ? trend.label
              : `${Math.abs(trend.value).toFixed(1)}% ${trend.label}`}
          </span>
        </p>
      ) : (
        <div className="mt-2 h-4" />
      )}

      {sparkline && sparkline.length > 1 ? (
        <div className="mt-2">
          <KPISparkline data={sparkline} color={palette.spark} />
        </div>
      ) : (
        <div className="mt-2 h-8" />
      )}

      {breakdown && breakdown.length > 0 ? (
        <p className="mt-3 truncate text-[11px] text-text-faint">
          {breakdown.map((b, i) => (
            <span key={b.label}>
              {i > 0 ? <span className="mx-1.5 text-border-strong">•</span> : null}
              <span className="tabular-nums font-medium text-text-muted">{b.value}</span>{' '}
              {b.label}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );

  const className = cn(
    'flex min-h-[168px] flex-col rounded-[12px] border border-border/70 bg-surface-panel p-5 shadow-sm',
    'transition-[box-shadow,border-color] duration-200',
    to &&
      'cursor-pointer hover:border-brand-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:border-brand-800',
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function KPICardSkeleton() {
  return (
    <div className="flex min-h-[168px] flex-col rounded-[12px] border border-border/70 bg-surface-panel p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton height={12} width="45%" />
        <Skeleton height={32} width={32} className="rounded-lg" />
      </div>
      <Skeleton height={32} width="40%" className="mt-4" />
      <Skeleton height={12} width="55%" className="mt-3" />
      <Skeleton height={24} className="mt-3" />
    </div>
  );
}
