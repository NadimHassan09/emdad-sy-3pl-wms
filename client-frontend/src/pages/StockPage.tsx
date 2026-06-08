import { useMemo } from 'react';
import type { ReactElement } from 'react';

import { Alert } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FilterPanel } from '@wms/components/FilterPanel';
import { TextField } from '@wms/components/TextField';
import { useFilters } from '@wms/hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { useAuth } from '../auth/AuthContext';
import { isClientArabic } from '../lib/client-ui-language';
import { fetchStockPage, type ClientStockRow } from '../services/stockService';

type StockListDraft = {
  productSearch: string;
};

function stockLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Stock: 'المخزون',
    'Stock filters': 'فلاتر المخزون',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'Search products': 'ابحث عن المنتجات',
    'Name or SKU': 'الاسم أو SKU',
    'Product name': 'اسم المنتج',
    SKU: 'رمز SKU',
    Qty: 'الكمية',
    UoM: 'وحدة القياس',
    Expiry: 'انتهاء الصلاحية',
    'No stock found.': 'لا يوجد مخزون.',
    'Could not load stock': 'تعذر تحميل المخزون',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
  };
  return ar[label] ?? label;
}

const fmtQty = (s: string): string => {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

function formatExpiry(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString();
}

export function StockPage(): ReactElement {
  const { user } = useAuth();
  const isArabic = isClientArabic();
  const t = (label: string) => stockLabel(label, isArabic);

  const initialFilters = useMemo<StockListDraft>(() => ({ productSearch: '' }), []);

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

  const filterKey = useMemo(
    () => ({
      productSearch: appliedFilters.productSearch.trim() || undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ClientStockRow>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchStockPage({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'stock'],
    chunkQueryKeyPrefix: 'client-stock-chunk',
  });

  const columns: Column<ClientStockRow>[] = useMemo(
    () => [
      {
        header: t('Product name'),
        accessor: (r) => <span className="font-medium text-slate-900">{r.productName}</span>,
      },
      {
        header: t('SKU'),
        accessor: (r) => <span className="font-mono text-xs">{r.sku}</span>,
        width: '200px',
      },
      {
        header: t('Qty'),
        accessor: (r) => (
          <span className="font-mono block text-right font-semibold">{fmtQty(r.totalQuantity)}</span>
        ),
        width: '140px',
        className: 'text-right',
      },
      {
        header: t('UoM'),
        accessor: (r) => r.uom,
        width: '110px',
      },
      {
        header: t('Expiry'),
        accessor: (r) => (r.expiryDate ? formatExpiry(r.expiryDate) : '—'),
        width: '140px',
      },
    ],
    [isArabic],
  );

  const description = user?.companyName ? user.companyName : undefined;
  const tableLabels = {
    rowsSuffix: t('rows'),
    resultsSuffix: t('results'),
    ofWord: t('of'),
    previous: t('Previous'),
    next: t('Next'),
    rowsPerPageAria: t('Rows per page'),
  };

  return (
    <>
      {pagination.isError && (
        <Alert
          variant="error"
          title={t('Could not load stock')}
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
        title={t('Stock filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t('Search products')}
            value={draftFilters.productSearch}
            onChange={(e) => setDraft({ productSearch: e.target.value })}
            placeholder={t('Name or SKU')}
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Stock')}
        titleAs="h1"
        description={description}
        columns={columns}
        rows={pagination.rows}
        rowKey={(r) => `${r.productId}-${r.expiryDate ?? 'none'}`}
        loading={pagination.isInitialLoading}
        empty={t('No stock found.')}
        serverPagination={pagination.serverPagination}
        labels={tableLabels}
      />
    </>
  );
}
