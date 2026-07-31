import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';

import { ProductsApi } from '../api/products';
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
    <div className="space-y-5 animate-enter">
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        {t(['Back to products', 'العودة إلى المنتجات'])}
      </Link>

      <ListPageHeader
        icon="fa-box"
        title={product?.name ?? t(['Product details', 'تفاصيل المنتج'])}
        subtitle={
          product?.sku
            ? `${product.sku}${product.company?.name ? ` · ${product.company.name}` : ''}`
            : t(['Warehouse product catalog', 'كتالوج منتجات المستودع'])
        }
      />

      {productQuery.isError ? (
        <Alert
          variant="error"
          title={t(['Could not load product details.', 'تعذّر تحميل تفاصيل المنتج.'])}
        />
      ) : null}

      {productQuery.isPending ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
            <Skeleton height={140} />
          </div>
        </Card>
      ) : null}

      {!productQuery.isPending && !productQuery.isError && !product ? (
        <Alert
          variant="error"
          title={t(['Product not found for this SKU.', 'لم يُعثر على منتج بهذا SKU.'])}
        />
      ) : null}

      {product ? <ProductDetailsCard product={product} /> : null}
    </div>
  );
}
