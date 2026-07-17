import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { Alert } from '@ds';
import type { Column } from '@wms/components/DataTable';
import { DataTable } from '@wms/components/DataTable';
import { FilterPanel } from '@wms/components/FilterPanel';
import { SelectField } from '@wms/components/SelectField';
import { StatusBadge } from '@wms/components/StatusBadge';
import { TextField } from '@wms/components/TextField';
import { useFilters } from '@wms/hooks/useFilters';
import {
  CHUNK_SIZE_STANDARD,
  useChunkedServerPagination,
} from '@wms/hooks/useChunkedServerPagination';

import { isClientArabic } from '../lib/client-ui-language';
import {
  fetchClientOmsOrders,
  type ClientOmsOrderListItem,
  type ClientOmsOrderStatus,
} from '../services/clientOmsOrdersService';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'ready_to_ship', label: 'Ready to ship' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

type ListDraft = {
  orderSearch: string;
  status: string;
};

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'E-commerce orders': 'طلبات التجارة الإلكترونية',
    'Order filters': 'فلاتر الطلبات',
    'Apply filters': 'تطبيق الفلاتر',
    'Reset filters': 'إعادة تعيين الفلاتر',
    'Order #': 'رقم الطلب',
    'Search order...': 'ابحث عن الطلب...',
    Status: 'الحالة',
    'All statuses': 'كل الحالات',
    Recipient: 'المستلم',
    Channel: 'القناة',
    Total: 'الإجمالي',
    Created: 'تاريخ الإنشاء',
    'No e-commerce orders found.': 'لا توجد طلبات تجارة إلكترونية.',
    'Could not load e-commerce orders': 'تعذر تحميل طلبات التجارة الإلكترونية',
    rows: 'صف',
    results: 'نتيجة',
    of: 'من',
    Previous: 'السابق',
    Next: 'التالي',
    'Rows per page': 'عدد الصفوف لكل صفحة',
  };
  return ar[label] ?? label;
}

export function EcommerceOrdersPage(): ReactElement {
  const navigate = useNavigate();
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);

  const initial = useMemo<ListDraft>(() => ({ orderSearch: '', status: '' }), []);
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initial);

  const filterKey = useMemo(
    () => ({
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      status: (appliedFilters.status.trim() || undefined) as ClientOmsOrderStatus | undefined,
    }),
    [appliedFilters],
  );

  const pagination = useChunkedServerPagination<ClientOmsOrderListItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey,
    fetchChunk: (offset, limit) => fetchClientOmsOrders({ ...filterKey, offset, limit }),
    rtQueryKeyPrefix: ['client', 'ecommerce-orders'],
    chunkQueryKeyPrefix: 'client-ecommerce-orders-chunk',
  });

  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        ...o,
        label: o.value === '' ? t('All statuses') : o.label,
      })),
    [isArabic],
  );

  const columns: Column<ClientOmsOrderListItem>[] = useMemo(
    () => [
      {
        header: t('Order #'),
        accessor: (o) => <span className="font-mono">{o.orderNumber || '—'}</span>,
        width: '170px',
      },
      {
        header: t('Status'),
        accessor: (o) => <StatusBadge status={o.status} />,
        className: 'w-1 whitespace-nowrap',
      },
      {
        header: t('Recipient'),
        accessor: (o) => o.recipientName ?? '—',
        width: '140px',
      },
      {
        header: t('Channel'),
        accessor: (o) => o.storeChannel ?? '—',
        width: '120px',
      },
      {
        header: t('Total'),
        accessor: (o) =>
          o.total != null ? `${o.total}${o.currency ? ` ${o.currency}` : ''}` : '—',
        width: '120px',
      },
      {
        header: t('Created'),
        accessor: (o) => new Date(o.createdAt).toLocaleString(),
      },
    ],
    [isArabic],
  );

  return (
    <>
      {pagination.isError && (
        <Alert
          variant="error"
          title={t('Could not load e-commerce orders')}
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
        title={t('Order filters')}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={pagination.isFetching}
        applyLabel={t('Apply filters')}
        resetLabel={t('Reset filters')}
      >
        <TextField
          label={t('Order #')}
          value={draftFilters.orderSearch}
          onChange={(e) => setDraft({ orderSearch: e.target.value })}
          placeholder={t('Search order...')}
          className="font-mono text-xs"
        />
        <SelectField
          label={t('Status')}
          value={draftFilters.status}
          onChange={(e) => setDraft({ status: e.target.value })}
          options={statusOptions}
        />
      </FilterPanel>

      <DataTable
        title={t('E-commerce orders')}
        titleAs="h1"
        columns={columns}
        rows={pagination.rows}
        rowKey={(o) => o.id}
        loading={pagination.isInitialLoading}
        onRowClick={(o) => navigate(`/ecommerce-orders/${o.id}`)}
        empty={t('No e-commerce orders found.')}
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
    </>
  );
}
