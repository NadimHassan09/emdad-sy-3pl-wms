import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Alert, Badge, Button, EmptyState, Skeleton } from '@ds';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '../hooks/useChunkedServerPagination';

import { useAuth } from '../auth/AuthContext';
import { AnchoredDropdown } from '../components/AnchoredDropdown';
import { ClientBarcodeImageModal } from '../components/ClientBarcodeImageModal';
import { CreateClientProductModal } from '../components/CreateClientProductModal';
import { ProductDetailsModal } from '../components/ProductDetailsModal';
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
    Inventory: 'المخزون',
    'Sellable stock and catalog': 'المخزون القابل للبيع والكتالوج',
    'New product': 'منتج جديد',
    'Search name, SKU, or barcode...': 'ابحث بالاسم أو رمز SKU أو الباركود...',
    Product: 'المنتج',
    SKU: 'رمز SKU',
    Available: 'المتاح',
    Reserved: 'المحجوز',
    'On hand': 'المتواجد',
    Status: 'الحالة',
    Actions: 'الإجراءات',
    'View details': 'عرض التفاصيل',
    'View barcode': 'عرض الباركود',
    'Open actions': 'فتح الإجراءات',
    'No products found.': 'لا توجد منتجات.',
    'No products match your search.': 'لا توجد منتجات مطابقة لبحثك.',
    'Add your first catalog product to track sellable stock.':
      'أضف أول منتج في الكتالوج لتتبع المخزون القابل للبيع.',
    'Create first product': 'إنشاء أول منتج',
    'Could not load products': 'تعذر تحميل المنتجات',
    'Product created.': 'تم إنشاء المنتج.',
    Retry: 'إعادة المحاولة',
    'In stock': 'متوفر',
    'Low stock': 'مخزون منخفض',
    'Out of stock': 'نفد المخزون',
  };
  return ar[label] ?? label;
}

function stockHealth(
  available: number,
  threshold: number,
): 'available' | 'low' | 'out' {
  if (available <= 0) return 'out';
  const lowAt = threshold > 0 ? threshold : 5;
  if (available <= lowAt) return 'low';
  return 'available';
}

const fmtQty = (s: string | null | undefined): string => {
  if (s == null) return '—';
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const menuItemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-text-body transition hover:bg-surface-hover hover:text-brand-700 dark:hover:text-brand-400';

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
        title={t('Inventory')}
        subtitle={t('Sellable stock and catalog')}
        actions={
          canCreateProducts ? (
            <Button
              variant="primary"
              size="md"
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
              startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
            >
              {t('New product')}
            </Button>
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
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-text-faint text-xs" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search name, SKU, or barcode...')}
            className="w-full pl-9 pr-4 py-2 bg-surface-sunken border border-border-strong text-text-strong placeholder:text-text-faint rounded-lg text-sm input-premium"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
              <tr>
                <th className="px-5 py-3 text-left">{t('Product')}</th>
                <th className="px-5 py-3 text-left">{t('SKU')}</th>
                <th className="px-5 py-3 text-right">{t('Available')}</th>
                <th className="px-5 py-3 text-right">{t('Reserved')}</th>
                <th className="px-5 py-3 text-right">{t('On hand')}</th>
                <th className="px-5 py-3 text-left">{t('Status')}</th>
                <th className="px-5 py-3 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.isInitialLoading ? (
                Array.from({ length: 6 }).map((_, rowIdx) => (
                  <tr key={`sk-${rowIdx}`}>
                    {Array.from({ length: 7 }).map((__, colIdx) => (
                      <td key={colIdx} className="px-5 py-3.5">
                        <Skeleton height={14} width={colIdx === 0 ? '70%' : '50%'} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pagination.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6">
                    <EmptyState
                      size="sm"
                      icon={<i className="fa-solid fa-boxes-stacked text-2xl" aria-hidden="true" />}
                      title={
                        debouncedSearch.trim()
                          ? t('No products match your search.')
                          : t('No products found.')
                      }
                      description={
                        debouncedSearch.trim()
                          ? undefined
                          : t('Add your first catalog product to track sellable stock.')
                      }
                      action={
                        canCreateProducts &&
                        billingAccess.operationalAllowed &&
                        !debouncedSearch.trim() ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setCreateError(null);
                              setCreateOpen(true);
                            }}
                            startIcon={<i className="fa-solid fa-plus text-xs" aria-hidden="true" />}
                          >
                            {t('Create first product')}
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                pagination.rows.map((p) => {
                  const reserved = Number(p.totalReserved ?? 0);
                  const onHand = Number(p.totalOnHand ?? 0);
                  const available =
                    p.totalAvailable != null
                      ? Number(p.totalAvailable)
                      : Math.max(0, onHand - reserved);
                  const health = stockHealth(available, Number(p.minStockThreshold) || 0);
                  const healthTone =
                    health === 'out' ? 'danger' : health === 'low' ? 'warning' : 'success';
                  const healthLabel =
                    health === 'out'
                      ? t('Out of stock')
                      : health === 'low'
                        ? t('Low stock')
                        : t('In stock');
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setDetailProduct({ id: p.id, name: p.name })}
                      className="hover:bg-surface-hover transition-colors group cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {clientMediaSrc(p.imageUrl) ? (
                            <img
                              src={clientMediaSrc(p.imageUrl) ?? undefined}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-surface-sunken flex items-center justify-center text-text-faint shrink-0">
                              <i className="fa-solid fa-box text-xs" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-text-strong truncate">{p.name}</div>
                            <div className="text-xs text-text-muted truncate">{p.description || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text-body font-mono text-xs">
                        {p.barcode ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBarcodePreview({ value: p.barcode!, name: p.name });
                            }}
                            className="underline decoration-border-strong underline-offset-2 hover:text-brand-700 dark:hover:text-brand-400"
                            title={p.barcode}
                          >
                            {p.sku}
                          </button>
                        ) : (
                          p.sku
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-text-strong">
                        {fmtQty(p.totalAvailable ?? String(available))}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-text-muted">
                        {fmtQty(p.totalReserved)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-text-body">
                        {fmtQty(p.totalOnHand ?? String(onHand))}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={healthTone} dot>
                          {healthLabel}
                        </Badge>
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
                                className="w-8 h-8 rounded-lg border border-border text-text-muted hover:bg-surface-hover hover:text-text-strong transition-colors inline-flex items-center justify-center"
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
                              <i className="fa-solid fa-eye text-xs text-text-faint w-4" />
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
                                <i className="fa-solid fa-barcode text-xs text-text-faint w-4" />
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
