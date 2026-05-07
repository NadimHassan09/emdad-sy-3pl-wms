import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { ProductsApi } from '../api/products';
import { PageHeader } from '../components/PageHeader';
import { QK } from '../constants/query-keys';

function prettyDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s.length ? s : '—';
}

export function ProductDetailPage() {
  const { sku = '' } = useParams<{ sku: string }>();
  const decodedSku = decodeURIComponent(sku);

  const productQuery = useQuery({
    queryKey: [...QK.products, 'by-sku', decodedSku],
    queryFn: async () => {
      const list = await ProductsApi.list({ sku: decodedSku, limit: 50 });
      const exact = list.items.find((p) => p.sku.toLowerCase() === decodedSku.toLowerCase());
      return exact ?? null;
    },
    enabled: !!decodedSku,
  });

  const product = productQuery.data;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/products" className="hover:underline">
          ← Back to products
        </Link>
      </div>

      <PageHeader title={product?.name ?? decodedSku} description={`Product details for SKU ${decodedSku}`} />

      {productQuery.isPending ? <p className="text-sm text-slate-500">Loading product details...</p> : null}
      {productQuery.isError ? <p className="text-sm text-rose-600">Could not load product details.</p> : null}
      {!productQuery.isPending && !productQuery.isError && !product ? (
        <p className="text-sm text-rose-600">Product not found for this SKU.</p>
      ) : null}

      {product ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-sm font-medium text-slate-900">{product.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">SKU</p>
              <p className="font-mono text-sm text-slate-900">{product.sku}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Client</p>
              <p className="text-sm text-slate-900">{product.company?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Barcode</p>
              <p className="font-mono text-sm text-slate-900">{display(product.barcode)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Description</p>
              <p className="text-sm text-slate-900">{display(product.description)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="text-sm text-slate-900">{product.status}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">UOM</p>
              <p className="text-sm text-slate-900">{product.uom}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tracking</p>
              <p className="text-sm text-slate-900">
                {product.trackingType} {product.expiryTracking ? '(expiry required)' : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Min stock threshold</p>
              <p className="text-sm text-slate-900">{display(product.minStockThreshold)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">On hand / Reserved</p>
              <p className="text-sm text-slate-900">
                {display(product.totalOnHand)} / {display(product.totalReserved)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Dimensions (L x W x H cm)</p>
              <p className="text-sm text-slate-900">
                {display(product.lengthCm)} x {display(product.widthCm)} x {display(product.heightCm)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Weight (kg)</p>
              <p className="text-sm text-slate-900">{display(product.weightKg)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Created at</p>
              <p className="text-sm text-slate-900">{prettyDate(product.createdAt)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
