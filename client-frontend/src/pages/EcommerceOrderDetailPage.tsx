import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { StatusBadge } from '@wms/components/StatusBadge';

import { ClientOrderTrackingPanel } from '../components/ClientOrderTrackingPanel';
import {
  fetchClientOmsOrder,
  fetchClientOmsTimeline,
} from '../services/clientOmsOrdersService';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function EcommerceOrderDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();

  const orderQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', id],
    queryFn: () => fetchClientOmsOrder(id),
    enabled: !!id,
  });

  const timelineQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', id, 'timeline'],
    queryFn: () => fetchClientOmsTimeline(id),
    enabled: !!id,
  });

  const data = orderQuery.data
    ? {
        ...orderQuery.data,
        timeline: timelineQuery.data ?? orderQuery.data.timeline,
      }
    : undefined;

  const notFound =
    orderQuery.error &&
    isAxiosError(orderQuery.error) &&
    orderQuery.error.response?.status === 404;

  return (
    <main className="main">
      <div className="card">
        <p style={{ marginBottom: '1rem' }}>
          <Link className="muted" to="/ecommerce-orders" style={{ textDecoration: 'none' }}>
            ← Back to e-commerce orders
          </Link>
        </p>

        {notFound ? (
          <p className="banner banner--error" role="alert">
            E-commerce order not found.
          </p>
        ) : orderQuery.error ? (
          <p className="banner banner--error" role="alert">
            Could not load this order. Please try again.
          </p>
        ) : null}

        {orderQuery.isLoading ? (
          <p className="muted">Loading order…</p>
        ) : data ? (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <h1 className="card__title" style={{ margin: 0 }}>
                E-commerce order {data.orderNumber || data.id.slice(0, 8)}
              </h1>
              <StatusBadge status={data.status} />
            </div>

            <dl className="details">
              <div className="details__row">
                <dt>Order #</dt>
                <dd>{data.orderNumber || '—'}</dd>
              </div>
              <div className="details__row">
                <dt>Recipient</dt>
                <dd>{data.recipientName ?? '—'}</dd>
              </div>
              <div className="details__row">
                <dt>Phone</dt>
                <dd>{data.recipientPhone ?? '—'}</dd>
              </div>
              <div className="details__row">
                <dt>Address</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>
                  {data.addressLine1 ?? data.destinationAddress ?? '—'}
                </dd>
              </div>
              {data.city ? (
                <div className="details__row">
                  <dt>City</dt>
                  <dd>{data.city}</dd>
                </div>
              ) : null}
              {data.district ? (
                <div className="details__row">
                  <dt>District</dt>
                  <dd>{data.district}</dd>
                </div>
              ) : null}
              <div className="details__row">
                <dt>Required ship</dt>
                <dd>{formatDate(data.requiredShipDate)}</dd>
              </div>
              {data.carrier ? (
                <div className="details__row">
                  <dt>Carrier</dt>
                  <dd>{data.carrier}</dd>
                </div>
              ) : null}
              {data.trackingNumber ? (
                <div className="details__row">
                  <dt>Tracking</dt>
                  <dd>{data.trackingNumber}</dd>
                </div>
              ) : null}
              {data.storeChannel ? (
                <div className="details__row">
                  <dt>Sales channel</dt>
                  <dd>{data.storeChannel}</dd>
                </div>
              ) : null}
              <div className="details__row">
                <dt>Created</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
              {data.linkedOutboundOrder ? (
                <div className="details__row">
                  <dt>Warehouse order</dt>
                  <dd>
                    <Link to={`/outbound-orders/${data.linkedOutboundOrder.id}`}>
                      {data.linkedOutboundOrder.orderNumber}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {data.notes ? (
                <div className="details__row">
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{data.notes}</dd>
                </div>
              ) : null}
            </dl>

            {(data.paymentMethod || data.subtotal || data.shippingFee) && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem' }}>
                <h2 className="card__title" style={{ fontSize: '1.1rem' }}>
                  Pricing
                </h2>
                <dl className="details">
                  {data.paymentMethod ? (
                    <div className="details__row">
                      <dt>Payment</dt>
                      <dd>{data.paymentMethod}</dd>
                    </div>
                  ) : null}
                  {data.shippingFee ? (
                    <div className="details__row">
                      <dt>Shipping fee</dt>
                      <dd>
                        {data.shippingFee} {data.currency ?? ''}
                      </dd>
                    </div>
                  ) : null}
                  {data.subtotal ? (
                    <div className="details__row">
                      <dt>Subtotal</dt>
                      <dd>
                        {data.subtotal} {data.currency ?? ''}
                      </dd>
                    </div>
                  ) : null}
                  {data.codStatus ? (
                    <div className="details__row">
                      <dt>COD status</dt>
                      <dd>{data.codStatus}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}

            <h2 className="card__title" style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>
              Line items
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Price</th>
                    <th className="num">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="num">{line.lineNumber}</td>
                      <td>{line.product?.sku ?? '—'}</td>
                      <td>{line.product?.name ?? '—'}</td>
                      <td className="num">{line.requestedQuantity}</td>
                      <td className="num">{line.unitPrice ?? '—'}</td>
                      <td className="num">{line.lineTotal ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ClientOrderTrackingPanel order={data} />
          </>
        ) : null}
      </div>
    </main>
  );
}
