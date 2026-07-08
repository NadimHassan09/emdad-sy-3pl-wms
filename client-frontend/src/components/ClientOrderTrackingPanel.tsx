import type { ReactElement } from 'react';

import type { ClientOmsOrderDetail } from '../services/clientOmsOrdersService';

const MILESTONES = [
  { key: 'created', label: 'Order placed' },
  { key: 'allocated', label: 'Allocated' },
  { key: 'picking', label: 'Picking' },
  { key: 'packing', label: 'Packing' },
  { key: 'ready_to_ship', label: 'Ready to ship' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
] as const;

function milestoneIndex(status: string): number {
  const idx = MILESTONES.findIndex((m) => m.key === status);
  if (idx >= 0) return idx;
  if (status === 'shipped') return MILESTONES.findIndex((m) => m.key === 'delivered');
  if (status === 'returned') return MILESTONES.length;
  if (status === 'confirmed' || status === 'pending_approval' || status === 'draft') return 0;
  return 0;
}

type Props = {
  order: ClientOmsOrderDetail;
};

export function ClientOrderTrackingPanel({ order }: Props): ReactElement {
  const current = milestoneIndex(order.status);
  const isReturned = order.status === 'returned';
  const isCancelled = order.status === 'cancelled';

  return (
    <section className="card" style={{ marginTop: '1.5rem' }}>
      <h2 className="card__title" style={{ fontSize: '1.1rem' }}>Order tracking</h2>

      {!isCancelled ? (
        <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {MILESTONES.map((step, i) => {
            const done = i <= current && !isReturned;
            const active = i === current && !isReturned;
            return (
              <li
                key={step.key}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.85rem',
                  background: done ? '#ecfdf5' : '#f1f5f9',
                  color: done ? '#065f46' : '#64748b',
                  border: active ? '1px solid #10b981' : '1px solid transparent',
                }}
              >
                {step.label}
              </li>
            );
          })}
          {isReturned ? (
            <li
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.85rem',
                background: '#fef2f2',
                color: '#991b1b',
              }}
            >
              Returned
            </li>
          ) : null}
        </ol>
      ) : (
        <p className="muted">This order was cancelled.</p>
      )}

      {order.timeline && order.timeline.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {order.timeline.map((ev) => (
            <li
              key={ev.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <span>{ev.eventType.replace(/\./g, ' ')}</span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No tracking events yet.</p>
      )}
    </section>
  );
}
