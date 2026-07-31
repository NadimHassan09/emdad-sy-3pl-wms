import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Alert, Card, Skeleton, StatusBadge } from '@ds';

import { fetchClientReturn } from '../services/clientReturnsService';

function DetailRow({
  label,
  value,
  className,
  preWrap,
}: {
  label: string;
  value?: ReactElement | string | null;
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

export function ReturnDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'returns', id],
    queryFn: () => fetchClientReturn(id),
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/returns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to returns
      </Link>

      {notFound ? (
        <Alert variant="error" title="Return not found." />
      ) : error ? (
        <Alert variant="error" title="Could not load this return." />
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton height={28} width="40%" />
          <Skeleton height={140} />
          <Skeleton height={200} />
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-text-strong font-mono">
              {data.orderNumber || data.id.slice(0, 8)}
            </h1>
            <StatusBadge status={data.status} />
          </div>

          <Card padding="none">
            <Card.Header>
              <Card.Title>Return details</Card.Title>
            </Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow
                  label="Original order"
                  value={
                    data.originalOutbound ? (
                      <Link
                        to={`/outbound-orders/${data.originalOutbound.id}`}
                        className="font-mono text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {data.originalOutbound.orderNumber}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow label="Created" value={new Date(data.createdAt).toLocaleString()} />
                {data.clientReference ? (
                  <DetailRow label="Your reference" value={data.clientReference} />
                ) : null}
                {data.notes ? (
                  <DetailRow label="Notes" value={data.notes} className="sm:col-span-2" preWrap />
                ) : null}
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
                    <th className="px-4 py-2.5 text-left">SKU</th>
                    <th className="px-4 py-2.5 text-left">Product</th>
                    <th className="px-4 py-2.5 text-right">Expected</th>
                    <th className="px-4 py-2.5 text-right">Received</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
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
                        {line.expectedQuantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                        {line.receivedQuantity}
                      </td>
                      <td className="px-4 py-2.5 text-text-body">
                        {line.lineStatus.replace(/_/g, ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default ReturnDetailPage;
