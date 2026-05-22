import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { DashboardChartSlice } from '../../api/dashboard';
import { Skeleton } from '@ds';

const GAUGE_COLORS = {
  completed: '#4ade80',
  inProgress: '#166534',
  pendingStroke: '#e2e8f0',
} as const;

type GaugeSegment = {
  label: string;
  count: number;
  variant: keyof typeof GAUGE_COLORS | 'pending';
};

function pipelinePercent(segments: GaugeSegment[]): number {
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return 0;
  const weights: Record<GaugeSegment['variant'], number> = {
    completed: 3,
    inProgress: 2,
    pending: 1,
  };
  const score = segments.reduce((s, seg) => s + seg.count * weights[seg.variant], 0);
  return Math.round((score / (total * 3)) * 100);
}

/** Top semicircle (dome up): arc from left (π) to right (2π) over the upper half. */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function segmentsFromSlices(slices: DashboardChartSlice[]): GaugeSegment[] {
  if (slices.length === 2) {
    const [pending, completed] = slices;
    return [
      { label: completed.label, count: completed.count, variant: 'completed' },
      { label: pending.label, count: pending.count, variant: 'pending' },
    ];
  }
  const [early, mid, late] = slices;
  return [
    { label: late?.label ?? 'Completed', count: late?.count ?? 0, variant: 'completed' },
    { label: mid?.label ?? 'In progress', count: mid?.count ?? 0, variant: 'inProgress' },
    { label: early?.label ?? 'Pending', count: early?.count ?? 0, variant: 'pending' },
  ];
}

function strokeColor(variant: GaugeSegment['variant']): string {
  if (variant === 'completed') return GAUGE_COLORS.completed;
  if (variant === 'inProgress') return GAUGE_COLORS.inProgress;
  return GAUGE_COLORS.pendingStroke;
}

function SemiCircleGauge({
  segments,
  patternId,
}: {
  segments: GaugeSegment[];
  patternId: string;
}) {
  const cx = 100;
  const cy = 108;
  const r = 72;
  const strokeWidth = 14;
  const total = segments.reduce((s, x) => s + x.count, 0);
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const arcSpan = endAngle - startAngle;

  if (total === 0) {
    return (
      <svg viewBox="0 0 200 118" className="mx-auto h-[118px] w-full max-w-[220px]" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#cbd5e1" strokeWidth="3" />
          </pattern>
        </defs>
        <path
          d={describeArc(cx, cy, r, startAngle, endAngle)}
          fill="none"
          stroke={`url(#${patternId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  let cursor = startAngle;

  return (
    <svg viewBox="0 0 200 118" className="mx-auto h-[118px] w-full max-w-[220px]" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#cbd5e1" strokeWidth="3" />
        </pattern>
      </defs>
      {segments.map((seg) => {
        const frac = seg.count / total;
        if (frac <= 0) return null;
        const segEnd = cursor + frac * arcSpan;
        const d = describeArc(cx, cy, r, cursor, segEnd);
        cursor = segEnd;
        const stroke =
          seg.variant === 'pending' ? `url(#${patternId})` : strokeColor(seg.variant);
        return (
          <path
            key={seg.label}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}

function LegendDot({ variant }: { variant: GaugeSegment['variant'] }) {
  if (variant === 'pending') {
    return (
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-slate-200"
        style={{
          background:
            'repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 2px, #f8fafc 2px, #f8fafc 4px)',
        }}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: strokeColor(variant) }}
      aria-hidden="true"
    />
  );
}

const cardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition-[box-shadow,border-color] duration-fast ease-standard sm:p-4';

const cardInteractiveClass =
  'hover:border-slate-200 hover:shadow-md focus-visible:outline-none focus-visible:shadow-focus';

export function OrderProgressGaugeCard({
  title,
  slices,
  to,
  isLoading,
  translateLabel,
  openOrdersSubtitle,
  centerPercent,
  subtitlePlacement = 'center',
}: {
  title: string;
  slices: DashboardChartSlice[] | undefined;
  to: string;
  isLoading?: boolean;
  translateLabel: (label: string) => string;
  openOrdersSubtitle: (total: number) => string;
  /** When set, shown in the gauge center instead of pipeline-weighted percent. */
  centerPercent?: number;
  /** `footer` moves the subtitle below the legend (capacity card). */
  subtitlePlacement?: 'center' | 'footer';
}) {
  const segments = slices ? segmentsFromSlices(slices) : [];
  const total = segments.reduce((s, x) => s + x.count, 0);
  const percent = centerPercent ?? pipelinePercent(segments);
  const patternId = `gauge-pending-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const subtitleInFooter = subtitlePlacement === 'footer';

  const body = (
    <>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="relative mt-2">
        {isLoading ? (
          <div className="flex h-[118px] items-center justify-center">
            <Skeleton height={88} width={200} className="rounded-full" />
          </div>
        ) : (
          <SemiCircleGauge segments={segments} patternId={patternId} />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-[42%] flex flex-col items-center">
          {isLoading ? (
            <>
              <Skeleton height={28} width={56} className="mb-1" />
              {!subtitleInFooter && <Skeleton height={14} width={72} />}
            </>
          ) : (
            <>
              <div className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                {percent}%
              </div>
              {!subtitleInFooter && (
                <div className="mt-0.5 text-xs font-medium text-brand-600">
                  {openOrdersSubtitle(total)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {!isLoading && (
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
          {segments.filter((seg) => seg.count > 0).map((seg) => (
            <li key={seg.label} className="flex items-center gap-1.5">
              <LegendDot variant={seg.variant} />
              <span>{translateLabel(seg.label)}</span>
            </li>
          ))}
        </ul>
      )}
      {(subtitleInFooter || isLoading) && (
        <p className="mt-4 min-h-[2rem] text-center text-xs font-medium leading-snug text-brand-600">
          {isLoading ? <Skeleton height={14} width="75%" className="mx-auto" /> : openOrdersSubtitle(total)}
        </p>
      )}
    </>
  );

  return (
    <Link to={to} className={`block ${cardClass} ${cardInteractiveClass}`}>
      {body}
    </Link>
  );
}

export function OrderProgressGaugeCardSkeleton({
  title,
  subtitlePlacement = 'center',
}: {
  title: ReactNode;
  subtitlePlacement?: 'center' | 'footer';
}) {
  const subtitleInFooter = subtitlePlacement === 'footer';
  return (
    <div className={cardClass}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 flex h-[118px] items-center justify-center">
        <Skeleton height={88} width={200} />
      </div>
      <div className="mt-3 flex justify-center gap-4">
        <Skeleton height={12} width={64} />
        <Skeleton height={12} width={64} />
        {!subtitleInFooter && <Skeleton height={12} width={64} />}
      </div>
      {subtitleInFooter && <Skeleton height={14} width="75%" className="mx-auto mt-4" />}
    </div>
  );
}
