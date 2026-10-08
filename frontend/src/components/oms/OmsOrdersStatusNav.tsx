import type { ReactElement } from 'react';

import type { OmsOrdersNavCounts } from '../../api/oms';
import { omsCommercialStatusLabel } from '../../lib/oms-commercial-status';
import {
  OMS_OPERATIONAL_STAGES,
  omsOperationalStageLabel,
  type OmsOperationalStage,
} from '../../lib/oms-operational-stage';

type StatusCard = {
  value: string;
  labelAr: string;
  labelEn: string;
  /** Soft card classes. Same statuses as before; colors follow the new status-card tones. */
  tone: string;
  ring: string;
};

/** Existing commercial statuses. Values and labels are unchanged. */
const STATUS_CARDS: StatusCard[] = [
  {
    value: '',
    labelAr: 'جميع الحالات',
    labelEn: 'All statuses',
    tone: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
    ring: 'ring-slate-400',
  },
  {
    value: 'waiting_for_confirmation',
    labelAr: 'بانتظار التأكيد',
    labelEn: 'Waiting for confirmation',
    tone: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    ring: 'ring-amber-500',
  },
  {
    value: 'confirmed_waiting_for_admin_approval',
    labelAr: 'بانتظار الإدارة',
    labelEn: 'Waiting for admin',
    tone: 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100',
    ring: 'ring-orange-500',
  },
  {
    value: 'processing',
    labelAr: 'قيد المعالجة',
    labelEn: 'Processing',
    tone: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100',
    ring: 'ring-blue-500',
  },
  {
    value: 'ready_to_ship',
    labelAr: 'جاهز للشحن',
    labelEn: 'Ready to ship',
    tone: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    ring: 'ring-rose-500',
  },
  {
    value: 'shipped',
    labelAr: 'خارج للتسليم',
    labelEn: 'Out for delivery',
    tone: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    ring: 'ring-amber-500',
  },
  {
    value: 'delivered',
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    ring: 'ring-emerald-500',
  },
  {
    value: 'failed_delivery',
    labelAr: 'فشل التسليم',
    labelEn: 'Failed delivery',
    tone: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    ring: 'ring-rose-500',
  },
  {
    value: 'returned',
    labelAr: 'مرتجع',
    labelEn: 'Returned',
    tone: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100',
    ring: 'ring-violet-500',
  },
  {
    value: 'cancelled',
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    tone: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
    ring: 'ring-slate-400',
  },
];

type Props = {
  isArabic: boolean;
  status: string;
  operationalStage: string;
  counts?: OmsOrdersNavCounts | null;
  onStatusChange: (status: string) => void;
  onStageChange: (stage: string) => void;
};

function formatCount(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US');
}

export function OmsOrdersStatusNav({
  isArabic,
  status,
  operationalStage,
  counts,
  onStatusChange,
  onStageChange,
}: Props): ReactElement {
  const selectedStatus = status || '';
  const showStages = selectedStatus === 'processing';
  const selectedStage = showStages ? operationalStage : '';

  return (
    <div className="mt-3 flex flex-col gap-3">
      <section aria-label={isArabic ? 'الحالات العامة' : 'General statuses'}>
        <h2 className="mb-2 text-sm font-medium text-text-muted">
          {isArabic ? 'الحالات العامة' : 'General statuses'}
        </h2>
        <div
          role="group"
          aria-label={isArabic ? 'الحالات العامة' : 'General statuses'}
          className="flex snap-x gap-2.5 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5 2xl:grid-cols-10"
        >
          {STATUS_CARDS.map((card) => {
            const active = selectedStatus === card.value;
            const label = isArabic ? card.labelAr : card.labelEn;
            const fullLabel = card.value
              ? omsCommercialStatusLabel(card.value, isArabic)
              : label;
            const count =
              card.value === '' ? counts?.total : counts?.byStatus?.[card.value];
            return (
              <button
                key={card.value || 'all'}
                type="button"
                aria-pressed={active}
                title={fullLabel}
                onClick={() => onStatusChange(card.value)}
                className={[
                  'flex min-h-16 min-w-36 shrink-0 snap-start flex-col items-start justify-between gap-1 rounded-xl border px-3.5 py-2.5 text-start transition md:min-w-0',
                  'hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2',
                  card.tone,
                  active ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${card.ring}` : '',
                ].join(' ')}
              >
                <span className="text-xl font-semibold leading-6 tabular-nums">{formatCount(count)}</span>
                <span className="text-xs font-medium leading-4">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {showStages ? (
        <section aria-label={isArabic ? 'المراحل التشغيلية' : 'Operational stages'}>
          <h2 className="mb-2 text-sm font-medium text-text-muted">
            {isArabic ? 'المراحل التشغيلية' : 'Operational stages'}
          </h2>
          <div className="flex flex-wrap items-center gap-2" role="group">
            <StageChip
              label={isArabic ? 'الكل' : 'All'}
              count={counts?.byStatus?.processing}
              active={!selectedStage}
              onClick={() => onStageChange('')}
            />
            {OMS_OPERATIONAL_STAGES.map((stage) => (
              <StageChip
                key={stage}
                label={omsOperationalStageLabel(stage, isArabic)}
                count={counts?.stages?.[stage as OmsOperationalStage]}
                active={selectedStage === stage}
                onClick={() => onStageChange(stage)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StageChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
      ].join(' ')}
    >
      {label}
      <span
        className={[
          'rounded-full px-2 text-xs tabular-nums',
          active ? 'bg-white/20' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
        ].join(' ')}
      >
        {formatCount(count)}
      </span>
    </button>
  );
}
