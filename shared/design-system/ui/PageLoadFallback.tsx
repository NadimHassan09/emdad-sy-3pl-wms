import { Skeleton } from './Skeleton';

/**
 * PageLoadFallback — full-content-area skeleton shown while a lazy route
 * chunk is downloading. The AppShell (topbar + sidebar) is already rendered;
 * this fills the `<main>` scroll area with plausible page structure.
 *
 * Used as the `fallback` prop of every React.Suspense boundary wrapping
 * lazy-loaded route elements.
 */
export function PageLoadFallback() {
  return (
    <div className="p-5 sm:p-6 space-y-5 animate-pulse">
      {/* Page header skeleton */}
      <div className="pb-4 mb-2 border-b border-neutral-100 space-y-2">
        <Skeleton height={26} width="32%" />
        <Skeleton height={13} width="52%" />
      </div>

      {/* Toolbar / filter bar skeleton */}
      <div className="flex gap-3">
        <Skeleton height={34} width="220px" shape="pill" />
        <Skeleton height={34} width="130px" shape="pill" />
        <Skeleton height={34} width="100px" shape="pill" className="ms-auto" />
      </div>

      {/* Table skeleton: header row + 8 data rows */}
      <div className="rounded-card border border-neutral-200 overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="flex gap-4 px-4 py-2 bg-neutral-50 border-b border-neutral-200">
          {[150, 120, 80, 140, 90, 100].map((w, i) => (
            <Skeleton key={i} height={12} width={w} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3 border-b border-neutral-100 last:border-0"
            style={{ opacity: Math.max(1 - i * 0.08, 0.4) }}
          >
            {[150, 120, 80, 140, 90, 100].map((w, j) => (
              <Skeleton key={j} height={14} width={w} />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton height={13} width="120px" />
        <div className="flex gap-2">
          <Skeleton height={30} width="80px" shape="pill" />
          <Skeleton height={30} width="80px" shape="pill" />
        </div>
      </div>
    </div>
  );
}
