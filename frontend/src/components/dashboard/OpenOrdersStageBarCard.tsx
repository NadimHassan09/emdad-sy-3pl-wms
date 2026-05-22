import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { DashboardChartSlice } from '../../api/dashboard';
import { Skeleton } from '@ds';

/** Color per pipeline stage (earliest → latest). */
const STAGE_COLORS: Record<string, string> = {
  new: '#0a3d28',
  receive: '#146135',
  putaway: '#4ade80',
  picking: '#0a3d28',
  packing: '#146135',
  shipping: '#4ade80',
};

const STAGE_COLORS_BY_INDEX = ['#0a3d28', '#a7d4b8', '#146135', '#6ee7b7', '#1a7a44', '#4ade80'];

function stageColor(slice: DashboardChartSlice, index: number): string {
  return STAGE_COLORS[slice.key] ?? STAGE_COLORS_BY_INDEX[index % STAGE_COLORS_BY_INDEX.length]!;
}

function orderProgressPercent(inProgress: number, notInProgress: number): number {
  const total = inProgress + notInProgress;
  if (total === 0) return 0;
  return Math.round((inProgress / total) * 100);
}

function notInProgressShare(inProgress: number, notInProgress: number): number {
  const total = inProgress + notInProgress;
  if (total === 0) return 0;
  return Math.round((notInProgress / total) * 1000) / 10;
}

function StageBars({
  slices,
  translateLabel,
}: {
  slices: DashboardChartSlice[];
  translateLabel: (label: string) => string;
}) {
  const max = Math.max(...slices.map((s) => s.count), 1);

  return (
    <div className="flex h-[120px] items-end justify-end gap-1.5 sm:gap-2" aria-hidden="true">
      {slices.map((slice, index) => {
        const heightPct = slice.count > 0 ? Math.max(12, (slice.count / max) * 100) : 8;
        const bg = stageColor(slice, index);
        const showInnerLabel = heightPct >= 28 && slice.count > 0;

        return (
          <div
            key={slice.key}
            className="flex w-7 flex-col items-center justify-end sm:w-8"
            title={`${translateLabel(slice.label)}: ${slice.count}`}
          >
            <div
              className="relative flex w-full items-start justify-center rounded-t-full transition-[height] duration-slow ease-standard"
              style={{
                height: `${heightPct}%`,
                backgroundColor: bg,
                minHeight: slice.count > 0 ? '1.25rem' : '0.5rem',
              }}
            >
              {showInnerLabel && (
                <span className="mt-1.5 text-[10px] font-bold tabular-nums text-white sm:text-[11px]">
                  {slice.count}
                </span>
              )}
            </div>
            {!showInnerLabel && slice.count > 0 && (
              <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
                {slice.count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const cardClass =
  'rounded-xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm transition-[box-shadow,border-color,transform] duration-fast ease-standard sm:p-5';

const cardInteractiveClass =
  'hover:border-slate-200 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:shadow-focus';

export function OpenOrdersStageBarCard({
  title,
  slices,
  inProgress = 0,
  notInProgress = 0,
  to,
  isLoading,
  translateLabel,
  openOrdersSubtitle,
  openOrderCount,
}: {
  title: string;
  slices: DashboardChartSlice[] | undefined;
  inProgress?: number;
  notInProgress?: number;
  /** Fallback when chart progress totals are missing (e.g. overview open-order count). */
  openOrderCount?: number;
  to: string;
  isLoading?: boolean;
  translateLabel: (label: string) => string;
  openOrdersSubtitle: (total: number) => string;
}) {
  const rows = slices ?? [];
  const stageSum = rows.reduce((sum, slice) => sum + slice.count, 0);
  let progressOpen = inProgress;
  let progressNotStarted = notInProgress;
  if (progressOpen + progressNotStarted === 0 && stageSum > 0) {
    progressNotStarted = rows[0]?.count ?? 0;
    progressOpen = rows.slice(1).reduce((sum, slice) => sum + slice.count, 0);
  }
  const countedTotal = progressOpen + progressNotStarted;
  const total = countedTotal > 0 ? countedTotal : Math.max(openOrderCount ?? 0, stageSum);
  const percent = orderProgressPercent(progressOpen, progressNotStarted);
  const notStartedShare = notInProgressShare(progressOpen, progressNotStarted);

  return (
    <Link to={to} className={`block ${cardClass} ${cardInteractiveClass}`}>
      <div className="flex items-stretch justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {isLoading ? (
            <>
              <Skeleton height={36} width={72} className="mt-3" />
              <Skeleton height={14} width={100} className="mt-3" />
              <Skeleton height={12} width={120} className="mt-2" />
            </>
          ) : (
            <>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2.5rem]">
                {percent}%
              </p>
              {total > 0 && notStartedShare > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-red-500">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                    <i className="fa-solid fa-arrow-down text-[10px]" aria-hidden="true" />
                  </span>
                  {notStartedShare}%
                </p>
              )}
              <p className="mt-1 text-xs font-medium text-slate-500">{openOrdersSubtitle(total)}</p>
            </>
          )}
        </div>

        <div className="shrink-0">
          {isLoading ? (
            <div className="flex h-[120px] items-end gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={60 + i * 12} width={28} className="rounded-t-full" />
              ))}
            </div>
          ) : (
            <StageBars slices={rows} translateLabel={translateLabel} />
          )}
        </div>
      </div>
    </Link>
  );
}

export function OpenOrdersStageBarCardSkeleton({ title }: { title: ReactNode }) {
  return (
    <div className={cardClass}>
      <div className="flex items-stretch justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <Skeleton height={36} width={72} className="mt-3" />
          <Skeleton height={14} width={80} className="mt-3" />
          <Skeleton height={12} width={110} className="mt-2" />
        </div>
        <div className="flex h-[120px] items-end gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={50 + i * 18} width={28} className="rounded-t-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
