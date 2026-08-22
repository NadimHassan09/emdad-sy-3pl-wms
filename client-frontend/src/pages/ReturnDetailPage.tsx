import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Alert, Card, Skeleton, StatusBadge } from '@ds';

import { isClientArabic } from '../lib/client-ui-language';
import { fetchClientReturn } from '../services/clientReturnsService';
import { fetchClientOmsReturn } from '../services/clientOmsReturnsService';

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
  const location = useLocation();
  const isArabic = isClientArabic();
  const isOmsPath = !location.pathname.startsWith('/outbound-orders/returns');
  const backTo = isOmsPath ? '/ecommerce-orders/returns' : '/outbound-orders/returns';
  const backLabel = isArabic ? 'العودة إلى المرتجعات' : 'Back to returns';

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', isOmsPath ? 'oms-returns' : 'returns', id],
    queryFn: async () => {
      if (isOmsPath) {
        const row = await fetchClientOmsReturn(id);
        return {
          kind: 'oms' as const,
          orderNumber: row.returnNumber,
          status: row.status,
          createdAt: row.createdAt,
          notes: row.notes ?? row.reason,
          linkedOrder: row.omsOrder
            ? {
                id: row.omsOrder.id,
                orderNumber: row.omsOrder.orderNumber,
                href: `/ecommerce-orders/${row.omsOrder.id}`,
              }
            : null,
          warehouseReturn: row.warehouseReturn,
          lines: (row.lines ?? []).map((l) => ({
            id: l.id,
            lineNumber: l.lineNumber,
            sku: l.product?.sku ?? '—',
            name: l.product?.name ?? '—',
            expectedQuantity: l.quantity,
            receivedQuantity: '—',
            lineStatus: row.status,
          })),
        };
      }
      const row = await fetchClientReturn(id);
      return {
        kind: 'wh' as const,
        orderNumber: row.orderNumber,
        status: row.status,
        createdAt: row.createdAt,
        notes: row.notes,
        clientReference: row.clientReference,
        linkedOrder: row.originalOutbound
          ? {
              id: row.originalOutbound.id,
              orderNumber: row.originalOutbound.orderNumber,
              href: `/outbound-orders/${row.originalOutbound.id}`,
            }
          : null,
        warehouseReturn: null,
        lines: (row.lines ?? []).map((l) => ({
          id: l.id,
          lineNumber: l.lineNumber,
          sku: l.product.sku,
          name: l.product.name,
          expectedQuantity: l.expectedQuantity,
          receivedQuantity: l.receivedQuantity,
          lineStatus: l.lineStatus,
        })),
      };
    },
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        {backLabel}
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
              {data.orderNumber || id.slice(0, 8)}
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
                    data.linkedOrder ? (
                      <Link
                        to={data.linkedOrder.href}
                        className="font-mono text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {data.linkedOrder.orderNumber}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow label="Created" value={new Date(data.createdAt).toLocaleString()} />
                {data.kind === 'wh' && data.clientReference ? (
                  <DetailRow label="Your reference" value={data.clientReference} />
                ) : null}
                {data.warehouseReturn ? (
                  <DetailRow
                    label="Warehouse return"
                    value={`${data.warehouseReturn.orderNumber} · ${data.warehouseReturn.status}`}
                  />
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
                      <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{line.sku}</td>
                      <td className="px-4 py-2.5 font-medium text-text-strong">{line.name}</td>
                      <td className="px-4 py-2.5 text-right text-text-body">
                        {line.expectedQuantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                        {line.receivedQuantity}
                      </td>
                      <td className="px-4 py-2.5 text-text-body">
                        {String(line.lineStatus).replace(/_/g, ' ')}
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
