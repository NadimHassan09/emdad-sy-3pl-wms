import type { ReactElement } from 'react';

import { clientOmsCommercialStatusLabel } from '../lib/client-oms-commercial-status';
import type { ClientOmsOrdersNavCounts } from '../services/clientOmsOrdersService';

type StatusCard = {
  value: string;
  labelAr: string;
  labelEn: string;
  tone: string;
  ring: string;
};

/** Same commercial status cards as admin OMS Orders, matching tone and ring styles. */
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
    labelEn: 'Field Delivery',
    tone: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    ring: 'ring-rose-500',
  },
  {
    value: 'return_pending_receipt',
    labelAr: 'مرتجع بانتظار الاستلام',
    labelEn: 'Return Pending Receipt',
    tone: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-100',
    ring: 'ring-fuchsia-500',
  },
  {
    value: 'returned',
    labelAr: 'مرتجع مستلم',
    labelEn: 'Return Received',
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
  counts?: ClientOmsOrdersNavCounts | null;
  onStatusChange: (status: string) => void;
};

function formatCount(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-US');
}

export function ClientOmsOrdersStatusNav({
  isArabic,
  status,
  counts,
  onStatusChange,
}: Props): ReactElement {
  const selectedStatus = status || '';

  return (
    <section aria-label={isArabic ? 'الحالات العامة' : 'General statuses'} className="my-3">
      <h2 className="mb-2 text-sm font-medium text-text-muted">
        {isArabic ? 'الحالات العامة' : 'General statuses'}
      </h2>
      <div
        role="group"
        aria-label={isArabic ? 'الحالات العامة' : 'General statuses'}
        className="flex snap-x gap-2.5 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-5 2xl:grid-cols-11"
      >
        {STATUS_CARDS.map((card) => {
          const active = selectedStatus === card.value;
          const label = isArabic ? card.labelAr : card.labelEn;
          const fullLabel = card.value
            ? clientOmsCommercialStatusLabel(card.value, isArabic)
            : label;
          const count = card.value === '' ? counts?.total : counts?.byStatus?.[card.value];
          return (
            <button
              key={card.value || 'all'}
              type="button"
              role="button"
              aria-pressed={active}
              title={fullLabel}
              onClick={() => onStatusChange(card.value)}
              className={[
                'flex min-h-16 min-w-36 shrink-0 snap-start flex-col items-start justify-between gap-1 rounded-xl border px-3.5 py-2.5 text-start transition md:min-w-0 cursor-pointer select-none',
                'hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2',
                card.tone,
                active
                  ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${card.ring}`
                  : 'opacity-90 hover:opacity-100',
              ].join(' ')}
            >
              <span className="text-xl font-semibold leading-6 tabular-nums">
                {formatCount(count)}
              </span>
              <span className="text-xs font-medium leading-4 line-clamp-1">{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

