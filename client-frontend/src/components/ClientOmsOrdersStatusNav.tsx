import type { ReactElement } from 'react';

import { clientOmsCommercialStatusLabel } from '../lib/client-oms-commercial-status';
import type { ClientOmsOrdersNavCounts } from '../services/clientOmsOrdersService';

type StatusCard = {
  value: string;
  labelAr: string;
  labelEn: string;
  background: string;
  color: string;
};

/** Same commercial status cards as admin OMS Orders, without warehouse stage chips. */
const STATUS_CARDS: StatusCard[] = [
  { value: '', labelAr: 'جميع الحالات', labelEn: 'All statuses', background: '', color: '' },
  {
    value: 'waiting_for_confirmation',
    labelAr: 'بانتظار التأكيد',
    labelEn: 'Waiting for confirmation',
    background: '#d97706',
    color: '#ffffff',
  },
  {
    value: 'confirmed_waiting_for_admin_approval',
    labelAr: 'بانتظار الإدارة',
    labelEn: 'Waiting for admin',
    background: '#f5a524',
    color: '#ffffff',
  },
  {
    value: 'processing',
    labelAr: 'قيد المعالجة',
    labelEn: 'Processing',
    background: '#3b82f6',
    color: '#ffffff',
  },
  {
    value: 'ready_to_ship',
    labelAr: 'جاهز للشحن',
    labelEn: 'Ready to ship',
    background: '#ef6b5c',
    color: '#ffffff',
  },
  {
    value: 'shipped',
    labelAr: 'خارج للتسليم',
    labelEn: 'Out for delivery',
    background: '#f0a03a',
    color: '#ffffff',
  },
  {
    value: 'delivered',
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    background: '#2fbe6a',
    color: '#ffffff',
  },
  {
    value: 'failed_delivery',
    labelAr: 'فشل التسليم',
    labelEn: 'Failed delivery',
    background: '#e11d48',
    color: '#ffffff',
  },
  {
    value: 'returned',
    labelAr: 'مرتجع',
    labelEn: 'Returned',
    background: '#7c5cff',
    color: '#ffffff',
  },
  {
    value: 'cancelled',
    labelAr: 'ملغي',
    labelEn: 'Cancelled',
    background: '#f07178',
    color: '#ffffff',
  },
];

type Props = {
  isArabic: boolean;
  status: string;
  counts?: ClientOmsOrdersNavCounts | null;
  onStatusChange: (status: string) => void;
};

function formatCount(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '\u00a0';
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
    <section aria-label={isArabic ? 'الحالات العامة' : 'General statuses'} className="mt-3">
      <h2 className="mb-2 text-sm font-semibold text-text-muted">
        {isArabic ? 'الحالات العامة' : 'General statuses'}
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {STATUS_CARDS.map((card) => {
          const active = selectedStatus === card.value;
          const label = isArabic ? card.labelAr : card.labelEn;
          const fullLabel = card.value
            ? clientOmsCommercialStatusLabel(card.value, isArabic)
            : label;
          const count = card.value === '' ? counts?.total : counts?.byStatus?.[card.value];
          const neutral = card.value === '';
          return (
            <button
              key={card.value || 'all'}
              type="button"
              aria-pressed={active}
              title={fullLabel}
              onClick={() => onStatusChange(card.value)}
              className={[
                'flex min-h-[92px] flex-col items-center justify-center rounded-2xl px-2.5 py-3 text-center shadow-sm transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
                neutral
                  ? 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                  : '',
                active
                  ? 'shadow-[0_0_0_3px_rgba(15,23,42,0.88)] dark:shadow-[0_0_0_3px_rgba(255,255,255,0.92)]'
                  : 'hover:brightness-[0.97]',
              ].join(' ')}
              style={
                neutral
                  ? undefined
                  : { backgroundColor: card.background, color: card.color }
              }
            >
              <span className="text-[1.65rem] font-bold leading-none tabular-nums">
                {formatCount(count)}
              </span>
              <span className="mt-1.5 text-[13px] font-semibold leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
