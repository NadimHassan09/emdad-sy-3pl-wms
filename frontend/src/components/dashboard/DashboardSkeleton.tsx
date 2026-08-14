import { Skeleton } from '@ds';

import { KPICardSkeleton } from './KPICard';

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="space-y-2">
          <Skeleton height={28} width="280px" />
          <Skeleton height={14} width="360px" />
        </div>
        <Skeleton height={36} width="220px" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="rounded-[12px] border border-border/70 bg-surface-panel p-5 xl:col-span-6">
          <Skeleton height={16} width="40%" />
          <Skeleton height={240} className="mt-4 rounded-xl" />
        </div>
        <div className="rounded-[12px] border border-border/70 bg-surface-panel p-5 xl:col-span-3">
          <Skeleton height={16} width="50%" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        </div>
        <div className="rounded-[12px] border border-border/70 bg-surface-panel p-5 xl:col-span-3">
          <Skeleton height={16} width="50%" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={72} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
