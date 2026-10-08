import { type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchClientOmsShippingMovement,
  type ClientOmsOrderDetail,
  type ClientShipmentMovementEvent,
} from '../services/clientOmsOrdersService';
import { Card } from '@ds';
import { isClientArabic } from '../lib/client-ui-language';

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

type Props = {
  order: ClientOmsOrderDetail;
};

/**
 * Full carrier shipment movement history for clients.
 * Does NOT show shipping company / provider name.
 */
export function ClientShipmentMovementPanel({ order }: Props): ReactElement {
  const isArabic = isClientArabic();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['client-oms-shipping-movement', order.id],
    queryFn: () => fetchClientOmsShippingMovement(order.id),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const events = data?.events || [];
  const errorMessage = data?.error;
  const infoMessage = data?.message;
  const statusLabel = data?.statusLabel;

  return (
    <Card padding="none">
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              aria-hidden="true"
            >
              <i className="fa-solid fa-route text-sm" />
            </span>
            <Card.Title>{isArabic ? 'حركة الشحنة' : 'Shipment movement'}</Card.Title>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-xs font-medium text-sky-700 hover:underline disabled:opacity-50"
            title={isArabic ? 'تحديث حركة الشحنة' : 'Refresh shipment movement'}
          >
            <i className={`fa-solid fa-rotate ${isFetching ? 'fa-spin' : ''} me-1`} />
            {isArabic ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </Card.Header>

      <Card.Body className="px-4 py-4 sm:px-5 space-y-3">
        {statusLabel ? (
          <p className="text-sm font-medium text-[var(--text-strong)]">{statusLabel}</p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">
            {isArabic ? 'جاري تحميل حركة الشحنة…' : 'Loading shipment movement…'}
          </p>
        ) : null}

        {isError || errorMessage ? (
          <p className="text-sm text-rose-700">
            {errorMessage ||
              (isArabic
                ? 'تعذر جلب حركة الشحنة حالياً.'
                : 'Unable to fetch shipment movement at this moment.')}
          </p>
        ) : null}

        {!isLoading && !errorMessage && events.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {infoMessage ||
              (isArabic ? 'لا توجد بيانات لحركة الشحنة حالياً.' : 'No shipment movement data available currently.')}
          </p>
        ) : null}

        {events.length > 0 ? (
          <ol className="relative space-y-3 border-s border-slate-200 ps-4 dark:border-slate-700">
            {events.map((event: ClientShipmentMovementEvent, idx: number) => {
              const tones = getCardClasses(event.color);
              const { date, time } = formatEventDateTime(event.timestamp, isArabic);
              return (
                <li key={`${event.timestamp}-${idx}`} className="relative">
                  <span
                    className={`absolute -start-[1.3rem] top-2 h-2.5 w-2.5 rounded-full ring-4 ${tones.dot}`}
                    aria-hidden
                  />
                  <div className={`rounded-lg border px-3 py-2 ${tones.card}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{event.title}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tones.badge}`}>
                        {date} · {time}
                      </span>
                    </div>
                    {event.location ? (
                      <p className="mt-1 text-xs opacity-80">{event.location}</p>
                    ) : null}
                    {event.notes ? (
                      <p className="mt-1 text-xs opacity-80 whitespace-pre-wrap">{event.notes}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </Card.Body>
    </Card>
  );
}
