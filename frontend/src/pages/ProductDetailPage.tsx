import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { ProductsApi } from '../api/products';
import { PageHeader } from '../components/PageHeader';
import { ProductDetailsCard } from '../components/products/ProductDetailsCard';
import { QK } from '../constants/query-keys';
import { useWmsTranslation } from '../lib/ui-i18n';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ProductDetailPage() {
  const { sku = '' } = useParams<{ sku: string }>();
  const { t } = useWmsTranslation();
  const decoded = decodeURIComponent(sku);
  const loadById = UUID_RE.test(decoded);

  const productQuery = useQuery({
    queryKey: [...QK.products, loadById ? 'by-id' : 'by-sku', decoded],
    queryFn: async () => {
      if (loadById) {
        return ProductsApi.get(decoded);
      }
      const list = await ProductsApi.list({ sku: decoded, limit: 50 });
      const exact = list.items.filter((p) => p.sku.toLowerCase() === decoded.toLowerCase());
      if (exact.length === 1) return exact[0]!;
      if (exact.length > 1) {
        return exact.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]!;
      }
      return null;
    },
    enabled: !!decoded,
  });

  const product = productQuery.data;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to="/products" className="hover:underline">
          {t(['← Back to products', '← العودة إلى المنتجات'])}
        </Link>
      </div>

      <PageHeader title={t(['Product details', 'تفاصيل المنتج'])} />

      {productQuery.isPending ? (
        <p className="text-sm text-slate-500">
          {t(['Loading product details...', 'جاري تحميل تفاصيل المنتج...'])}
        </p>
      ) : null}
      {productQuery.isError ? (
        <p className="text-sm text-rose-600">
          {t(['Could not load product details.', 'تعذّر تحميل تفاصيل المنتج.'])}
        </p>
      ) : null}
      {!productQuery.isPending && !productQuery.isError && !product ? (
        <p className="text-sm text-rose-600">
          {t(['Product not found for this SKU.', 'لم يُعثر على منتج بهذا SKU.'])}
        </p>
      ) : null}

      {product ? <ProductDetailsCard product={product} /> : null}
    </div>
  );
}
