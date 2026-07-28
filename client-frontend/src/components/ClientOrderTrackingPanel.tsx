import type { ReactElement } from 'react';

import { WorkflowStatus } from '@ds';

import { isClientArabic } from '../lib/client-ui-language';
import type { ClientOmsOrderDetail } from '../services/clientOmsOrdersService';

const MILESTONES = [
  { key: 'pending_approval', label: 'Pending approval', labelAr: 'بانتظار الموافقة' },
  { key: 'approved', label: 'Approved', labelAr: 'معتمد' },
  { key: 'picking', label: 'Picking', labelAr: 'التقاط' },
  { key: 'packing', label: 'Packing', labelAr: 'تغليف' },
  { key: 'ready_to_ship', label: 'Ready to ship', labelAr: 'جاهز للشحن' },
  { key: 'out_for_delivery', label: 'Out for delivery', labelAr: 'خارج للتسليم' },
  { key: 'delivered', label: 'Delivered', labelAr: 'تم التسليم' },
] as const;

function resolveCurrentKey(status: string): string {
  if (MILESTONES.some((m) => m.key === status)) return status;
  if (status === 'shipped' || status === 'completed') return 'delivered';
  if (status === 'allocated' || status === 'confirmed' || status === 'processing') return 'approved';
  if (status === 'draft') return 'pending_approval';
  return status === 'pending_approval' ? 'pending_approval' : 'pending_approval';
}

function t(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Order tracking': 'تتبع الطلب',
    'This order was cancelled.': 'تم إلغاء هذا الطلب.',
    Rejected: 'مرفوض',
    'Failed delivery': 'فشل التسليم',
    Returned: 'مرتجع',
    'No tracking events yet.': 'لا توجد أحداث تتبع بعد.',
    Timeline: 'الجدول الزمني',
  };
  return ar[label] ?? label;
}

type Props = {
  order: ClientOmsOrderDetail;
};

export function ClientOrderTrackingPanel({ order }: Props): ReactElement {
  const isArabic = isClientArabic();
  const label = (s: string) => t(s, isArabic);
  const isReturned = order.status === 'returned';
  const isRejected = order.status === 'rejected';
  const isFailed = order.status === 'failed_delivery';
  const isCancelled = order.status === 'cancelled';
  const terminalBad = isReturned || isRejected || isFailed;
  const currentKey = resolveCurrentKey(order.status);

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-xs)] sm:p-5">
      <h2 className="text-sm font-semibold text-[var(--text-strong)]">{label('Order tracking')}</h2>

      {isCancelled ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{label('This order was cancelled.')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto pb-1">
          <WorkflowStatus
            steps={MILESTONES.map((s) => ({
              key: s.key,
              label: s.label,
              labelAr: s.labelAr,
            }))}
            current={currentKey}
            error={terminalBad}
            cancelled={isCancelled}
          />
          {terminalBad ? (
            <p
              className="mt-3 inline-flex rounded-full border border-danger-200 bg-danger-50 px-3 py-1 text-xs font-semibold text-danger-700"
              role="status"
            >
              {isRejected
                ? label('Rejected')
                : isFailed
                  ? label('Failed delivery')
                  : label('Returned')}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {label('Timeline')}
        </h3>
        {order.timeline && order.timeline.length > 0 ? (
          <ol className="mt-2 m-0 list-none space-y-0 p-0">
            {order.timeline.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] py-3 last:border-b-0"
              >
                <span className="text-sm font-medium text-[var(--text-strong)]">
                  {ev.eventType.replace(/\./g, ' ')}
                </span>
                <time className="text-xs tabular-nums text-[var(--text-muted)]" dateTime={ev.createdAt}>
                  {new Date(ev.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-muted)]">{label('No tracking events yet.')}</p>
        )}
      </div>
    </section>
  );
}
