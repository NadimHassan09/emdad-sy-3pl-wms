import type { ReactElement } from 'react';

import type { OmsOrderDetail, OmsOrderEvent } from '../../api/oms';

type MilestoneKey =
  | 'waiting_for_confirmation'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered';

type MilestoneDef = {
  key: MilestoneKey;
  label: string;
  icon: string;
};

const MILESTONES: MilestoneDef[] = [
  { key: 'waiting_for_confirmation', label: 'Waiting for confirmation', icon: 'fa-hourglass-half' },
  { key: 'confirmed', label: 'Confirmed', icon: 'fa-square-check' },
  { key: 'processing', label: 'Processing', icon: 'fa-box-open' },
  { key: 'ready_to_ship', label: 'Ready to ship', icon: 'fa-paper-plane' },
  { key: 'shipped', label: 'Shipped', icon: 'fa-truck' },
  { key: 'delivered', label: 'Delivered', icon: 'fa-box' },
];

function resolveCurrentKey(status: string): MilestoneKey {
  switch (status) {
    case 'waiting_for_confirmation':
    case 'draft':
      return 'waiting_for_confirmation';
    case 'confirmed_waiting_for_admin_approval':
    case 'pending_approval':
    case 'confirmed':
      return 'confirmed';
    case 'processing':
    case 'pending':
    case 'approved':
    case 'allocated':
    case 'picking':
    case 'packing':
      return 'processing';
    case 'ready_to_ship':
      return 'ready_to_ship';
    case 'shipped':
    case 'out_for_delivery':
      return 'shipped';
    case 'delivered':
    case 'completed':
    case 'returned':
      return 'delivered';
    default:
      return 'waiting_for_confirmation';
  }
}

function formatStepTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function firstEventAt(timeline: OmsOrderEvent[] | undefined, types: string[]): string | null {
  if (!timeline?.length) return null;
  const set = new Set(types);
  const hit = timeline.find((e) => set.has(e.eventType));
  return hit?.createdAt ?? null;
}

function stepTimestamp(key: MilestoneKey, order: OmsOrderDetail): string | null {
  const timeline = order.timeline;
  switch (key) {
    case 'waiting_for_confirmation':
      return (
        order.submittedAt ??
        firstEventAt(timeline, [
          'order.waiting_for_confirmation',
          'oms.created',
          'order.created',
        ]) ??
        order.createdAt
      );
    case 'confirmed':
      return (
        order.confirmedAt ??
        firstEventAt(timeline, ['oms.confirmed', 'order.confirmed_waiting_for_admin_approval'])
      );
    case 'processing':
      return (
        order.approvedAt ??
        firstEventAt(timeline, ['oms.approved', 'oms.processing', 'outbound.created'])
      );
    case 'ready_to_ship':
      return firstEventAt(timeline, ['oms.ready_to_ship', 'order.ready_to_ship']);
    case 'shipped':
      return (
        order.outForDeliveryAt ??
        firstEventAt(timeline, ['oms.shipped', 'oms.out_for_delivery', 'order.shipped'])
      );
    case 'delivered':
      return order.deliveredAt ?? firstEventAt(timeline, ['oms.delivered', 'order.delivered']);
    default:
      return null;
  }
}

function connectorClass(solid: boolean): string {
  return solid
    ? 'border-t-2 border-solid border-success-600'
    : 'border-t-2 border-dashed border-slate-300';
}

type Props = {
  order: OmsOrderDetail;
};

export function OmsOrderTrackingPanel({ order }: Props): ReactElement {
  const isReturned = order.status === 'returned';
  const isRejected = order.status === 'rejected';
  const isFailed = order.status === 'failed_delivery';
  const isCancelled = order.status === 'cancelled';
  const terminalBad = isReturned || isRejected || isFailed;
  const currentKey = resolveCurrentKey(order.status);
  const currentIdx = Math.max(
    0,
    MILESTONES.findIndex((m) => m.key === currentKey),
  );
  const isFullyDelivered = order.status === 'delivered' || order.status === 'completed';

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border-subtle bg-surface-card-muted px-4 py-3 sm:px-5">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
          aria-hidden="true"
        >
          <i className="fa-solid fa-truck text-sm" />
        </span>
        <h2 className="text-sm font-semibold text-text-strong">Order tracking</h2>
      </div>

      <div className="p-4 sm:p-5">
        {isCancelled ? (
          <p className="text-sm text-text-muted">This order was cancelled.</p>
        ) : (
          <div className="overflow-x-auto pb-1">
            <ol
              className="flex min-w-[720px] items-start"
              aria-label={`Order tracking: step ${currentIdx + 1} of ${MILESTONES.length}`}
            >
              {MILESTONES.map((step, idx) => {
                const isCurrent = idx === currentIdx && !isFullyDelivered;
                const isDone = idx < currentIdx || (isFullyDelivered && idx <= currentIdx);
                const filled = isDone || isCurrent;
                const emphasizeLabel = filled;
                const rightSolid = idx < currentIdx || isCurrent || isFullyDelivered;
                const leftSolid = idx <= currentIdx || isFullyDelivered;
                const ts = formatStepTime(stepTimestamp(step.key, order));
                const circleTone =
                  filled && terminalBad && isCurrent
                    ? 'bg-danger-600 text-white'
                    : filled
                      ? 'bg-success-600 text-white'
                      : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200';
                const labelTone =
                  emphasizeLabel && terminalBad && isCurrent
                    ? 'font-semibold text-danger-700'
                    : emphasizeLabel
                      ? 'font-semibold text-success-700'
                      : 'font-medium text-slate-500';

                return (
                  <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                    <div className="flex w-full items-center">
                      <div
                        className={`h-0 flex-1 ${idx === 0 ? 'border-transparent' : connectorClass(leftSolid)}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${circleTone}`}
                      >
                        <i className={`fa-solid ${step.icon} text-sm`} aria-hidden="true" />
                        {step.key === 'delivered' ? (
                          <i
                            className={`fa-solid fa-check absolute bottom-1 end-1 text-[9px] ${
                              filled ? 'text-white' : 'text-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      <div
                        className={`h-0 flex-1 ${
                          idx === MILESTONES.length - 1
                            ? 'border-transparent'
                            : connectorClass(rightSolid)
                        }`}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-3 max-w-[9rem] px-1 text-center">
                      <div className={`text-xs leading-snug ${labelTone}`}>{step.label}</div>
                      <div className="mt-1 text-[11px] tabular-nums text-slate-400">{ts}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {terminalBad ? (
              <p
                className="mt-4 inline-flex rounded-full border border-danger-200 bg-danger-50 px-3 py-1 text-xs font-semibold text-danger-700"
                role="status"
              >
                {isRejected ? 'Rejected' : isFailed ? 'Failed delivery' : 'Returned'}
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-5 border-t border-border-subtle pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
            Timeline
          </h3>
          {order.timeline && order.timeline.length > 0 ? (
            <ol className="mt-2 m-0 list-none space-y-0 p-0">
              {order.timeline.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle py-3 last:border-b-0"
                >
                  <span className="text-sm font-medium text-text-strong">
                    {ev.eventType.replace(/\./g, ' ')}
                    {ev.creator?.fullName ? (
                      <span className="ms-2 text-xs font-normal text-text-muted">
                        · {ev.creator.fullName}
                      </span>
                    ) : null}
                  </span>
                  <time className="text-xs tabular-nums text-text-muted" dateTime={ev.createdAt}>
                    {new Date(ev.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-text-muted">No tracking events yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
