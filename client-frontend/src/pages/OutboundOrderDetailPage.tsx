import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Alert, Card, Skeleton, StatusBadge } from '@ds';

import { fetchClientOutboundOrder } from '../services/clientOutboundOrdersService';
import { fetchClientOmsOrder } from '../services/clientOmsOrdersService';
import { ClientOrderTrackingPanel } from '../components/ClientOrderTrackingPanel';

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

function DetailRow({
  label,
  value,
  className,
  preWrap,
  strong,
}: {
  label: string;
  value?: string | null;
  className?: string;
  preWrap?: boolean;
  strong?: boolean;
}): ReactElement {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-text-strong ${preWrap ? 'whitespace-pre-wrap' : ''} ${
          strong ? 'font-semibold' : ''
        }`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function OutboundOrderDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'outbound-orders', id],
    queryFn: () => fetchClientOutboundOrder(id),
    enabled: !!id,
  });

  const omsQuery = useQuery({
    queryKey: ['client', 'outbound-orders', id, 'oms'],
    queryFn: () => fetchClientOmsOrder(id),
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/outbound-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to outbound orders
      </Link>

      {notFound ? (
        <Alert variant="error" title="Outbound order not found." />
      ) : error ? (
        <Alert variant="error" title="Could not load this order. Please try again." />
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton height={28} width="40%" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton height={180} />
              <Skeleton height={220} />
            </div>
            <div className="space-y-4">
              <Skeleton height={160} />
              <Skeleton height={140} />
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-text-strong font-mono">
              {data.orderNumber || data.id.slice(0, 8)}
            </h1>
            <StatusBadge status={data.status} />
          </div>

          {data.status === 'pending_approval' ? (
            <Alert
              variant="warning"
              title="This order is waiting for warehouse approval. Processing will begin after approval."
            />
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <Card padding="none">
                <Card.Header>
                  <Card.Title>Shipment details</Card.Title>
                </Card.Header>
                <Card.Body>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <DetailRow label="Order #" value={data.orderNumber} />
                    <DetailRow label="Client" value={data.company?.name} />
                    <DetailRow label="Required ship" value={formatDate(data.requiredShipDate)} />
                    <DetailRow
                      label="Destination"
                      value={data.destinationAddress}
                      className="sm:col-span-2"
                      preWrap
                    />
                    {data.carrier ? <DetailRow label="Carrier" value={data.carrier} /> : null}
                    {data.trackingNumber ? (
                      <DetailRow label="Tracking" value={data.trackingNumber} />
                    ) : null}
                    <DetailRow label="Created" value={formatDateTime(data.createdAt)} />
                    {data.clientReference ? (
                      <DetailRow label="Your reference" value={data.clientReference} />
                    ) : null}
                    {data.confirmedAt ? (
                      <DetailRow label="Confirmed" value={formatDateTime(data.confirmedAt)} />
                    ) : null}
                    {data.shippedAt ? (
                      <DetailRow label="Shipped" value={formatDateTime(data.shippedAt)} />
                    ) : null}
                  </dl>
                  {data.notes ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-text-body">{data.notes}</p>
                  ) : null}
                </Card.Body>
              </Card>

              <Card padding="none" className="overflow-hidden">
                <Card.Header>
                  <Card.Title>Line items</Card.Title>
                  <span className="text-xs font-medium text-text-muted">
                    {data.lines.length} {data.lines.length === 1 ? 'item' : 'items'}
                  </span>
                </Card.Header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                      <tr>
                        <th className="px-4 py-2.5 text-left">#</th>
                        <th className="px-4 py-2.5 text-left">SKU</th>
                        <th className="px-4 py-2.5 text-left">Product</th>
                        <th className="px-4 py-2.5 text-right">Requested</th>
                        <th className="px-4 py-2.5 text-right">Picked</th>
                        <th className="px-4 py-2.5 text-left">Line status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2.5 text-text-muted">{line.lineNumber}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                            {line.product.sku}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-text-strong">
                            {line.product.name}
                          </td>
                          <td className="px-4 py-2.5 text-right text-text-body">
                            {fmtQty(line.requestedQuantity)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                            {fmtQty(line.pickedQuantity)}
                          </td>
                          <td className="px-4 py-2.5 text-text-body">
                            {humanizeStatus(line.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {omsQuery.data ? (
              <div className="space-y-5">
                <Card padding="none">
                  <Card.Header>
                    <Card.Title>Customer</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <dl className="space-y-3">
                      <DetailRow label="Name" value={omsQuery.data.recipientName} />
                      <DetailRow label="Phone" value={omsQuery.data.recipientPhone} />
                      <DetailRow label="City" value={omsQuery.data.city} />
                    </dl>
                  </Card.Body>
                </Card>

                {omsQuery.data.paymentMethod || omsQuery.data.codAmount ? (
                  <Card padding="none">
                    <Card.Header>
                      <Card.Title>Financial</Card.Title>
                    </Card.Header>
                    <Card.Body>
                      <dl className="space-y-3">
                        <DetailRow label="Payment" value={omsQuery.data.paymentMethod} />
                        {omsQuery.data.codAmount ? (
                          <DetailRow
                            label="COD amount"
                            value={`${omsQuery.data.codAmount} ${omsQuery.data.currency ?? ''}`.trim()}
                          />
                        ) : null}
                        {omsQuery.data.codStatus ? (
                          <DetailRow label="COD status" value={omsQuery.data.codStatus} />
                        ) : null}
                        {omsQuery.data.subtotal ? (
                          <DetailRow label="Subtotal" value={omsQuery.data.subtotal} strong />
                        ) : null}
                      </dl>
                    </Card.Body>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </div>

          {omsQuery.data ? <ClientOrderTrackingPanel order={omsQuery.data} /> : null}
        </>
      ) : null}
    </div>
  );
}

export default OutboundOrderDetailPage;
