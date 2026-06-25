import { Link } from 'react-router-dom';

import { cn, Skeleton } from '@ds';

export type WarehouseMetricFooter =
  | { kind: 'trend'; value: number; caption: string }
  | { kind: 'status'; text: string };

function CardIconBadge({
  iconClass,
  variant,
}: {
  iconClass: string;
  variant: 'primary' | 'default';
}) {
  const isPrimary = variant === 'primary';
  return (
    <span
      className={
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ' +
        (isPrimary
          ? 'bg-white/15 text-white ring-1 ring-white/25'
          : 'border border-slate-200 bg-slate-50 text-brand-700 group-hover:border-brand-200 group-hover:bg-brand-50')
      }
      aria-hidden="true"
    >
      <i className={`${iconClass} text-base`} />
    </span>
  );
}

function CardFooter({
  footer,
  variant,
}: {
  footer: WarehouseMetricFooter;
  variant: 'primary' | 'default';
}) {
  const isPrimary = variant === 'primary';
  const accent = isPrimary ? 'text-lime-200' : 'text-brand-600';
  const badgeBorder = isPrimary ? 'border-white/35' : 'border-slate-200';
  const badgeText = isPrimary ? 'text-white' : 'text-slate-800';
  const badgeIcon = isPrimary ? 'text-lime-200' : 'text-brand-600';

  if (footer.kind === 'status') {
    return <p className={`mt-4 text-xs font-medium ${accent}`}>{footer.text}</p>;
  }

  return (
    <div className={`mt-4 flex flex-wrap items-center gap-2 text-xs ${accent}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-semibold tabular-nums ${badgeBorder} ${badgeText}`}
      >
        {footer.value}
        <i className={`fa-solid fa-caret-up text-[10px] ${badgeIcon}`} aria-hidden="true" />
      </span>
      <span className="font-medium">{footer.caption}</span>
    </div>
  );
}

export function WarehouseOverviewMetricCard({
  title,
  value,
  to,
  variant = 'default',
  icon,
  footer,
}: {
  title: string;
  value: string;
  to: string;
  variant?: 'primary' | 'default';
  icon: string;
  footer?: WarehouseMetricFooter;
}) {
  const isPrimary = variant === 'primary';

  return (
    <Link
      to={to}
      className={
        'group flex min-h-[120px] flex-col rounded-2xl p-5 shadow-sm transition-[box-shadow,transform] duration-fast ease-standard ' +
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ' +
        (isPrimary
          ? 'text-white hover:-translate-y-0.5'
          : 'border border-slate-100 bg-white hover:-translate-y-0.5 hover:border-slate-200')
      }
      style={
        isPrimary
          ? {
              background: 'linear-gradient(135deg, #0a3d28 0%, #146135 45%, #1a7a44 100%)',
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium ${isPrimary ? 'text-white/90' : 'text-slate-600'}`}>{title}</p>
        <CardIconBadge iconClass={icon} variant={variant} />
      </div>
      <p
        className={
          'mt-3 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl ' +
          (isPrimary ? 'text-white' : 'text-slate-900')
        }
      >
        {value}
      </p>
      {footer ? <CardFooter footer={footer} variant={variant} /> : null}
    </Link>
  );
}

export function WarehouseOverviewMetricCardSkeleton({ primary }: { primary?: boolean }) {
  const bone = primary ? 'bg-white/20' : undefined;
  return (
    <div
      className={
        'flex min-h-[120px] flex-col rounded-2xl p-5 ' +
        (primary ? '' : 'border border-slate-100 bg-white shadow-sm')
      }
      style={
        primary
          ? { background: 'linear-gradient(135deg, #0a3d28 0%, #146135 45%, #1a7a44 100%)' }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton height={14} width="60%" className={bone} />
        <Skeleton height={40} width={40} shape="circle" className={bone} />
      </div>
      <Skeleton height={36} width="45%" className={cn('mt-4', bone)} />
    </div>
  );
}
