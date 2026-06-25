import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Skeleton } from '@ds';

const cardClass =
  'flex min-h-[120px] flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ' +
  'transition-[box-shadow,transform] duration-fast ease-standard';

const cardInteractiveClass =
  'hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40';

export function OpenOrdersStageBarCard({
  title,
  openOrderCount = 0,
  to,
  isLoading,
}: {
  title: string;
  openOrderCount?: number;
  to: string;
  isLoading?: boolean;
}) {
  return (
    <Link to={to} className={`block ${cardClass} ${cardInteractiveClass}`}>
      <h3 className="text-sm font-medium text-slate-600">{title}</h3>
      {isLoading ? (
        <Skeleton height={36} width={96} className="mt-3" />
      ) : (
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2.5rem]">
          {openOrderCount.toLocaleString()}
        </p>
      )}
    </Link>
  );
}

export function OpenOrdersStageBarCardSkeleton({ title }: { title: ReactNode }) {
  return (
    <div className={cardClass}>
      <h3 className="text-sm font-medium text-slate-600">{title}</h3>
      <Skeleton height={36} width={96} className="mt-3" />
    </div>
  );
}
