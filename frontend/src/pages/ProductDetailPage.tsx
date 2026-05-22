import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { ProductsApi } from '../api/products';
import { PageHeader } from '../components/PageHeader';
import { ProductDetailsCard } from '../components/products/ProductDetailsCard';
import { QK } from '../constants/query-keys';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ProductDetailPage() {
  const { sku = '' } = useParams<{ sku: string }>();
  const decoded = decodeURIComponent(sku);
  const loadById = UUID_RE.test(decoded);

  const productQuery = useQuery({
    queryKey: [...QK.products, loadById ? 'by-id' : 'by-sku', decoded],
    queryFn: async () => {
      if (loadById) {
        return ProductsApi.get(decoded);
      }
      const list = await ProductsApi.list({ sku: decoded, limit: 50 });
      return list.items.find((p) => p.sku.toLowerCase() === decoded.toLowerCase()) ?? null;
    },
    enabled: !!decoded,
  });

  const product = productQuery.data;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/products" className="hover:underline">
          ← Back to products
        </Link>
      </div>

      <PageHeader title="Product details" />

      {productQuery.isPending ? <p className="text-sm text-slate-500">Loading product details...</p> : null}
      {productQuery.isError ? <p className="text-sm text-rose-600">Could not load product details.</p> : null}
      {!productQuery.isPending && !productQuery.isError && !product ? (
        <p className="text-sm text-rose-600">Product not found for this SKU.</p>
      ) : null}

      {product ? <ProductDetailsCard product={product} /> : null}
    </div>
  );
}
