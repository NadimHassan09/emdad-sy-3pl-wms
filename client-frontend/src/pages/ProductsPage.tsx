import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Alert, Button } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FILTER_PRIMARY_BUTTON_CLASS, FilterPanel } from '@wms/components/FilterPanel';
import { TextField } from '@wms/components/TextField';
import { useFilters } from '@wms/hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { useAuth } from '../auth/AuthContext';
import { CreateClientProductModal } from '../components/CreateClientProductModal';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';
import {
  createClientProduct,
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';

const UOM_LABELS: Record<string, { en: string; ar: string }> = {
  piece: { en: 'Piece', ar: 'قطعة' },
  kg: { en: 'Kilogram', ar: 'كيلوغرام' },
  litre: { en: 'Litre', ar: 'لتر' },
  carton: { en: 'Carton', ar: 'كرتون' },
  pallet: { en: 'Pallet', ar: 'باليت' },
  box: { en: 'Box', ar: 'صندوق' },
  roll: { en: 'Roll', ar: 'لفة' },
};

type ProductListDraft = {
  name: string;
  sku: string;
  barcode: string;
};

function productsLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Products: 'المنتجات',
    'Product catalog': 'كتالوج المنتجات',
    'Your product catalog for inbound and outbound orders.': 'كتالوج منتجاتك لطلبات الوارد والصادر.',
    '+ New product': '+ منتج جديد',
    'Product filters': 'فلاتر المنتجات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    Name: 'الاسم',
    SKU: 'رمز SKU',
    Barcode: 'الباركود',
    UoM: 'وحدة القياس',
    Status: 'الحالة',
    'On hand': 'المتوفر',
    'No products found.': 'لا توجد منتجات.',
    'Could not load products': 'تعذر تحميل المنتجات',
    'Product created.': 'تم إنشاء المنتج.',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
    'Contains…': 'يحتوي على…',
  };
  return ar[label] ?? label;
}

function productStatusClass(status: ClientProductRow['status']): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'suspended') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}

export function ProductsPage(): ReactElement {
  const { user } = useAuth();
  const canCreateProducts = isClientAdmin(user?.role);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const isArabic = isClientArabic();
  const t = (label: string) => productsLabel(label, isArabic);

  const initialFilters = useMemo<ProductListDraft>(
    () => ({ name: '', sku: '', barcode: '' }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

  const filterKey = useMemo(
    () => ({
      productName: appliedFilters.name.trim() || undefined,
      sku: appliedFilters.sku.trim() || undefined,
      productBarcode: appliedFilters.barcode.trim() || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ClientProductRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientProducts({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'products'],
    chunkQueryKeyPrefix: 'client-products-chunk',
  });

  const createMut = useMutation({
    mutationFn: createClientProduct,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] });
      setCreateOpen(false);
      setCreateError(null);
      setCreateSuccess(`${t('Product created.')} (${created.sku})`);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const columns: Column<ClientProductRow>[] = useMemo(
    () => [
      { header: t('Name'), accessor: (p) => p.name },
      {
        header: t('SKU'),
        accessor: (p) => <span className="font-mono text-xs">{p.sku}</span>,
        width: '200px',
      },
      {
        header: t('Barcode'),
        accessor: (p) =>
          p.barcode ? (
            <span className="font-mono text-xs">{p.barcode}</span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
        width: '200px',
      },
      {
        header: t('UoM'),
        accessor: (p) => {
          const u = UOM_LABELS[p.uom];
          return u ? (isArabic ? u.ar : u.en) : p.uom;
        },
        width: '110px',
      },
      {
        header: t('Status'),
        accessor: (p) => (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${productStatusClass(p.status)}`}
          >
            {p.status}
          </span>
        ),
        width: '110px',
      },
      {
        header: t('On hand'),
        accessor: (p) => (
          <span className="block text-right font-mono font-semibold">{p.totalOnHand ?? '0'}</span>
        ),
        width: '120px',
        className: 'text-right',
      },
    ],
    [isArabic],
  );

  return (
    <>
      <p className="mb-3 text-sm text-slate-600">
        {t('Your product catalog for inbound and outbound orders.')}
      </p>

      {createSuccess && (
        <Alert
          variant="success"
          compact
          description={createSuccess}
          className="mb-4"
          action={
            <Alert.Action variant="success" onClick={() => setCreateSuccess(null)}>
              OK
            </Alert.Action>
          }
        />
      )}

      {pagination.isError && (
        <Alert
          variant="error"
          title={t('Could not load products')}
          description="Check your connection and try refreshing the page."
          action={
            <Alert.Action variant="error" onClick={() => pagination.refetch()}>
              Retry
            </Alert.Action>
          }
          className="mb-3"
        />
      )}

      <FilterPanel
        title={t('Product filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t('Name')}
            value={draftFilters.name}
            onChange={(e) => setDraft({ name: e.target.value })}
            placeholder={t('Contains…')}
          />
          <TextField
            label={t('SKU')}
            value={draftFilters.sku}
            onChange={(e) => setDraft({ sku: e.target.value })}
            className="font-mono text-xs"
            placeholder={t('Contains…')}
          />
          <TextField
            label={t('Barcode')}
            value={draftFilters.barcode}
            onChange={(e) => setDraft({ barcode: e.target.value })}
            className="font-mono text-xs"
            placeholder={t('Contains…')}
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Product catalog')}
        titleAs="h1"
        actions={
          canCreateProducts ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setCreateError(null);
                setCreateSuccess(null);
                setCreateOpen(true);
              }}
              className={FILTER_PRIMARY_BUTTON_CLASS}
            >
              {t('+ New product')}
            </Button>
          ) : undefined
        }
        columns={columns}
        rows={pagination.rows}
        rowKey={(p) => p.id}
        loading={pagination.isInitialLoading}
        empty={t('No products found.')}
        serverPagination={pagination.serverPagination}
        labels={{
          rowsSuffix: t('rows'),
          resultsSuffix: t('results'),
          ofWord: t('of'),
          previous: t('Previous'),
          next: t('Next'),
          rowsPerPageAria: t('Rows per page'),
        }}
      />

      <CreateClientProductModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        submitError={createError}
        isArabic={isArabic}
        onSubmit={(input) => {
          setCreateError(null);
          createMut.mutate(input);
        }}
      />
    </>
  );
}
