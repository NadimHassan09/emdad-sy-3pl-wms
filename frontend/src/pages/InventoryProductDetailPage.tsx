import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InventoryApi, StockRow } from '../api/inventory';
import { ProductsApi } from '../api/products';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';
import { useDefaultWarehouseId } from '../hooks/useDefaultWarehouse';

const fmtQty = (s: string) => Number(s).toLocaleString(undefined, { maximumFractionDigits: 4 });

type LotBucket = {
  lotId: string | null;
  lotNumber: string;
  rows: StockRow[];
};

export function InventoryProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const { warehouseId: wid } = useDefaultWarehouseId();

  const product = useQuery({
    queryKey: [...QK.products, productId],
    queryFn: () => ProductsApi.get(productId),
    enabled: !!productId,
  });

  const stock = useQuery({
    queryKey: [...QK.inventoryStock, 'detail', productId, wid],
    queryFn: () => InventoryApi.stock({ productId, warehouseId: wid || undefined, limit: 500 }),
    enabled: !!productId && !!wid,
  });

  const buckets: LotBucket[] = useMemo(() => {
    const items = stock.data?.items ?? [];
    const map = new Map<string | null, StockRow[]>();
    for (const row of items) {
      const k = row.lotId;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(row);
    }
    const out: LotBucket[] = [];
    for (const [lotId, rows] of map.entries()) {
      const lotNumber = rows[0]?.lot?.lotNumber ?? '—';
      out.push({ lotId, lotNumber, rows: rows.slice().sort((a, b) => a.location.fullPath.localeCompare(b.location.fullPath)) });
    }
    out.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber));
    return out;
  }, [stock.data?.items]);

  if (!productId) return null;
  if (!wid) return <p className="text-sm text-slate-600">Resolve warehouse configuration…</p>;
  if (product.isLoading || stock.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (product.isError || !product.data)
    return <p className="text-sm text-rose-600">Product not found.</p>;

  const p = product.data;

  return (
    <>
      <div className="mb-2 text-sm text-slate-500">
        <Link to="/inventory" className="hover:underline">
          ← Back to inventory
        </Link>
      </div>
      <PageHeader
        title={p.name}
        description={`SKU ${p.sku} • Client ${p.company?.name ?? '—'}`}
      />

      <div className="mb-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm text-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <span className="text-xs uppercase tracking-wide text-slate-500">Product</span>
            <div className="font-medium text-slate-900">{p.name}</div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-slate-500">SKU</span>
            <div className="font-mono text-slate-800">{p.sku}</div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-slate-500">Client</span>
            <div className="text-slate-800">{p.company?.name ?? '—'}</div>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-800">Lot / location breakdown</h2>
        {buckets.length === 0 ? (
          <p className="text-sm text-slate-500">No stock rows for this product with current visibility.</p>
        ) : (
          buckets.map((bucket) => (
            <div
              key={bucket.lotId ?? '__none'}
              className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lot number</span>
                <span className="ml-2 font-mono text-sm font-medium text-slate-900">{bucket.lotNumber}</span>
              </div>
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-white">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Quantity
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location code
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bucket.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-right">{fmtQty(r.quantityOnHand)}</td>
                      <td className="px-3 py-2 text-slate-800">{r.location.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.location.barcode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>
    </>
  );
}
