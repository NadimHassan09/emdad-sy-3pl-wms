import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Alert } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { useAuth } from '../auth/AuthContext';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { ClientBarcodeImageModal } from '../components/ClientBarcodeImageModal';
import { CreateClientProductModal } from '../components/CreateClientProductModal';
import { ProductDetailsModal } from '../components/ProductDetailsModal';
import { Badge } from '../design-v2/Badge';
import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { TableFooterPagination } from '../design-v2/TableFooterPagination';
import { useDebouncedValue } from '../design-v2/useDebouncedValue';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';
import {
  createClientProduct,
  fetchClientProducts,
  uploadClientProductImage,
  type ClientProductRow,
  type CreateClientProductInput,
} from '../services/clientProductsService';
import { clientMediaSrc } from '../lib/client-media';

function productsLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Products: 'المنتجات',
    'Manage your product catalog and inventory': 'إدارة كتالوج المنتجات والمخزون',
    'New product': 'منتج جديد',
    'Search name, SKU, or barcode...': 'ابحث بالاسم أو رمز SKU أو الباركود...',
    Product: 'المنتج',
    SKU: 'رمز SKU',
    Stock: 'المخزون',
    Status: 'الحالة',
    Actions: 'الإجراءات',
    'View details': 'عرض التفاصيل',
    'View barcode': 'عرض الباركود',
    'Open actions': 'فتح الإجراءات',
    'No products found.': 'لا توجد منتجات.',
    'Could not load products': 'تعذر تحميل المنتجات',
    'Product created.': 'تم إنشاء المنتج.',
    Retry: 'إعادة المحاولة',
  };
  return ar[label] ?? label;
}

