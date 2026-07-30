import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { StatusBadge } from '@ds';

import { fetchClientReturn } from '../services/clientReturnsService';

export function ReturnDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['client', 'returns', id],
    queryFn: () => fetchClientReturn(id),
    enabled: !!id,
  });

  const notFound = error && isAxiosError(error) && error.response?.status === 404;

  return (
    <main className="main">
      <div className="card">
        <p style={{ marginBottom: '1rem' }}>
          <Link className="muted" to="/returns" style={{ textDecoration: 'none' }}>
            ← Back to returns
          </Link>
        </p>

        {notFound ? (
          <p className="banner banner--error" role="alert">Return not found.</p>
        ) : error ? (
          <p className="banner banner--error" role="alert">Could not load this return.</p>
        ) : null}

        {isLoading ? (
          <p className="muted">Loading return…</p>
        ) : data ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
              <h1 className="card__title" style={{ margin: 0 }}>
                Return {data.orderNumber || data.id.slice(0, 8)}
              </h1>
              <StatusBadge status={data.status} />
            </div>

            <dl className="details">
              <div className="details__row">
                <dt>Original order</dt>
                <dd>
                  {data.originalOutbound ? (
                    <Link to={`/outbound-orders/${data.originalOutbound.id}`}>
                      {data.originalOutbound.orderNumber}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="details__row">
                <dt>Created</dt>
                <dd>{new Date(data.createdAt).toLocaleString()}</dd>
              </div>
              {data.clientReference ? (
                <div className="details__row">
                  <dt>Your reference</dt>
                  <dd>{data.clientReference}</dd>
                </div>
              ) : null}
              {data.notes ? (
                <div className="details__row">
                  <dt>Notes</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{data.notes}</dd>
                </div>
              ) : null}
            </dl>

            <h2 className="card__title" style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>Line items</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">Expected</th>
                    <th className="num">Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="num">{line.lineNumber}</td>
                      <td>{line.product.sku}</td>
                      <td>{line.product.name}</td>
                      <td className="num">{line.expectedQuantity}</td>
                      <td className="num">{line.receivedQuantity}</td>
                      <td>{line.lineStatus.replace(/_/g, ' ')}</td>
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
