/**
 * Metric / KPI card with size variants for information hierarchy.
 * Keeps existing brand tokens — only varies emphasis and density.
 */

import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ClientMetricCardProps = {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  iconClass?: string;
  loading?: boolean;
  /** sm = compact secondary; md = default; lg/featured = primary focus */
  size?: 'sm' | 'md' | 'lg' | 'featured';
  /** Soft brand tint for primary KPIs */
  emphasize?: boolean;
};

export function ClientMetricCard({
  title,
  value,
  hint,
  to,
  iconClass = 'fa-solid fa-chart-simple',
  loading,
  size = 'md',
  emphasize = false,
}: ClientMetricCardProps): ReactElement {
  const padding =
    size === 'sm' ? 'p-3' : size === 'featured' || size === 'lg' ? 'p-4 sm:p-5' : 'p-3.5 sm:p-4';
  const valueSize =
    size === 'sm'
      ? 'text-lg'
      : size === 'featured' || size === 'lg'
        ? 'text-3xl sm:text-4xl'
        : 'text-2xl';
  const iconBox =
    size === 'sm' ? 'h-7 w-7 rounded-md' : size === 'featured' ? 'h-10 w-10 rounded-xl' : 'h-8 w-8 rounded-lg';

  const cardClass = [
    'rounded-[var(--radius-card)] border shadow-[var(--shadow-xs)] transition duration-[var(--duration-fast)]',
    padding,
    emphasize
      ? 'border-brand-200 dark:border-white/10 bg-brand-50/40 dark:bg-white/[0.04] hover:border-brand-300 dark:hover:border-white/20 hover:shadow-[var(--shadow-sm)]'
      : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-default)] hover:shadow-[var(--shadow-sm)]',
  ].join(' ');

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={[
            'font-bold uppercase tracking-[0.08em]',
            size === 'sm' ? 'text-[9px]' : 'text-[10px]',
            emphasize ? 'text-brand-700 dark:text-brand-400' : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {title}
        </p>
        <span
          className={[
            'flex shrink-0 items-center justify-center',
            iconBox,
            emphasize
              ? 'bg-brand-100 dark:bg-white/10 text-brand-800 dark:text-brand-300'
              : 'bg-brand-50 dark:bg-white/5 text-brand-700 dark:text-brand-400',
          ].join(' ')}
          aria-hidden="true"
        >
          <i className={`${iconClass} ${size === 'sm' ? 'text-xs' : 'text-sm'}`} />
        </span>
      </div>
      <p
        className={[
          'mt-2 font-semibold tabular-nums tracking-tight text-[var(--text-strong)]',
          valueSize,
        ].join(' ')}
      >
        {loading ? (
          <span
            className="inline-block h-7 w-16 animate-pulse rounded-md bg-skeleton-base"
            aria-hidden="true"
          />
        ) : (
          value
        )}
      </p>
      {hint ? <div className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">{hint}</div> : null}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`${cardClass} block h-full text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={`${cardClass} h-full`}>{inner}</div>;
}
