import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Alert, Card, Skeleton, StatusBadge } from '@ds';

import {
  clientInboundStatusLabel,
  mapClientInboundDisplayStatus,
} from '../lib/client-inbound-status';
import { isClientArabic } from '../lib/client-ui-language';
import { clientMediaSrc } from '../lib/client-media';
import { fetchClientInboundOrder } from '../services/clientInboundOrdersService';

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

function DetailRow({
  label,
  value,
  className,
  preWrap,
}: {
  label: string;
  value?: string | null;
  className?: string;
  preWrap?: boolean;
}): ReactElement {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm text-text-strong ${preWrap ? 'whitespace-pre-wrap' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  );
}

export function InboundOrderDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const isArabic = isClientArabic();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'inbound-orders', id],
    queryFn: () => fetchClientInboundOrder(id),
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/inbound-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to inbound orders
      </Link>

      {notFound ? (
        <Alert variant="error" title="Inbound order not found." />
      ) : error ? (
        <Alert variant="error" title="Could not load this order. Please try again." />
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton height={28} width="40%" />
          <Skeleton height={180} />
          <Skeleton height={220} />
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-text-strong font-mono">
              {data.orderNumber || data.id.slice(0, 8)}
            </h1>
            <StatusBadge status={mapClientInboundDisplayStatus(data.status)}>
              {clientInboundStatusLabel(data.status, isArabic)}
            </StatusBadge>
          </div>

          {data.status === 'pending_approval' ? (
            <Alert
              variant="warning"
              title="This order is waiting for warehouse approval. Processing will begin after approval."
            />
          ) : null}

          <Card padding="none">
            <Card.Header>
              <Card.Title>Order details</Card.Title>
            </Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow label="Order #" value={data.orderNumber} />
                <DetailRow
                  label="Number of SKUs"
                  value={String(
                    new Set(data.lines.map((line) => line.product.sku || line.product.id)).size,
                  )}
                />
                <DetailRow label="Expected arrival" value={formatDate(data.expectedArrivalDate)} />
                <DetailRow label="Created" value={formatDateTime(data.createdAt)} />
                {data.clientReference ? (
                  <DetailRow label="Your reference" value={data.clientReference} />
                ) : null}
                {data.confirmedAt ? (
                  <DetailRow label="Confirmed" value={formatDateTime(data.confirmedAt)} />
                ) : null}
                {data.completedAt ? (
                  <DetailRow label="Completed" value={formatDateTime(data.completedAt)} />
                ) : null}
                <DetailRow
                  label="Notes"
                  value={data.notes?.trim() || '—'}
                  className="sm:col-span-2"
                  preWrap
                />
              </dl>
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
                    <th className="px-4 py-2.5 text-left">Image</th>
                    <th className="px-4 py-2.5 text-left">Product</th>
                    <th className="px-4 py-2.5 text-left">SKU</th>
                    <th className="px-4 py-2.5 text-right">Expected</th>
                    <th className="px-4 py-2.5 text-right">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {data.lines.map((line) => {
                    const imageSrc = clientMediaSrc(
                      line.product.imageUrl ??
                        (line.product.imagePath
                          ? `/media/${line.product.imagePath.replace(/^\/+/, '')}`
                          : null),
                    );
                    return (
                      <tr key={line.id}>
                        <td className="px-4 py-2.5 text-text-muted">{line.lineNumber}</td>
                        <td className="px-4 py-2.5">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              className="h-10 w-10 rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-text-faint">
                              <i className="fa-solid fa-box text-xs" aria-hidden="true" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-text-strong">
                          {line.product.name}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                          {line.product.sku}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-body">
                          {fmtQty(line.expectedQuantity)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                          {fmtQty(line.receivedQuantity)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default InboundOrderDetailPage;
