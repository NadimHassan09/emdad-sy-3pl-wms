import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

import { OmsApi, type OmsOrderDetail, type OmsShipmentMovementEvent } from '../../api/oms';
import { useToast } from '../ToastProvider';
import { useWmsTranslation } from '../../lib/ui-i18n';

type Props = {
  order: OmsOrderDetail;
};

function formatEventDateTime(isoString: string, isArabic: boolean): { date: string; time: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: '—', time: '—' };

    const date = d.toLocaleDateString(isArabic ? 'ar-SY' : 'en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const time = d.toLocaleTimeString(isArabic ? 'ar-SY' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return { date, time };
  } catch {
    return { date: '—', time: '—' };
  }
}

function getCardClasses(color?: string): {
  card: string;
  badge: string;
  dot: string;
} {
  switch (color) {
    case 'success':
      return {
        card: 'bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
        dot: 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900',
      };
    case 'info':
      return {
        card: 'bg-blue-50/90 border-blue-200 text-blue-950 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
        dot: 'bg-blue-500 ring-blue-200 dark:ring-blue-900',
      };
    case 'error':
      return {
        card: 'bg-rose-50/90 border-rose-200 text-rose-950 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-100',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
        dot: 'bg-rose-500 ring-rose-200 dark:ring-rose-900',
      };
    case 'warning':
      return {
        card: 'bg-amber-50/90 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
        dot: 'bg-amber-500 ring-amber-200 dark:ring-amber-900',
      };
    default:
      return {
        card: 'bg-slate-50/90 border-slate-200 text-slate-900 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-100',
        badge: 'bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        dot: 'bg-slate-400 ring-slate-200 dark:ring-slate-700',
      };
  }
}

export function OmsShipmentMovementPanel({ order }: Props): ReactElement {
  const { isArabic } = useWmsTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['oms-shipping-movement', order.id],
    queryFn: () => OmsApi.getShippingMovement(order.id),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const awb = data?.awb || order.trackingNumber || null;
  const carrierName = data?.providerName || order.carrier || null;
  const events = data?.events || [];
  const errorMessage = data?.error;
  const infoMessage = data?.message;

  const copyAwb = () => {
    if (!awb) return;
    navigator.clipboard.writeText(awb);
    setCopied(true);
    toast.success(isArabic ? 'تم نسخ رقم الشحنة' : 'Tracking number copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      aria-label={isArabic ? 'حركة الشحنة' : 'Shipment Movement'}
      className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-sm"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-card-muted px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:text-brand-400 dark:ring-brand-900"
            aria-hidden="true"
          >
            <i className="fa-solid fa-route text-sm" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-strong">
                {isArabic ? 'حركة الشحنة' : 'Shipment Movement'}
              </h2>
              {carrierName && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-text-muted dark:bg-surface-panel">
                  {carrierName}
                </span>
              )}
            </div>
            {awb ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                <span>{isArabic ? 'رقم التتبع:' : 'AWB:'}</span>
                <span className="font-mono font-medium text-text-strong select-all">{awb}</span>
                <button
                  type="button"
                  onClick={copyAwb}
                  title={isArabic ? 'نسخ رقم التتبع' : 'Copy tracking number'}
                  className="inline-flex items-center text-text-muted hover:text-text-strong transition-colors"
                >
                  <i className={`fa-solid ${copied ? 'fa-check text-success-600' : 'fa-copy'} text-[11px]`} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-text-subtle transition-all hover:bg-surface-hover hover:text-text-strong disabled:opacity-50"
            title={isArabic ? 'تحديث حركة الشحنة' : 'Refresh shipment movement'}
          >
            <i className={`fa-solid fa-arrows-rotate text-[11px] ${isFetching ? 'fa-spin' : ''}`} aria-hidden="true" />
            <span>{isArabic ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-4 rounded-lg border border-border-subtle/60 p-4"
              >
                <div className="w-28 space-y-1.5">
                  <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        ) : isError || errorMessage ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-circle-exclamation text-base text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {isArabic
                    ? 'تعذر الحصول على حركة الشحنة من شركة الشحن حالياً.'
                    : 'Unable to fetch shipment movement from the shipping carrier at this moment.'}
                </p>
                {errorMessage && (
                  <p className="mt-1 text-xs opacity-80">{errorMessage}</p>
                )}
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 underline hover:text-amber-950 dark:text-amber-300"
                >
                  <i className="fa-solid fa-rotate-right text-[10px]" />
                  <span>{isArabic ? 'إعادة المحاولة' : 'Try again'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-surface-panel dark:text-slate-500">
              <i className="fa-solid fa-box-archive text-lg" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-text-strong">
              {infoMessage || (isArabic ? 'لا توجد بيانات لحركة الشحنة حالياً.' : 'No shipment movement data available currently.')}
            </p>
            <p className="mt-1 max-w-sm text-xs text-text-muted">
              {isArabic
                ? 'يتم عرض حركة الشحنة تلقائياً بمجرد استلام وتحديث أحداث التتبع من شركة الشحن.'
                : 'Shipment movements will be shown here as soon as tracking updates are received from the carrier.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event: OmsShipmentMovementEvent, idx: number) => {
              const { date, time } = formatEventDateTime(event.timestamp, isArabic);
              const styling = getCardClasses(event.color);

              return (
                <div
                  key={`${event.timestamp}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5"
                >
                  {/* Timestamp side */}
                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-2 sm:gap-0.5 sm:w-28 shrink-0 text-xs tabular-nums text-text-muted">
                    <span className="font-semibold text-text-strong">{date}</span>
                    <span className="text-[11px] opacity-80">{time}</span>
                  </div>

                  {/* Movement card */}
                  <div
                    className={`flex-1 rounded-xl border p-3.5 sm:p-4 transition-all shadow-xs ${styling.card}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold leading-snug tracking-tight">
                          {event.title}
                        </p>
                        {event.notes && (
                          <p className="text-xs opacity-85 leading-relaxed">
                            {event.notes}
                          </p>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1.5 pt-1 text-xs opacity-90">
                            <i className="fa-solid fa-location-dot text-[11px] text-rose-500 dark:text-rose-400 shrink-0" aria-hidden="true" />
                            <span className="font-medium">{event.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Small status tag for prominent steps if applicable */}
                      {idx === 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-strong shadow-xs dark:bg-surface-panel/80">
                          <span className={`h-1.5 w-1.5 rounded-full ${styling.dot}`} />
                          {isArabic ? 'الأحدث' : 'Latest'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