const fmtQty = (s: string | null | undefined): string => {
  if (s == null) return '—';
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const menuItemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-slate-700 transition hover:bg-slate-50 hover:text-emerald-700';

export function ProductsPage(): ReactElement {
  const { user } = useAuth();
  const canCreateProducts = isClientAdmin(user?.role);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [barcodePreview, setBarcodePreview] = useState<{ value: string; name: string } | null>(null);
  const [detailProduct, setDetailProduct] = useState<{ id: string; name: string } | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const isArabic = isClientArabic();
  const t = (label: string) => productsLabel(label, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!openActionId) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Element | null;
      if (!target) return;
      if (
        target.closest('[data-product-action-trigger="true"]') ||
        target.closest('[data-product-action-menu="true"]') ||
        target.closest('[data-product-action-menu-button="true"]')
      ) {
        return;
      }
      setOpenActionId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [openActionId]);

  const filterKey = useMemo(() => ({ search: debouncedSearch.trim() || undefined }), [debouncedSearch]);

  const pagination = useChunkedServerPagination<ClientProductRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientProducts({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'products'],
    chunkQueryKeyPrefix: 'client-products-chunk',
  });

  const createMut = useMutation({
    mutationFn: async ({
      input,
      imageFile,
    }: {
      input: CreateClientProductInput;
      imageFile: File | null;
    }) => {
      const created = await createClientProduct(input);
      if (imageFile) {
        try {
          await uploadClientProductImage(created.id, imageFile);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Image upload failed.';
          throw new Error(`${t('Product created.')} ${msg}`);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] });
      setCreateOpen(false);
      setCreateError(null);
      setCreateSuccess(`${t('Product created.')} (${created.sku})`);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  return (
    <div className="space-y-5 animate-enter">
      <ListPageHeader
        icon="fa-boxes-stacked"
        title={t('Products')}
        subtitle={t('Manage your product catalog and inventory')}
        actions={
          canCreateProducts ? (
            <button
              type="button"
              disabled={!billingAccess.operationalAllowed}
              title={
                !billingAccess.operationalAllowed
                  ? billingAccess.restriction.actionBlockedReason
                  : undefined
              }
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <i className="fa-solid fa-plus text-xs" />
              {t('New product')}
            </button>
          ) : null
        }
      />

      {createSuccess ? (
        <Alert variant="success" title={createSuccess} onDismiss={() => setCreateSuccess(null)} />
      ) : null}

      {pagination.isError ? (
        <Alert
          variant="error"
          title={t('Could not load products')}
          action={
            <Alert.Action variant="error" onClick={() => pagination.refetch()}>
              {t('Retry')}
            </Alert.Action>
          }
        />
      ) : null}

      <Card className="p-4">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search name, SKU, or barcode...')}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm input-premium"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">{t('Product')}</th>
                <th className="px-5 py-3 text-left">{t('SKU')}</th>
                <th className="px-5 py-3 text-left">{t('Stock')}</th>
                <th className="px-5 py-3 text-left">{t('Status')}</th>
                <th className="px-5 py-3 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.isInitialLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">…</td>
                </tr>
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">
                    {t('No products found.')}
                  </td>
                </tr>
              ) : (
                pagination.rows.map((p) => {
                  const stock = Number(p.totalOnHand ?? 0);
                  const stockPercent = Number.isFinite(stock) ? Math.min(100, (stock / 10) * 100) : 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setDetailProduct({ id: p.id, name: p.name })}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {clientMediaSrc(p.imageUrl) ? (
                            <img
                              src={clientMediaSrc(p.imageUrl) ?? undefined}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <i className="fa-solid fa-box text-xs" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                            <div className="text-xs text-slate-500 truncate">{p.description || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">
                        {p.barcode ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBarcodePreview({ value: p.barcode!, name: p.name });
                            }}
                            className="underline decoration-slate-300 underline-offset-2 hover:text-emerald-700"
                            title={p.barcode}
                          >
                            {p.sku}
                          </button>
                        ) : (
                          p.sku
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stockPercent}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-700">{fmtQty(p.totalOnHand)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={p.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                          <AnchoredDropdown
                            open={openActionId === p.id}
                            align="end"
                            menuRootProps={{ 'data-product-action-menu': 'true' }}
                            trigger={
                              <button
                                type="button"
                                data-product-action-trigger="true"
                                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors inline-flex items-center justify-center"
                                onClick={() =>
                                  setOpenActionId((cur) => (cur === p.id ? null : p.id))
                                }
                                aria-label={t('Open actions')}
                                aria-expanded={openActionId === p.id}
                                aria-haspopup="menu"
                              >
                                <i className="fa-solid fa-ellipsis" />
                              </button>
                            }
                          >
                            <button
                              type="button"
                              role="menuitem"
                              data-product-action-menu-button="true"
                              className={menuItemClass}
                              onClick={() => {
                                setOpenActionId(null);
                                setDetailProduct({ id: p.id, name: p.name });
                              }}
                            >
                              <i className="fa-solid fa-eye text-xs text-slate-400 w-4" />
                              {t('View details')}
                            </button>
                            {p.barcode ? (
                              <button
                                type="button"
                                role="menuitem"
                                data-product-action-menu-button="true"
                                className={menuItemClass}
                                onClick={() => {
                                  setOpenActionId(null);
                                  setBarcodePreview({ value: p.barcode!, name: p.name });
                                }}
                              >
                                <i className="fa-solid fa-barcode text-xs text-slate-400 w-4" />
                                {t('View barcode')}
                              </button>
                            ) : null}
                          </AnchoredDropdown>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TableFooterPagination pagination={pagination.serverPagination} isArabic={isArabic} />
      </Card>

      <CreateClientProductModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        submitError={createError}
        isArabic={isArabic}
        onSubmit={(input, imageFile) => {
          setCreateError(null);
          createMut.mutate({ input, imageFile });
        }}
      />

      <ClientBarcodeImageModal
        open={!!barcodePreview}
        onClose={() => setBarcodePreview(null)}
        value={barcodePreview?.value ?? ''}
        productName={barcodePreview?.name ?? ''}
        isArabic={isArabic}
      />

      <ProductDetailsModal
        open={!!detailProduct}
        productId={detailProduct?.id ?? null}
        productName={detailProduct?.name}
        onClose={() => setDetailProduct(null)}
        isArabic={isArabic}
      />
    </div>
  );
}
