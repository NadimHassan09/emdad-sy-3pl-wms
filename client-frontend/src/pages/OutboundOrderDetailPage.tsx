import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchClientOutboundOrder } from '../services/clientOutboundOrdersService';

export function OutboundOrderDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'outbound-orders', id],
    queryFn: () => fetchClientOutboundOrder(id),
    enabled: !!id,
  });

  const notFound =
    error && isAxiosError(error) && error.response?.status === 404;

  return (
    <main className="main">
      <div className="card">
        <p style={{ marginBottom: '1rem' }}>
          <Link className="muted" to="/outbound-orders" style={{ textDecoration: 'none' }}>
            ← Back to outbound orders
          </Link>
        </p>

        {notFound ? (
          <p className="banner banner--error" role="alert">
            Outbound order not found.
          </p>
        ) : error ? (
          <p className="banner banner--error" role="alert">
            Could not load this order. Please try again.
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted">Loading order…</p>
        ) : data ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
              <h1 className="card__title" style={{ margin: 0 }}>
                Outbound order {data.orderNumber || data.id.slice(0, 8)}
              </h1>
              <span className={orderStatusBadge(data.status)}>{humanizeStatus(data.status)}</span>
            </div>

            <dl className="details">
              <div className="details__row">
                <dt>Order #</dt>
                <dd>{data.orderNumber || '—'}</dd>
              </div>
              <div className="details__row">
                <dt>Client</dt>
                <dd>{data.company?.name ?? '—'}</dd>
              </div>
              <div className="details__row">
                <dt>Required ship</dt>
                <dd>{formatDate(data.requiredShipDate)}</dd>
              </div>
              <div className="details__row">
                <dt>Destination</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{data.destinationAddress}</dd>
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
              <div className="details__row">
                <dt>Created</dt>
                <dd>{formatDateTime(data.createdAt)}</dd>
              </div>
              {data.clientReference ? (
                <div className="details__row">
                  <dt>Your reference</dt>
                  <dd>{data.clientReference}</dd>
                </div>
              ) : null}
              {data.confirmedAt ? (
                <div className="details__row">
                  <dt>Confirmed</dt>
                  <dd>{formatDateTime(data.confirmedAt)}</dd>
                </div>
              ) : null}
              {data.shippedAt ? (
                <div className="details__row">
                  <dt>Shipped</dt>
                  <dd>{formatDateTime(data.shippedAt)}</dd>
                </div>
              ) : null}
              {data.notes ? (
                <div className="details__row">
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{data.notes}</dd>
                </div>
              ) : null}
            </dl>

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
                    <th className="num">Requested</th>
                    <th className="num">Picked</th>
                    <th>Line status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="num">{line.lineNumber}</td>
                      <td>{line.product.sku}</td>
                      <td>{line.product.name}</td>
                      <td className="num">{fmtQty(line.requestedQuantity)}</td>
                      <td className="num">{fmtQty(line.pickedQuantity)}</td>
                      <td>{humanizeStatus(line.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function fmtQty(s: string): string {
  const n = Number(s);
  if (Number.isFinite(n)) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return s;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function orderStatusBadge(status: string): string {
  if (status === 'draft') return 'badge badge-draft';
  if (status === 'cancelled') return 'badge badge-cancelled';
  if (status === 'shipped') return 'badge badge-shipped';
  if (status === 'confirmed' || status === 'ready_to_ship') return 'badge badge-confirmed';
  return 'badge badge-progress';
}
