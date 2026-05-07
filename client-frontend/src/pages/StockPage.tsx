import type { FormEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
import { fetchStockPage } from '../services/stockService';

const PAGE_SIZE = 25;

export function StockPage(): ReactElement {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['client', 'stock', offset, PAGE_SIZE, appliedSearch],
    queryFn: () =>
      fetchStockPage({
        limit: PAGE_SIZE,
        offset,
        productSearch: appliedSearch.trim() || undefined,
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
    ? `${data.offset + 1}–${Math.min(data.offset + data.items.length, data.total)} of ${data.total}`
    : '';

  return (
    <main className="main">
      <div className="card">
        <h1 className="card__title">Stock</h1>
        {user?.companyName ? (
          <p className="card__subtitle card__subtitle--muted">{user.companyName}</p>
        ) : null}

        <form className="stock-toolbar" onSubmit={onSearch}>
          <label className="field field--inline">
            <span className="field__label">Search products</span>
            <input
              className="field__input"
              type="search"
              placeholder="Name or SKU"
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
            Could not load stock. Please try again.
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted">Loading stock…</p>
        ) : data && data.items.length === 0 ? (
          <p className="muted">No products match your filters.</p>
        ) : data ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product name</th>
                    <th>SKU</th>
                    <th className="num">Qty</th>
                    <th>UoM</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.productId}>
                      <td>{row.productName}</td>
                      <td>{row.sku}</td>
                      <td className="num">{row.totalQuantity}</td>
                      <td>{row.uom}</td>
                      <td>{row.expiryDate ? formatDate(row.expiryDate) : '—'}</td>
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

function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString();
}
