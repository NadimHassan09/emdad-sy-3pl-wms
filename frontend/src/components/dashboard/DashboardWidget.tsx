import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { cn, Skeleton } from '@ds';

export function DashboardWidget({
  title,
  action,
  badge,
  children,
  className,
  padding = true,
}: {
  title: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-[12px] border border-border/70 bg-surface-panel shadow-sm',
        'transition-[box-shadow,border-color] duration-200',
        padding ? 'p-5' : 'p-0',
        className,
      )}
    >
      <header className={cn('mb-4 flex items-center justify-between gap-3', !padding && 'px-5 pt-5')}>
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-text-strong">{title}</h3>
          {badge}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn('min-w-0 flex-1', !padding && 'px-5 pb-5')}>{children}</div>
    </section>
  );
}

export function WidgetLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2 dark:text-brand-400 dark:hover:text-brand-300"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

export function WidgetError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full min-h-[88px] flex-col items-start justify-center gap-2">
      <p className="text-sm text-text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
      >
        {retryLabel}
      </button>
    </div>
  );
}

export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-sm text-text-muted">{children}</p>;
}

export function WidgetSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={i === 0 ? 28 : 16} />
      ))}
    </div>
  );
}
