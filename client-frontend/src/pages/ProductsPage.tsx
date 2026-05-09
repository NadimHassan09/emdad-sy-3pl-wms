import type { FormEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchClientProducts } from '../services/clientProductsService';

const PAGE_SIZE = 25;

export function ProductsPage(): ReactElement {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['client', 'products', offset, PAGE_SIZE, appliedSearch],
    queryFn: () =>
      fetchClientProducts({
        limit: PAGE_SIZE,
        offset,
        search: appliedSearch.trim() || undefined,
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
        <h1 className="card__title">Products</h1>

        <form className="stock-toolbar" onSubmit={onSearch}>
          <label className="field field--inline">
            <span className="field__label">Search products</span>
            <input
              className="field__input"
              type="search"
              placeholder="Name, SKU, barcode"
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
            Could not load products. Please try again.
          </p>
        ) : null}

        {isLoading ? (
          <p className="muted">Loading products…</p>
        ) : data && data.items.length === 0 ? (
          <p className="muted">No products found.</p>
        ) : data ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Barcode</th>
                    <th>UoM</th>
                    <th>Status</th>
                    <th className="num">On hand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.sku}</td>
                      <td>{row.barcode || '—'}</td>
                      <td>{row.uom}</td>
                      <td>{row.status}</td>
                      <td className="num">{row.totalOnHand ?? '0'}</td>
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
