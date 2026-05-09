import type { FormEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { fetchClientOutboundOrders } from '../services/clientOutboundOrdersService';

const PAGE_SIZE = 25;

export function OutboundOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['client', 'outbound-orders', offset, PAGE_SIZE, appliedSearch],
    queryFn: () =>
      fetchClientOutboundOrders({
        limit: PAGE_SIZE,
        offset,
        orderSearch: appliedSearch.trim() || undefined,
      }),
  });

  function onSearch(e: FormEvent): void {
    e.preventDefault();
    setPage(0);
    setAppliedSearch(searchInput.trim());
  }

  const totalPages = useMemo(() => {
    if (!data?.total) return 1;
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data?.total]);

  const pageLabel = data
    ? `${data.offset + 1}-${Math.min(data.offset + data.items.length, data.total)} of ${data.total}`
    : '';

  return (
    <main className="main">
      <div className="card">
        <h1 className="card__title">Outbound orders</h1>

        <form className="stock-toolbar" onSubmit={onSearch}>
          <label className="field field--inline">
            <span className="field__label">Search orders</span>
            <input
              className="field__input"
              type="search"
              placeholder="Order number or UUID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={isFetching}>
            Search
          </button>
        </form>

        {error ? (
          <p className="banner banner--error" role="alert">
            Could not load outbound orders. Please try again.
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted">Loading outbound orders…</p>
        ) : data && data.items.length === 0 ? (
          <p className="muted">No outbound orders found.</p>
        ) : data ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Status</th>
                    <th>Required ship</th>
                    <th>Created</th>
                    <th className="num">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr
                      key={row.id}
                      role="link"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/outbound-orders/${row.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/outbound-orders/${row.id}`);
                        }
                      }}
                    >
                      <td>{row.orderNumber || row.id.slice(0, 8)}</td>
                      <td>{row.status}</td>
                      <td>{formatDate(row.requiredShipDate)}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td className="num">{row._count?.lines ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <span className="pager__meta">{pageLabel}</span>
              <div className="pager__actions">
                <button
                  className="btn btn--secondary"
                  type="button"
                  disabled={page <= 0 || isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn--secondary"
                  type="button"
                  disabled={page >= totalPages - 1 || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
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
